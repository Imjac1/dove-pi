# Personal Agent Framework Core

> **Scope:** The framework's own execution loop, its gate boundary, the
> authority contract, effect identity, the evidence plane, context admission, and capability scoping.
>
> **Canonical router:** [Personal Agent Runtime Contract](./personal-agent-runtime.md)

The framework owns its loop; hosts and providers sit behind interfaces. Every contract below fails
closed: an unevaluable condition is a block, never a pass.

## Scenario: Loop Ownership and Gate Boundary

### 1. Scope / Trigger

Trigger: adding or changing the execution loop, or any pre-execution policy check.

### 2. Signatures

```typescript
// src/core/loop.ts
interface LoopProvider { readonly id: string; stream(request: ProviderRequest, signal?: AbortSignal): AsyncIterable<ProviderEvent>; }
interface ActionGate { readonly id: string; evaluate(i: GateInvocation): GateDecision | Promise<GateDecision>; }
interface SynchronousActionGate extends ActionGate { evaluate(i: GateInvocation): GateDecision; }
interface AgentLoop { run(input: string, signal?: AbortSignal): Promise<LoopOutcome>; }
type GateDecision =
  | { outcome: "allow"; reason?: string }
  | { outcome: "ask"; reason: string; remediation: string }
  | { outcome: "block"; reason: string; remediation: string };
function normalizeGateDecision(decision: unknown, gateId: string): GateDecision;
```

### 3. Contracts

- The loop owns the model-to-tool cycle; `LoopProvider` is caller-supplied, so no loop implementation
  selects a provider.
- `LoopOptions.mode` (id + version + governance version) is stamped on every gate invocation.
- Three rules the loop enforces itself: the gate runs for **every** action including allowed ones; a
  throwing gate or unrecognised shape is a **block**; a `target`/`displayTarget` mismatch blocks before
  the gate is consulted.
- A block carries `remediation` as well as `reason`; both reach the tool result.
- **`ask` is a requirement, not a judgement.** Consent is a fact about the *host*, which owns the
  dialog; a consumer that cannot ask must **refuse**.
- Two implementations must agree: `src/core/loop-runner.ts` (reference) and
  `src/adapters/loop-pi-agent-core.ts` (external). `AgentLoop` is the interface, not the provider; both
  call `normalizeGateDecision` - a rule copied into two loops differs in one of them.
- **The boundary is consulted in two halves, and the host decides which can run.** `denyDecision` reads a tool
  name and nothing else, so `src/pi-adapter/extension.ts` runs it *before* its lease check; `evaluate` reads the
  arguments, so it runs only when `requestLifecycle.activeLease()` is active (`:2301`) - inside a request, where
  the arguments are final. State the consequence rather than discover it: **a tool call outside an active request
  is checked by the name-only half alone**, so an argument-reading control (a `sandbox` claim, an excluded
  technique, a mode's `fence`) does not run there.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| No gate configured | Every action runs, and the reason says so. Omitting the gate is only safe where every action is read-only; both gate-less paths return `allow` and are unreachable from an entry point (reachability test). |
| Gate throws | Block, reason names the gate and the error |
| Gate returns an unrecognised shape | Block |
| `ask` to a loop with no dialog, or `ask`/`block` with no `reason`/`remediation` | Block; the message names which fault |
| `target` !== `displayTarget` | Block before the gate is consulted |
| Action allowed | `onGateInvoked` still fires, so an off-path gate is detectable |
| Tool call with no active request lease | The name-only half runs (`never_allow`); argument-reading controls do not, because the arguments they read are only final inside a request |

### 5. Tests Required

- Paired offline test: one scripted provider, gate off versus gate on; assert executed actions 1 -> 0
  and that the reason and remediation reach the transcript.
- Invocation log records allowed actions.
- Throwing gate, unrecognised decision, and an `ask` the loop cannot put all fail closed.
- Target/display mismatch blocks with the gate never consulted.
- The external adapter satisfies the same cases.
- A case about an **argument-reading** control opens a request first (`input` plus `before_agent_start`, the way
  the host does): without a lease the handler returns after the name-only denial, so the case would be asserting
  against a call path the control never sees. Two host tests learned this the hard way.

### 6. Wrong vs Correct

Wrong: put a mandatory check in a callback the provider may skip, or treat "no decision" as allow.

Correct: one pre-execution, parameter-level boundary the loop always calls, with the reason and the
remediation written into the tool result.

## Scenario: Authority Grant Graph

### 1. Scope / Trigger

Trigger: any work that acts on a target belonging to someone else - penetration testing above all.

### 2. Signatures

```typescript
// src/core/authority.ts
function validateAuthorityDocument(d: AuthorityDocument): string | undefined;
function preflightAuthority(d: AuthorityDocument, at: string, o?: { evidenceDigests?: Record<string,string> }): AuthorityDecision;
function evaluateAuthority(d: AuthorityDocument, r: AuthorityRequest, o?: AuthorityOptions): AuthorityDecision;
```

### 3. Contracts

- The document is `{ version, engagement, principals, grants, targets }`. A grant carries `from`
  (never the operator), `authorizes` (`actions` **and** `outcomes`), `targets`, `window`,
  `evidence`, `constraints` (`intensity` per phase, `excluded_techniques`), `external_state`, and
  `risk_acceptance`.
- A target carries `ownership_evidence` and `requires_grants`; **every** required grant must resolve.
- A grant is evidenced by a signed document **or** an approved external authorization; neither means an
  unauthorized grant. Unknown keys are rejected at the document, grant, and `authorizes` levels - a
  silently ignored key is a silently absent constraint.
- **The agent must not be able to write its own authority**: documents live outside every capability
  granted to the agent.
- `preflightAuthority` runs before the first action, so a missing authorization stops the engagement
  before its first attempt.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Unknown target | Block; an unknown target is never in scope |
| Ambiguous target (id and address both match) | Block |
| Ownership evidence absent or digest mismatched | Block |
| Required grant missing from the document | Block |
| Grant issued by the operator | Block |
| Action not authorized, or target not covered | Block |
| Outside the window; excluded technique; over-ceiling intensity | Block |
| `external_state` not `approved`, or `checked_at` stale | Block |
| Unknown key anywhere in the document | Block, naming the key |

### 5. Tests Required

- Each row of the matrix above, with the reason naming the specific unsatisfied condition.
- The example engagement pre-flights clean.
- A document with a key nested in the wrong place is rejected by name.

### 6. Wrong vs Correct

Wrong: `in_scope` returning `true` for an empty scope, so a run without a scope has no gate.

Correct: an absent or unresolvable boundary is a load-time failure, and every unsatisfied condition
blocks with the reason and the remediation.

## Scenario: Effect Identity and Exactly-Once

### 1. Scope / Trigger

Trigger: any action with a side effect that a retry or a resume could duplicate.

### 2. Signatures

```typescript
// src/core/effect-ledger.ts
function deriveEffectKey(i: DeriveEffectKeyInput): string;
function toClientOrderId(effectKey: string, o?: ClientOrderIdOptions): string;
function createEffectLedger(o: { engagement: string; store: EffectStore; now?: () => string }): EffectLedger;
function dispatchOnce<T>(l: EffectLedger, r: Omit<EffectRecord,"startedAt">, execute: () => Promise<T>, o?: { retryPriorAttempt?: boolean }): Promise<{ executed: boolean; value?: T; existing?: EffectRecord }>;
```

### 3. Contracts

- The effect key is derived from engagement + mode identity + tool + target + arguments digest, with an
  optional explicit key (a client order id) taking precedence.
- Consume-once is an **atomic `claim`** in the store, never a read-then-write: the window between a
  check and a write is where a cross-host duplicate lands.
- `dispatchOnce` **skips by default** when a prior attempt exists, completed or not. Re-dispatching an
  ambiguous attempt requires `retryPriorAttempt`, and is only safe when the effect key is an
  idempotency key **the backend honours**.
- The durable guarantee lives in the tool/backend contract, not the loop: the harness barely affects
  duplicate behaviour, while the contract explains most of it.
- `toClientOrderId` maps the identity onto a venue-safe id so the venue, not only the framework, can
  reject a duplicate.
- A ledger refuses a record whose engagement differs from its own.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Effect already completed | Not re-dispatched |
| Claimed but not completed | Not re-dispatched unless the caller opts in |
| Prior attempt failed | Not retried unless the caller opts in; a failure may have landed |
| Concurrent resumers of one effect | **At most one executes**; the claim is atomic in the store. The guarantee is **at-most-once dispatch from our own resumption paths** - never exactly-once, which requires the backend to enforce the key the tool forwards |
| Claimed, then the process died | Reads as `unknown`, which is a state rather than an error: an interrupted dispatch wrote no outcome, and the ledger must be able to say that instead of choosing between `completed` and `failed` |
| Record from another engagement | Refused |
| Agents report success after duplicating | Self-reported success is not evidence; the ledger is |

### 5. Tests Required

- The same logical effect derives the same key; any component change derives a different one.
- A completed effect is not re-dispatched; an ambiguous one is skipped by default and retried only on
  opt-in.
- Several concurrent resumers produce exactly one execution.
- The venue rejects a duplicate the framework's own ledger did not see.
- A record from another engagement is refused.

### 6. Wrong vs Correct

Wrong: `if (await store.has(key)) return; await store.record(key);` - the gap is the duplicate.

Correct: one atomic claim, default to not duplicating, and make the identity an idempotency key the
backend enforces.

## Scenario: Evidence Plane and Action Checkpoint

### 1. Scope / Trigger

Trigger: emitting findings, recording what an agent did, or resuming a long run.

### 2. Signatures

```typescript
// src/core/evidence-sarif.ts
const FINGERPRINT_KEY = "doveFinding/v2";      // v1 included the path; see the contracts
const CONTENT_HASH_KEY = "doveContent/v2";
function contentHashOf(f: Pick<Finding,"category"|"existingCode">): string;   // path-free
function fingerprintOf(f: Pick<Finding,"category"|"existingCode">, occurrenceIndex?: number): string;
function toSarifLog(findings: readonly Finding[], o: SarifRunOptions): SarifLog;   // o.baseline?: SarifBaseline
function baselineOf(log: SarifLog): SarifBaseline;
// src/core/checkpoint.ts
function captureCheckpoint(i: CaptureCheckpointInput): ActionCheckpoint;
function restoreCheckpoint(c: ActionCheckpoint, shape: GraphShape): RestoreResult;
```

### 3. Contracts

- **Two hashes, not one.** A hash over `path | category | code` cannot tell a move from an edit.
  `contentHashOf` is **path-free**, making a move observable; `fingerprintOf` adds an **occurrence
  index**. Semgrep ships six identity hashes; `github/codeql-action` hashes content only.
- **The occurrence index is inside the identity.** Without it, two findings of one category on
  identical code in one file collapse into one and a real defect is lost. It counts earlier findings
  sharing the same `(category, normalizedCode)`, in path, start-line, end-line order.
- **A finding's identity never includes the message**, which is prose and varies between runs, and
- **never includes the artifact path**, so a finding that moves keeps its identity.
- **`baselineState` carries all four schema values**: `new`, `unchanged`, `updated`, `absent`.
  Matching is **tiered and deterministic; no model decides identity**:

  **Pass one decides every same-path case, and completes for the whole run before pass two.**

  | Pass | Rule | State |
  |---|---|---|
  | one | same content hash at the **same** path | `unchanged`, whatever the occurrence index |
  | one | same `(category, path)`, content differs | `updated` |
  | two | exact fingerprint anywhere in the baseline | `unchanged`, and a differing path records the move |
  | two | same content hash at a different path | `unchanged` at the new location, move recorded |
  | - | a baseline entry matched by no tier | `absent`, emitted so the resolution is visible |
  | - | a finding matched by no baseline entry | `new` |

  The split is not a performance choice. Deciding same-path cases first stops a new copy of existing
  code from claiming the original (reported `new`), and stops an in-place edit being narrated as a move
  from another file, which would leave the truly deleted finding with no result of its own.

  **Every tier keeps all of its candidate baseline indices**, not just the first: otherwise a file with
  several findings has only one reachable by the same-path tier, and the rest read `absent` while their
  counterparts read `new`.
- **`baselineOf` is a pure derivative of a SARIF log**, so no side channel is needed, and it skips
  `absent` results - otherwise a deletion would be re-reported on every subsequent run.
- **A known limit, stated.** A finding that **moves and is edited in one run** reads as one `new` plus
  one `absent`. Resolving it needs a similarity match, trading a false `new` for a false match - worse in
  an audit, where a false match suppresses a real finding. That is the price of content-over-location
  identity.
- The key bump from v1 to v2 is **breaking on purpose**. v1 and v2 are not comparable, and the
  version is how a changed derivation becomes visible rather than silently producing a wall of new
  findings.
- The SARIF log is 2.1.0 and carries `partialFingerprints`, `baselineState`, `occurrenceCount`, and a
  `rank` derived from severity.
- The checkpoint unit is **an effect admitted and completed**, not a model turn. Only `completed`
  effects are recorded: a blocked one never ran and a failed one is ambiguous.
- A checkpoint carries a **graph signature** (mode + sorted tool names + gate) and **explicit
  lineage**. Resuming under a changed shape is refused.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Message reworded between runs | Identity unchanged |
| Finding moved to another path | Identity unchanged; `unchanged` at the new location, with the move recorded |
| Matched code edited in place | `updated` |
| Finding deleted | `absent`, naming the artifact; never silence |
| Two same-category findings on identical code in one file | Two identities, neither lost |
| Several findings in one file, some edited | Each edited one `updated`, the rest `unchanged`, **nothing `new`** |
| Reindentation only | Identity unchanged |
| Finding in the baseline, matched by tier 1 | `baselineState: unchanged` |
| Checkpoint resumed under a different mode version | Refused |
| Tool set or gate changed since the checkpoint | Refused |
| Empty or headerless ledger read for the axis | Ratios `undefined`; never a perfect score from no evidence |

### 5. Tests Required

- A reworded message and a move both keep the identity; a changed category or code does not.
- An edit in place reads `updated`; a deletion reads `absent`; an addition reads `new`.
- Several findings in one file, two of them edited, produce updates and no invented findings.
- Two identical matches in one file stay two results, not one with a count.
- Two runs over the same tree are byte-stable.
- Only completed effects enter a checkpoint; the signature ignores tool registration order.
- Restore refuses a mode-version, tool-set, or gate change.

### 6. Wrong vs Correct

Wrong: fingerprint the message, so every re-run is a wall of spurious new findings. Or fingerprint
the path as well, so every move reads as a new finding plus a silent disappearance. Or emit only
`new` and `unchanged`, so a deletion and an edit are indistinguishable from each other.

Correct: hash the content for locality and the content plus an occurrence index for identity, match
the baseline in cheap deterministic tiers, and report all four states.
## Scenario: Context Admission

### 1. Scope / Trigger

Trigger: anything that puts tool output, extension text, or background notifications into model-visible
content.

### 2. Signatures

```typescript
// src/core/context-admission.ts
type AdmissionChannel = "tool_result" | "extension_message" | "background_notification";
function admit(request: AdmissionRequest, options?: ContextAdmissionOptions): Promise<AdmittedContent>;
function isNonActionablePath(path: string): boolean;
```

### 3. Contracts

- **One boundary, all three channels, no exemption.** A boundary that only guards `tool_result` has a
  documented way around it.
- Oversized content is replaced by source, channel, digest, omitted size, line count, and an artifact
  reference. The raw payload is **absent** from model-visible content, not truncated-and-included.
- Generated and dependency trees are not delivered as actionable context, even when small.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Content over the limit | Compacted; digest and omitted size retained; payload absent |
| Any channel over the limit | Same treatment |
| Path under a generated/dependency tree | Marked non-actionable regardless of size |
| No artifact sink configured | Payload still absent; digest still retained |
| Content under the limit and actionable | Passed through unchanged |

### 5. Tests Required

- A synthetic oversized background diagnostic is compacted, and a marker placed past the head window
  is **absent** - "truncated" and "absent" are different guarantees.
- All three channels are compacted by the same boundary.
- A dependency-tree diagnostic is non-actionable even when short.
- Path classification does not over-reach on authored paths.

### 6. Wrong vs Correct

Wrong: compact only `tool_result`, and include a truncated head of everything else.

Correct: one boundary for every channel, with the payload omitted and reachable only by reference.

## Scenario: Capability Scoping

### 1. Scope / Trigger

Trigger: granting or checking authority to act on a resource.

### 2. Signatures

```typescript
// src/core/capability-scope.ts
interface Capability { readonly id: string; readonly resource?: string; readonly expiresAt?: string; }
function createCapabilityScope(o: { sets: readonly AgentCapabilitySet[]; now?: () => string }): CapabilityScope;
// scope.authorize({ agentId, capability, resource? }): CapabilityDecision
// scope.narrow(parentAgentId, child): AgentCapabilitySet
```

### 3. Contracts

- The ceiling is derived from **trusted input**, before untrusted content is read.
- Capability sets are stored **outside the model's context**; the exported surface is exactly
  `{authorize, capabilitiesOf, narrow}`, so there is no path that renders them into prompt text.
- Every check is against the capabilities of the **issuing** agent, so a delegated subagent cannot
  borrow its parent's authority by existing.
- A delegate may **narrow, never widen**. Anything the containment check cannot decide is refused.
- The resource pattern language is two forms only: an exact string, or `P/**` meaning `P` and anything
  beneath it. An unrecognised pattern is refused rather than interpreted.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Agent holds the capability for the resource | Allow |
| Agent does not hold it | Deny, naming what is held instead |
| Agent has no capability set | Deny; an unknown agent is never authorized |
| Capability expired | Deny |
| Delegate requests a capability or resource the parent lacks | Refused as widening |
| Pattern not in the two supported forms | Refused |

### 5. Tests Required

- An injected instruction cannot invoke a capability the issuing agent lacks.
- A capability granted to one agent is not available to another.
- Narrowing succeeds; widening, including a broader resource claim, is refused.
- An expired capability is denied.
- The exported surface has no prompt-rendering path.

### 6. Wrong vs Correct

Wrong: treat naming a resource as authority, so injected text can name anything.

Correct: a typed capability held outside the model's context and checked against the issuing agent.