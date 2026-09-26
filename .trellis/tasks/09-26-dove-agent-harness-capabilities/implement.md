# Implementation plan

## Preconditions

- `design.md` and this file exist; `prd.md` carries AC1-AC8.
- Research is complete: 20 files in `research/`. **Read `design-constraints-from-evidence.md` first** -
  it is the seven constraints everything else must satisfy. Then `exactly-once-premise-correction.md`,
  which changes what the effect ledger may claim.
- The gate is: `npm run typecheck` clean, `npm test` green, and **every module the harness relies on is
  reachable from an entry point**.

## M0. Reachability as a test, before anything else

Nothing else can be verified while the defect that started this task - a module nothing reaches - has no
detector.

1. A test that walks relative imports from the four entry points and fails if any module under `src/core/`
   is unreachable **unless it is listed in an explicit allow-list with a reason**.
2. The allow-list starts with today's 12, so the test is green on arrival and **turns red as M1-M4 wire
   them**. Removing an entry is the definition of done for that module.

   The 12, re-derived independently on 2026-09-26 and matching `research/ground-truth-what-runs.md` exactly:
   `loop.ts`, `loop-runner.ts`, `gate-limit.ts`, `gate-conformance.ts`, `work-mode.ts`, `authority.ts`,
   `capability-scope.ts`, `effect-ledger.ts`, `checkpoint.ts`, `context-admission.ts`, `dispatcher.ts`,
   `dispatch-policy.ts`. Two further modules are unreachable outside `src/core` -
   `adapters/loop-pi-agent-core.ts` and `adapters/loop-scripted.ts` - and belong in the same allow-list.
3. **Normalize `..` when resolving a specifier, and assert the reachable count too.** The first attempt at
   the re-derivation did not, and reported 24 unreachable instead of 12 - all 12 extras false positives -
   with exit status 0 either way. An assertion on the unreachable set alone cannot tell a broken walk from a
   clean tree.

**Validate**: the test passes now, and fails if an entry is removed from the allow-list while the module
stays unwired.

## M1. The effect claim at the dispatch line

**Wiring point: `src/core/loop-runner.ts:135`**, the only site that runs a tool. **Not at an approval
boundary** - an approval gate re-executes whatever sits before it.

1. `EffectOutcome` gains `"unknown"`. Today it is `"completed" | "failed" | "cancelled"`, so "in flight"
   cannot be expressed and the checkpoint's "only completed effects count" rule has to guess.
2. `EffectClass` per tool: `"idempotent" | "key-idempotent" | "non-idempotent"`; only the first two
   automatically retryable.
3. **One atomic claim** - compare-and-swap or a unique constraint - in a store **shared across hosts**. The
   in-memory store's own docstring says it is "atomic only within one JavaScript realm; the duplicate it is
   meant to prevent crosses hosts". **A real store is the point of this milestone.**

   **Decided 2026-09-26 - do not re-litigate this, the evidence is in
   `research/effect-claim-store-evidence.md`.** The store is a directory of claim files under the project
   state root; the claim is the **exclusive create** of that file (`openSync(path, "wx")`, verified to raise
   `EEXIST` on this runtime), never a read followed by a write. Record states are
   `in_flight | completed | failed | cancelled | unknown`, and `unknown` is reached by construction: a crash
   between the create and the outcome write leaves `in_flight` with no outcome.

   **Two rules that are easy to get wrong, both stated in the design:**
   - **Do not reuse `project-provider/lock.ts`'s staleness reclamation.** That lock deletes a lock older
     than ten minutes and retries; copying it here would re-execute an effect whose outcome is unknown. A
     claim with a dead owner is surfaced as `unknown` and never reclaimed.
   - **Claim the run in a second process in the test, not just a second call in one process.** The failure
     this milestone prevents is cross-process, and it is the one the in-memory store cannot express.
4. The claim is taken **before** dispatch; a second attempt is refused and **reported**, not silently
   skipped.
5. **Documentation changes**: the module stops describing itself as an exactly-once primitive and states
   **at-most-once dispatch from our own resumption paths, plus a key the tool must forward**.

**Validate**: a test that dispatches the same effect twice within one process **and once in a second
process** reaches the tool once, refuses the others, and records `unknown` for an interrupted run.

### M1 record, 2026-09-26  **[DONE]**

Implemented: `EffectOutcome` gains `unknown` and the module stops calling itself an exactly-once primitive;
`EffectClass` with `effectClassOf` failing safe to `non-idempotent` and reporting `declared: false`;
`isAutomaticallyRetryable`; `ClaimResult.unreadable`; `EffectKeyConflictError` for one key carrying two
payloads; `EffectRetryRefusedError` for a retry opted into without a retryable class; `EffectLedger.outcomeOf`
so an interrupted run reads `unknown` rather than absent or failed; `createFileEffectStore` (exclusive create,
`fsync` before the claim is returned, write-then-rename on completion, and a dead owner's claim never
reclaimed); and the claim wired at `loop-runner.ts:135` with refusals reported through the new
`LoopOutcome.refusedEffects`.

**Two findings, and both are about the plan rather than the code.**

1. **No milestone in this task makes the reference loop reachable, so M1's wiring point is exercised by tests
   only.** M2, M3 and M4 wire the host's hooks and the host's own startup path, and the host runs its own
   loop. This was not inferred: adding `src/core/effect-store-file.ts` turned M0's reachability test red and
   the test named exactly that module - M0 working as intended, and the plan's gap stated by it.
   **AC8 says every module the harness relies on must be reachable from an entry point**, so the effect
   boundary needs a second adapter on the host's `tool_call` / `tool_result` hook pair - claim before, refuse
   when already claimed, complete after - which `research/host-hook-surface-verified.md` establishes both
   hooks can carry. That is the same "one policy, two adapters" shape M2 already uses for the gate. It is
   **not in this milestone's scope as planned**, and it is raised with the user rather than absorbed.

2. **This layer cannot promise cross-host exclusion, and the code now says so instead of implying it.** The
   store's docstring states the bound (one host, a local filesystem) and cites why every candidate primitive
   fails across a mount; `effect-ledger.ts` no longer calls itself an exactly-once primitive. AC5 is the
   reason that is a finding and not a footnote.

**Validation (all run):**

```text
node --import tsx --test tests/harness-effect-claim.test.ts  -> tests 13 / pass 13 / fail 0
node --import tsx --test tests/harness-reachability.test.ts  -> tests  6 / pass  6 / fail 0
node --import tsx --test tests/effect-ledger.test.ts         -> tests 10 / pass 10 / fail 0

npm run typecheck -> 0 errors
npm test          -> tests 515 / pass 513 / fail 0 / skipped 2   (502 after M0, +13)
```

**One test change, with its reason.** The two opt-in retry tests in `effect-ledger.test.ts` now pass
`effectClass: "key-idempotent"`. Their assertions are unchanged; what changed is that the declared class,
rather than the caller's belief, is what makes the retry safe - which is what those tests were always
asserting in their own names ("because the backend's key makes it safe"). Before this, the opt-in alone was
accepted, which is the substitution this contract exists to prevent.

## M2. The gate, behind the callback the host already calls

**Seam: `src/pi-adapter/extension.ts:1333`**, already fail-closed, already receives `args`.

1. Compose `gate-limit` and `gate-conformance` behind that callback.
2. **Deny is evaluated independently of allow and wins** (C3). Codex's "deny beats write, write beats read"
   is the precedent; Claude Code's `EndConversation`, which skips `PreToolUse` entirely, is the
   counter-example. **Check `loop.ts` for an override path** - C3 is unverified and this is where it is
   verified.
3. **A gate that cannot evaluate blocks.** Already the behaviour at `fast-path.ts:51`; the new gates must
   not weaken it.
4. **Record the refusal** with its reason. `capability.blocked` already exists on this path.

**Validate, end to end and not in a unit test**: an order above its declared limit is refused; a target
outside the authority document is refused; both refusals appear in the ledger with their reasons.

**Prerequisite, landed 2026-09-26:** the limits and effect classes this milestone gates against are now
validated and exposed by the mode loader, and the trading thresholds come from
`modes/trading/governance.yaml` rather than a test - see the M3 prerequisite record. **This milestone cannot be
observed end to end until M3's load lands**, because the limits and the authority document are mode content and
the host has neither today.

### M2 record, 2026-09-26  **[IN PROGRESS - the limit half has landed at the host]**

Landed: **the limit gate at the host's `tool_call` boundary**, built once at session start from the loaded
mode's declared limits (a gate rebuilt per call is a gate whose thresholds can differ between two identical
actions), and **a `gate.refused` record in the execution ledger** carrying the tool, the action, the gate, the
reason and the remediation. The action mapping grew the other half of itself: a policy reads **a capability's
own arguments**, not the envelope that carries them, because a mode declares a limit as a path into the
action's payload (`order.notional`) and `{name, args}` is the transport's business.

**Four findings.**

1. **The gate is evaluated after every input mutation in the handler, and that placement is the requirement.**
   The host re-validates nothing after a mutation (`types.d.ts:703-708`), and this handler mutates `event.input`
   twice before dispatch (`applyAdaptiveShellTimeout`, `normalizeLsToolInput`). A gate placed at the top of the
   handler would have permitted something other than what runs. The reason is now in the code at the call site,
   not only in the research file.
2. **The gate sits behind a pre-existing boundary: `tool_call` returns early without an active request lease.**
   So the limit gate applies inside a Dove-managed request and not outside one. The mode's *refusal* and *deny*
   checks are deliberately before that early return, so a broken mode still stops an unmanaged call. Stated
   because it decides when the gate can fire at all - and because the host-level test had to establish a
   request before the assertion meant anything.
3. **\"Both refusals appear in the ledger\" needed a new ledger event, not a reuse.** `capability.blocked` is a
   capability-invocation refusal with capability-shaped details; a gate refusal happens at the pre-tool-call
   boundary and covers every tool. They are now separate kinds, and the `kind` union is a named type in
   `contracts.ts` so the append methods and the projection cannot drift from it.
4. **The conformance half is blocked on two things, and neither is code.** There is **no loader for an authority
   document** (only `validateAuthorityDocument`), and *nothing in the design says how a tool call resolves to a
   target* - `AuthorityRequest.target` must name a target the document declares (`t-web`), while a host tool call
   carries a command or a path. code-audit makes it sharper: its `authority.grant` is a bare name
   (`local-review`) with no document behind it at all, while its `gate.semantics` says `conformance`. Raised with
   the user rather than invented.

### M2's conformance prerequisite, landed 2026-09-26  **[DONE]**

Landed: **a mode declares its authority target argument** (`gate.target_argument`, option 1 of the three put to
the user) and **a conformance mode must resolve its grant document or refuse to load**. The document is parsed
with **both** checks (structural and unknown-field) and resolved relative to the workspace, and the host holds
the loaded document for the run rather than re-reading it per action.

**Four findings.**

1. **There was no loader for an authority document - only a validator over an object someone had already
   parsed.** So the structural checks were done nowhere: a document missing `grant.targets` parses, validates
   (unknown fields are all fine), and then `undefined` comparisons quietly fail at evaluation time. That is the
   same defect the unknown-field check exists for, approached from the other side, so `parseAuthorityDocument`
   names both a missing key and an unknown one, with the file it came from.
2. **The fail-closed rule has teeth, and the consequence is pinned rather than surprising.** Requiring a
   document means **`modes/code-audit` now refuses to load**: it declares `gate.semantics: conformance` and its
   `authority.grant` is the bare name `local-review`, so there is nothing an action could be checked against.
   The refusal names both ways out (point the grant at a document, or declare `gate.semantics: limit`), and a
   test pins it. **The mode was not silently changed and no document was fabricated for it**: an honest
   code-audit document needs `ownership_evidence` with a real `sha256`, and inventing a digest is exactly the
   false-evidence defect this project refuses. That is a content decision for the user.
3. **`authority.ts` left the reachability allow-list**, the second time the list has shrunk, and again the
   assertion is what noticed - the mode loader now resolves the document, so the module is reachable from the
   host.
4. **`targetArgument` is declared and validated, and nothing reads it yet.** Stated as a pending consumer
   rather than as a wired control: the conformance gate that reads it is the next step, and until then the
   mode's target argument is a declaration with no runtime effect.

**Validation (all run):**

```text
node --import tsx --test tests/host-work-mode.test.ts -> tests  7 / pass  7 / fail 0   (+1: the pinned code-audit refusal)
node --import tsx --test tests/work-mode.test.ts      -> tests 30 / pass 30 / fail 0   (the real pentest mode loads with its document)
node --import tsx --test tests/harness-reachability.test.ts -> tests 6 / pass 6 / fail 0   (allow-list 11 -> 10)

npm run typecheck -> 0 errors
npm test          -> tests 541 / pass 539 / fail 0 / skipped 2   (540 before, +1)
```

### M2 record, part two, 2026-09-26  **[DONE]**

Landed: **`src/core/action-policy.ts`, the one policy a mode's controls add up to**, with **two entry points** - not
one - because they have different input requirements. `denyDecision` reads a tool name and nothing else, so the
host calls it before the lease check and before the handler finishes shaping the call; `evaluate` reads the
**arguments**, so the host calls it after every mutation of `event.input`. The order lives in the policy: **deny
first and independently**, then thresholds, then the contract, and anything unevaluable is a block. Conformance's
request is built from the mode's `target_argument`, and **the evidence digests are computed by reading the files
the document names** - the document carries the digest it expects, and supplying the one the file has is what
makes it a check. An unreadable reference is left unsupplied rather than given a placeholder, so the authority
stays the only decider of whether a grant resolves.

**M2's validation is met:** an over-limit action and an out-of-authority action are both refused **at the host's
`tool_call` boundary**, and **both appear in the execution ledger** as `gate.refused` with `gate: "limit"` and
`gate: "conformance"` respectively.

**Four findings.**

1. **The shipped pentest mode declared no `target_argument`, so its conformance gate refused every capability
   call** with "could not be mapped to an action and target". The host test found it by asserting the *reason* and
   not only the block. `target_argument: target` is now declared and the mode moves **1.0.0 -> 1.1.0**, because a
   mode's authority changed. **A gate whose mapping is undeclared refuses everything - fail-closed and useless at
   the same time**, which is worth stating out loud: "fail-closed" alone would have looked healthy.
2. **The example engagement can never authorize anything.** Its evidence digests are placeholders (`"aaaa"`,
   `"bbbb"`), so the authority blocks on a digest no file can match. That behaviour is correct, and it means the
   example is a shape to copy rather than an engagement to run - recorded so that "the mode loads" is not read as
   "the engagement works".
3. **`gate-conformance.ts` left the reachability allow-list** - the third shrink, and again the assertion is what
   noticed.
4. **C3 holds at the host by construction, and is unverified where the plan asked.** The policy's denial is
   evaluated first and returns, so no allow channel can override it. The plan's "check `loop.ts` for an override
   path" concerns the **unreachable reference loop**, and it has not been checked there. Stated rather than
   implied - and it is part of the same gap M1 left.

**Validation (all run):**

```text
node --import tsx --test tests/action-policy.test.ts     -> tests  7 / pass  7 / fail 0   (new: the policy, including an in-scope grant that verifies)
node --import tsx --test tests/host-work-mode.test.ts    -> tests  8 / pass  8 / fail 0   (+1: the conformance refusal and its ledger record)
node --import tsx --test tests/pentest-mode.test.ts      -> tests 13 / pass 13 / fail 0
node --import tsx --test tests/work-mode.test.ts         -> tests 30 / pass 30 / fail 0
node --import tsx --test tests/harness-reachability.test.ts -> tests 6 / pass 6 / fail 0   (allow-list 10 -> 9)

npm run typecheck -> 0 errors
npm test          -> tests 549 / pass 547 / fail 0 / skipped 2   (548 before the pentest mapping fix, +1)
```

### M1's reachability gap, closed 2026-09-26  **[DONE]**

The claim now sits on the host's own hooks: **`tool_call` takes it** (after the action policy and on the final
input, because the identity is derived from the arguments that will be dispatched) and **`tool_result` completes
it**. The store lives at `<workspaceRoot>/.dove/effects`, the engagement is the authority document's engagement
(or `local:<modeId>` when there is no document, named as such rather than left blank), and
`effect-store-file.ts` **left the reachability allow-list** - the fourth shrink - so M1's AC8 now holds for
everything the host actually runs.

**The finding that decided the design, and it is a design finding rather than a bug: an argument-derived effect
identity cannot tell a replay from a deliberate repeat.** A model that reads the same file twice, or runs the same
check twice, produces the same key twice, and both are legitimate. Refusing those would break ordinary work while
looking like containment - the worst shape a control can take. So the claim is scoped to **the resumption path it
exists for**:

- on the **0th attempt** it always dispatches. There is no earlier attempt to duplicate, so a refusal there is a
  false positive by construction.
- on a **later attempt of the same request** it refuses, **unless** the mode's declared class says a second run is
  harmless. That is what the class is *for*, and it is the reason `key-idempotent` and `idempotent` are separate
  from `non-idempotent` rather than all being refused.
- a claim whose record **cannot be read** is refused on any attempt: it is the one state where both guesses are
  wrong.

**Three further findings.**

1. **Under a conformance mode, every raw tool call is now refused.** `bash`, `read` and `edit` carry no `target`, so
   the request cannot be mapped and "cannot tell" is a block. This was found by trying to write the host test for
   the effect boundary under pentest. **It is a containment-versus-usability fork and it is raised with the user
   rather than decided here**: either raw tools are exempt from conformance (they are covered by the permission
   list and the limits), or each mode must declare how each tool maps to an action and a target.
2. **The `loop.ts` override question is answered, and the answer is that it is vacuous there.**
   `createAgentLoop`'s `decide` consults **one** gate, so "deny must beat allow" has no channel pair to arbitrate.
   The real arbitration is in the action policy, where the denial is evaluated first and returns. Separately,
   `options.gate === undefined -> allow` is a **deliberate fail-open default**, documented at `loop.ts:148` as
   "never omit in production" - so C2 holds for a gate that cannot evaluate, and does **not** hold for "no gate
   configured", in both the loop and the host. Stated rather than implied.
3. **The reference loop still holds a claim nothing reaches.** `loop-runner.ts` remains on the allow-list, and that
   is now the *only* place the at-most-once primitive is exercised by tests alone. AC8 is satisfied for the host
   path; whether the reference loop should exist at all is the same question M1 raised.

**Validation (all run):**

```text
node --import tsx --test tests/effect-boundary.test.ts   -> tests  8 / pass  8 / fail 0   (new: the claim's scope, including the deliberate repeat)
node --import tsx --test tests/host-work-mode.test.ts    -> tests  9 / pass  9 / fail 0   (+1: claim taken at the boundary, completed by the result)
node --import tsx --test tests/harness-reachability.test.ts -> tests 6 / pass 6 / fail 0   (allow-list 9 -> 8)

npm run typecheck -> 0 errors
npm test          -> tests 558 / pass 556 / fail 0 / skipped 2   (549 before, +9)
```





**Validation (all run):**

```text
node --import tsx --test tests/host-work-mode.test.ts -> tests  6 / pass  6 / fail 0   (5 before, +1: the limit refusal and its ledger record)

npm run typecheck -> 0 errors
npm test          -> tests 540 / pass 538 / fail 0 / skipped 2   (539 after M3's load, +1)
```

## M3. The mode, loaded by the host

**Wiring point: the host's startup path.** `work-mode.ts` is unreachable today.

1. The host loads `modes/<name>/` at startup: capabilities, authority document, limits, effect classes.
2. A mode that fails validation **refuses to start** rather than starting unconstrained.
3. `modes/code-audit/` becomes the first real load, and the existing permission policy gets its **runtime
   consumer** - today `loadWorkMode` and `evaluatePermission` are test-only.

**Validate**: delete a capability from the mode and observe the running agent lose it; corrupt the mode and
observe a refusal to start.

### M3 prerequisite, landed 2026-09-26  **[DONE]**

M3 says the host loads "capabilities, an authority document, **limits**, and **effect classes**". The loader
accepted `gate.limits` as a field and **never read it**, and had no effect-class concept at all, so neither was
available to load. That is fixed ahead of M3 rather than inside it, because the mode files already write
against this schema:

- `WorkMode` carries `limits: readonly LimitSpec[]` and `effectClasses: Readonly<Record<string, EffectClass>>`,
  both validated at load.
- `gate.limits` is parsed in the shape the mode files **already declare**: a mapping keyed by limit id, which is
  what `modes/trading/governance.yaml` contains. A limit with neither bound, a non-finite bound, an unknown
  field inside a limit, an empty id, and an inner `id` are each a **load** error naming the mode.
- `governance.effects.classes` is new: design 5.4 requires the map and nothing carried it. An unrecognised
  class value is refused by name rather than defaulted, because the default is the dangerous direction.
- `LimitSpec` gained `tools`, because `LimitGateOptions.tools` scopes the whole gate and cannot separate two
  limits that belong to two different actions.
- `modes/code-audit/governance.yaml` declares its effect classes and moves **1.3.0 -> 1.4.0**: the map changes
  what the mode authorizes, which is the convention `code-audit-mode.test.ts` asserts.

**Four findings.**

1. **A declared field was never read, so the threshold lived in a test.** `trading-mode.test.ts` built its limit
   gate from a hardcoded array while `modes/trading/governance.yaml` declared the same thresholds in the file a
   reviewer reads. The test now builds the gate from the loaded mode's `limits` and asserts where they came from.
   **That is this task's defect class, found inside a test fixture.**
2. **The declared shape is a map keyed by id; the first parser assumed a list, and the data corrected it.** A
   list is now refused with a message naming the expected shape, because an inner `id` would be a second name
   for a limit its key already names.
3. **M2 depends on M3, and the plan lists them the other way round.** M2's validation is "an order above its
   declared limit is refused; a target outside the authority document is refused" - and both the limits and the
   authority document **are mode content**. The host has neither today: `extension.ts` contains no reference to
   `authority`, `limits` or `work-mode`. So M3's load lands first, and M2 is observed end to end after it.
4. **Which mode the host loads is still open.** The workspace policy offers `development | pentest`; the mode
   directories are `code-audit | pentest | trading`. M3 says "`modes/code-audit/` becomes the first real load",
   which means either the workspace policy gains a mode, or `development` maps to one, or the mode is selected
   another way. **Raised with the user rather than assumed**, because it decides what a mode *is* in this
   product.

**Validation (all run):**

```text
node --import tsx --test tests/work-mode.test.ts       -> tests 21 / pass 21 / fail 0   (13 before, +8)
node --import tsx --test tests/code-audit-mode.test.ts -> tests 15 / pass 15 / fail 0   (14 before, +1 new test)
node --import tsx --test tests/trading-mode.test.ts    -> tests  7 / pass  7 / fail 0   (same suite, limits now loaded)
node --import tsx --test tests/gates.test.ts           -> tests 18 / pass 18 / fail 0   (17 before, +1)

npm run typecheck -> 0 errors
npm test          -> tests 525 / pass 523 / fail 0 / skipped 2   (515 after M1, +10)
```


### M3 record, 2026-09-26  **[IN PROGRESS - the load has landed]**

Landed: the loader's selection and directory reading (`resolveWorkModeSelection`, `loadWorkModeFromDirectory`,
`workModeRefusal`); the **host load at `session_start`**; the fail-closed refusal that blocks every tool call
while a declared mode is unreadable; and the `never_allow` consumer at `tool_call`, which needed the action
mapping in `src/pi-adapter/action-identity.ts` first. `bin/dove-pi.cjs` now exports
`DOVE_PI_FRAMEWORK_VERSION`.

**Five findings.**

1. **The permission sets named actions that do not exist, so the policy was inert.** `never_allow: [shell.exec]`
   never fired against the tool `bash`, because a mode names **Dove actions** while Pi names **tools**, and the
   umbrella capability tool carries its real action in `input.name`. Wiring `evaluatePermission` without the
   mapping would have produced `ask` for every tool - a control that reads as present and does nothing. The
   mapping is now one function, and the host-level test shows `shell.exec` being refused through
   `agent_run_capability`.
2. **`always_allow: read_*` still matches nothing real.** The capabilities are dotted (`repo.read`), so the
   pattern matches neither a capability nor the host's `read` tool. **Not rewritten here**: choosing which real
   action the author meant is a content decision in a security-relevant file, and inventing it would be the
   silent-rewrite defect. Recorded for the user, with the observation that the entry is currently inert.
3. **There was no framework version at runtime to check a mode's range against.** The launcher exports the
   package version as `DOVE_PI_EXTENSION_VERSION` and the extension consumes it as its *identity* version -
   a different number space that happens to agree until one of them moves. Added an explicit
   `DOVE_PI_FRAMEWORK_VERSION`; when it is absent the load is **refused naming the missing variable**, rather
   than compared against a wrong number or silently unchecked.
4. **`ask_before` is not consumed**, and the load now says so in a warning instead of leaving it implicit:
   `deny` is enforced, `ask` falls through. That is the remainder of this milestone's item 3, and an unstated
   gap is the defect this project keeps finding in configuration.
5. **M0's allow-list shrank for the first time.** Making `work-mode.ts` reachable from the host's startup path
   took `gate-limit.ts`, `effect-ledger.ts` and `loop.ts` off the list with it - fifteen entries to eleven - and
   the reachability test is what noticed, by asserting in both directions.

**Remaining in M3:** `capability-scope.ts` has no runtime consumer yet (item 1's "capabilities"), the
`ask_before` half of item 3, and item 1's "authority document" - the mode declares `authority.grant`, and
nothing loads that document yet, which is what M2's conformance gate needs.

**Validation (all run):**

```text
node --import tsx --test tests/host-work-mode.test.ts    -> tests  5 / pass  5 / fail 0   (new: the host, not a unit)
node --import tsx --test tests/work-mode.test.ts         -> tests 30 / pass 30 / fail 0   (21 before, +9)
node --import tsx --test tests/harness-reachability.test.ts -> tests 6 / pass 6 / fail 0   (allow-list 15 -> 11)

npm run typecheck -> 0 errors
npm test          -> tests 539 / pass 537 / fail 0 / skipped 2   (525 after the M3 prerequisite, +14)
```

### The conformance/raw-tool fork, resolved 2026-09-26  **[DONE]**

Option A, taken as the default because the alternative makes the pentest vertical unusable: **the authority document
authorizes actions and names targets, and a raw host tool call carries neither**, so conformance decides about
capability invocations and raw tools are governed by the permission list and the limits.

Two things changed to make that safe rather than convenient:

- **`evaluate` now evaluates the denial itself.** The two entry points exist so the host can run the name-only half
  *early* (where the arguments are not yet final); a caller that ran only `evaluate` would otherwise have silently
  skipped the deny list. A control a caller can forget is a control that will be forgotten, so the denial is now
  inside both.
- `ActionPolicy.evaluate` takes the source explicitly (`{ viaCapability }`) rather than reading it off the
  invocation: whether an action came from a capability or from a raw tool is a fact about the **host's** call path,
  and putting it into `GateInvocation` would move a host concept into the loop's own contract.

**The stated limit of option A**, recorded rather than implied by the gate's presence: a conformance mode's scope
containment covers its **capabilities**, not its shell. `bash` under a conformance mode is governed by the
permission list - which matches names and cannot see a target. A mode that needs more must declare how its tools
map to actions and targets; that per-tool table is **not built**.

**Validation (all run):**

```text
node --import tsx --test tests/action-policy.test.ts -> tests 9 / pass 9 / fail 0   (8 before, +2)

npm run typecheck -> 0 errors
npm test          -> tests 560 / pass 558 / fail 0 / skipped 2   (558 before, +2)
```

## M4. Admission: delegate, and supply the policy

1. **Do not build a compressor.** The host has spill/retention/pruning. This resolves the
   three-implementations problem: `context-admission.ts` becomes the **policy**, and either delegates or
   is removed.
2. Implement **stage one only** - tool-result clearing - and do not build a summarizer.
3. Ship the digest-plus-reference shape and, critically, **the belief invalidation**: when content is
   dropped, the harness's own cached beliefs about it are dropped too.
4. **Do not split a tool-call/result pair.** Removing part of a loop breaks Anthropic thinking-block
   checksums and makes the request API-invalid.
5. **Mask rather than remove**, for prefix stability.

**Validate**: an oversized tool result reaches the model as a digest plus a resolvable reference; the full
payload is retrievable; and a dropped result does not leave a cached belief behind.

### M4 scoping, 2026-09-26  **[IN PROGRESS - coordinates and the decision, before any edit]**

**`context-admission.ts` is not a stub.** It already has the thresholds, the generated/dependency path
classification, the digest-plus-artifact-reference marker, and - the point - a **sink interface that is already the
delegation point** (`ArtifactSink`). So "do not build a compressor" is satisfied by the module as written, and M4
is **wiring rather than building**.

**Two implementations of one contract, located:**

| | threshold | marker | full payload retrievable? |
|---|---|---|---|
| host: `extension.ts:2890` `compactToolResultContentWithMetadata` | `getToolResultCharBudget(toolName)`, per tool | `[tool result compacted for model context: omitted N characters; digest=...]`, head 75% + tail | through the host's `details` ("inspect the saved details") |
| Dove: `src/core/context-admission.ts` `admit` | one number, 8000 default | channel + source + digest + `artifact:` + classification, head only | only through the supplied sink |

Three differences, and each has to be decided rather than merged by accident: the **threshold** (the host's is
per-tool and cache-aware - it should stay and be passed in, not replaced by one number), the **marker shape**
(Dove's says *which channel* and whether the content is generated; the host's says neither), and the
**retrievability** (the host's details path against Dove's sink).

**The channel that matters most is not the tool-result one.** The recorded incident reached the model through a
**background/custom-message path that bypassed tool-result compaction** - 2,865,326 characters, about 95% of that
session's tool-result text. In the host that path is the custom message at `extension.ts:2694`; the admission
module names the channel `background_notification`. **Delegating tool-result compaction is the smaller half;
delegating the custom/background path is the half the incident is actually about**, and a boundary with one
documented way around it is what this exists to remove.

**Not yet decided, and it is the first thing to settle:** whether the host's `details` path is the sink - which
would make the artifact reference resolvable without new storage - or whether a real sink is needed. M4's
validation includes "the full payload is retrievable", so that question comes before the edit, not after it.

**Also carried from the design, not yet checked in code:** the **belief invalidation**. The extension holds
`doveContextPayloads`, and the design's finding is that the only implementation surveyed which invalidates its own
cached beliefs about dropped content (Claude Code deleting a file from `readFileState` after clearing a Read
result) is the one to copy. Whether that map is such a belief is unverified.

### M4's tool-result half, landed 2026-09-26  **[IN PROGRESS - one channel delegated, the incident's channel still open]**

The host's own compactor is **gone** rather than left sitting beside the policy: `compactToolResultContentWithMetadata`
and `compactToolResultContent` are deleted, replaced by `admitToolResult`, which calls the policy with the host's
per-tool threshold and maps the result back onto the host's shape so no caller changed. `context-admission.ts` left
the reachability allow-list - the fifth shrink, and the first module to leave because it **replaced** an
implementation rather than gaining a consumer.

**Correcting my own round-8 narration while recording this.** I said the host threw the full text away. It does
not: `extension.ts:2259` keeps it as `details.doveOriginalContent`. So the marker's "inspect the saved details"
was true, and the payload is **operator**-retrievable. What it was not is **model**-resolvable, and that
distinction is what decided the rest:

- **No artifact sink for the tool-result channel**, deliberately. A path the model can read invites it to pull the
  payload back into the transcript, and that read produces a tool result which would be admitted again - a
  spill, read, spill cycle. The host's continuation ("request a narrower range") has no such cycle, because a
  narrower query returns *less*.
- The policy gained the retention strategy with **head-tail as the default**: a head-only boundary compacts away
  the stack trace, the exit status and the `FAIL` line, and the host's own compaction had chosen head-and-tail for
  exactly that reason. A new test pins the tail and the `head` alternative.
- The policy gained a caller-supplied `continuation` line, because it is channel-specific: a tool result can be
  re-queried more narrowly, a background diagnostic cannot.

**A bug fixed on the way, in the policy rather than the host.** `maxCharacters` was a *threshold* while a separate
`headCharacters` decided retention, so the admitted form **exceeded the budget it claimed to respect**. The budget
is now a real bound: the fixed part of the marker is rendered first and the retained slice takes what is left.
`headCharacters` was removed rather than kept as a knob that can break the bound, and one admission test's
absolute bound (3000) came from that old retention default - it now asserts the property that holds: fits the
budget, and under 1% of the original.

**The classification is live for the first time.** The hook now passes the tool's `path` when it has one, so a
diagnostic for `node_modules/...` is marked "not delivered as actionable task context" - the classification the
recorded incident needed and did not get.

**Still not done, and it is the half the incident is actually about:** the **custom/background message channel**
(`extension.ts:2694`). A boundary that guards tool results and leaves that path open is the boundary the incident
went around.

**Validation (all run):**

```text
node --import tsx --test tests/context-admission.test.ts  -> tests  7 / pass  7 / fail 0   (6 before, +1)
node --import tsx --test tests/pi-adapter.test.ts         -> tests 32 / pass 32 / fail 0   (the compaction test rewritten)
node --import tsx --test tests/harness-reachability.test.ts -> tests 6 / pass 6 / fail 0   (allow-list 8 -> 7)

npm run typecheck -> 0 errors
npm test          -> tests 561 / pass 559 / fail 0 / skipped 2   (560 before, +1)
```

### M4's incident channel, landed 2026-09-26  **[DONE]**

The guard is at the **payload**, not at each producer: `admitNonConversationalMessages` walks the provider request
(whatever shape it takes - an array, `{messages}`, or `{input:{messages}}`, following the walker already in the
file) and admits every message that is **not** the conversation. What it leaves alone is an allow-list of
conversational roles (`user`, `assistant`, `toolResult`, `system`), so a channel nobody listed - including one Pi
adds later - is covered by default rather than exempt by default. That is the admission module's own rule ("one
boundary, every channel") applied where the channels actually converge.

**Two facts about ordering and identity, and the tests are what surfaced them.**

1. **It runs before the budget is accounted.** A payload that admission would have made fit must not be rejected
   for being too large: the reverse order turns a compaction into a rejection. `preparePayload` now takes the
   admitted payload, and so does the budget-fallback path - otherwise the huge message comes straight back.
2. **It preserves payload identity when it changes nothing**, and the pre-existing `registers modes, shortcuts,
   ...` test found this by failing: the handler decides whether to hand a modified payload back by comparing it to
   the original, so an equal-but-new object tells the host the request was rewritten when it was not. **A pass that
   claims to have changed something it did not is the same defect as a gate that claims to have checked something
   it did not** - introduced by this change and caught by a test written before it.

**A shape it refuses to guess at.** A message whose content cannot be replaced in a shape the host still
understands is left alone **and counted**, and the count is reported to the operator. Silently skipping it would be
an exemption of the kind this boundary exists to remove; silently rewriting an unknown shape would be worse.

**M4's channels are delegated. What is left of M4's list is the design's "belief invalidation":** the extension's
`doveContextPayloads` is a cache of its own injected context, and whether it is a belief *about dropped content*
(the thing Claude Code invalidates, and this design says to copy) remains unverified.

**Validation (all run):**

```text
node --import tsx --test tests/host-work-mode.test.ts -> tests 10 / pass 10 / fail 0   (+1: the incident channel)
node --import tsx --test tests/pi-adapter.test.ts      -> tests 32 / pass 32 / fail 0   (the identity regression it caught)

npm run typecheck -> 0 errors
npm test          -> tests 562 / pass 560 / fail 0 / skipped 2   (561 before, +1)
```


### M4 closed, 2026-09-26  **[DONE - the belief-invalidation item has no counterpart here]**

M4's third item asks for the belief invalidation the design's research singled out: when the harness drops content,
its own cached beliefs about that content must be dropped too (Claude Code deleting a file from `readFileState`
after clearing a Read result). The only candidate here was `doveContextPayloads`, and it is **not** such a belief.
The evidence, in full:

- Its **only writes** are inside the `context` transform that builds the current view (`extension.ts:2805-2812`), so
  it is a **derived index of the payload that exists now**, not a cache that survives a drop.
- It is **cleared before every rebuild** (`:2805`), at request end (`:2116`) and at session start (`:1825`) - nothing
  it holds outlives the view it describes.
- Its **only reader** (`:2531`) strips the very messages it indexes out of the **same** payload, so it cannot
  disagree with that payload in the direction the finding cares about.
- What Dove actually drops - oversized tool results - it **does not cache at all**. `details.doveOriginalContent`
  is the host's own transcript record, and Dove never reads it back.

Verdict: **not applicable rather than satisfied or missing.** Recorded that way instead of being ticked off, because
the interesting half of the item is that it has no target in this host, and a reader should be able to check that
claim against the four sites above.

**One thing worth noting and not changing:** the name `doveContextPayloads` reads like a content cache and is a

timestamp index for stripping. A name that promises more than the code does is in this project's defect family, and
the rename is left as a candidate rather than done, because it is churn in a 3,000-line file for a naming quibble.

## M5. Acceptance: observables, not assertions

Wiring point: `task-convergence.ts` is already reachable from the host.

1. Close the known hole: `acceptance.passed` takes **optional** evidence refs today, so a pass need not be
   backed by anything. **A pass requires a resolvable observable the agent did not author.**
2. The observable must not live where the agent can edit it. SpecBench: every frontier agent saturates the
   visible suite while the held-out gap grows **28 points per 10x of code size**; and in 120
   kernel-checked proofs, **30% had spec defects**.

**Validate**: a criterion marked passed without a resolvable observable is refused.


### M5's hole, closed 2026-09-26  **[IN PROGRESS - the observable must also be one the agent cannot author]**

`acceptance.passed` took `evidenceRefs` **optionally**, so a criterion could be marked passed with nothing behind
it. It now requires at least one, refused at the **event boundary** (`decodeTaskConvergenceEvent`) rather than in the
reducer, because it is a shape rule: an event claiming a pass with no observable is not a well-formed claim, and the
reducer should not have to arbitrate it. An explicitly empty list is the same claim as an absent one and is refused
the same way. `acceptance.failed` keeps its refs optional **on purpose**: a failure is not a claim of success, and
refusing to record one for lack of evidence would lose the failure.

**What remains of M5 is the harder half: "a resolvable observable the agent did not author."** Requiring *a*
reference is not requiring a *resolvable* one - `evidenceRefs: ["the suite passes"]` satisfies the rule as it now
stands. The proposal, not yet decided or built: give refs a **scheme** whose kinds encode provenance, and let a pass
accept only the host-authored kinds:

- `ledger:<recordId>` - a record the execution ledger wrote, which the agent cannot author;
- `command:<stepId>` - a recorded command exit status;
- a bare path or a sentence - **refused for a pass**, because the agent can write either one.

That is a boundary change with a resolver behind it (the ledger already exists), and it is the step that turns
"observables, not assertions" from a request into an enforcement.

**Validation (all run):**

```text
node --import tsx --test tests/task-convergence.test.ts -> tests 16 / pass 16 / fail 0   (15 before, +1)

npm run typecheck -> 0 errors
npm test          -> tests 563 / pass 561 / fail 0 / skipped 2   (562 before, +1)
```


### M5's other half, attempted and withdrawn 2026-09-26  **[the enforcement cannot precede the observable]**

I implemented the stronger rule - a pass must cite evidence that **resolves to a record the harness wrote** - in two
layers: a scheme rule in the tool's argument validation (`ledger:<stepId>`, `command:<stepId>`, `effect:<effectKey>`)
and a resolution check against the execution ledger and the effect store. **Then withdrew it, because the host
records no such thing for a tool call.** The ledger holds request lifecycle, gate refusals, budget events and
convergence decisions; it does **not** record tool calls. So an agent that honestly ran `npm test` and watched it
pass has nothing citable to pass the criterion with, and the rule would have refused **every honest pass** while
looking like enforcement.

**The signal was a pre-existing test**, and it is worth naming: `records an optional native goal directly without
planning questions or legacy script execution` in `pi-adapter.test.ts` failed, because a real user flow can no
longer complete. A rule that makes the product unable to finish a task is worse than the hole it closes.

What stands, from the previous round: **a pass requires at least one evidence reference**, refused by the event
decoder. That rule is satisfiable and closes the "nothing at all" hole. The stronger one is recorded at the call
site as well as here, so the next reader does not re-derive it from a failing test.

**What must come first, and it is the next step of this milestone:** the harness must **emit a citable observable**
for the thing a criterion can be decided by - at minimum an execution-ledger record per tool call carrying a stable
id, surfaced in the tool result so the agent can cite it. Then the resolution rule is both correct and useful, and
the scheme has something to name.

**Validation:** the tree is back to the previous round's state plus the call-site comment; typecheck 0 errors; npm
test 563 / 561 / 0 / 2.


### M5's prerequisite, landed 2026-09-26  **[the observable exists, so the rule can be re-attempted]**

A tool call the harness sees now gets a **guaranteed** ledger record (`tool.observed`, stepId `tool:<toolCallId>`),
and a **successful** result carries a one-line marker naming it (`[Dove observable: ledger:tool:<id>]`), so the agent
has something it can cite that it did not author.

**Three decisions in that sentence, each with its reason.**

1. **Guaranteed, not best-effort.** The hook already wrote a per-tool timing record - but conditionally
   (`toolTiming && currentRequestPlan`) and inside a `try {} catch {}` that swallowed failures. A citation pointing at
   a record that may not exist is the assertion in the right costume, so the observable is its own append and must
   succeed **before** the marker is offered.
2. **Successful results only.** A failure is not a pass-observable, and offering a citation for one would let an agent
   cite a result it could not pass on. Failures still reach the ledger through the request and effect paths.
3. **The marker is model-visible, and that costs context on every successful tool result.** That is the price of
   checkability: an observable the agent cannot name is one it cannot cite, and telling the model to guess ids would be
   worse. Recorded because it is a real cost, not a free improvement.

**Correcting the round-12 note.** I wrote that "the ledger does not record tool calls". It does, as a runtime phase,
conditionally. The missing piece was never the record - it was **guaranteeing it and naming it to the model**.

**When the record cannot be written, the operator is told and no marker is offered:** no record, no citation, and the
reason is visible rather than surfacing later as an unexplained refusal.

**Next for M5:** with this in place, the resolution rule can be re-attempted - `ledger:tool:<id>` is now a ref both
layers agree on - and `acceptance.passed` can require one.

**Validation (all run):**

```text
node --import tsx --test tests/host-work-mode.test.ts -> tests 10 / pass 10 / fail 0   (the effect test extended: marker + record, and none for a failure)

npm run typecheck -> 0 errors
npm test          -> tests 563 / pass 561 / fail 0 / skipped 2
```


### M5 complete, 2026-09-26  **[DONE]**

The resolution rule was **re-attempted, and this time it holds** - because the thing it needed now exists: a
guaranteed observable record per tool call, named in the result. A pass must cite `ledger:<stepId>` (the id in a tool
result's `[Dove observable: ...]` marker) or `effect:<effectKey>`, checked in two layers:

- **shape**, in the tool-argument validator: a label or a path is refused **by name**, because the agent can author
  either one;
- **existence**, where the ledger is readable: a well-shaped ref to a record that was never written is refused.

**What changed from the withdrawal is only the prerequisite, and that is the part worth keeping:** the same rule was
correct and unusable one round earlier. The difference is not the rule - it is that the harness now records something
an honest agent can cite. **Enforcement cannot precede the observable.**

**The pre-existing test was updated, not exempted.** `records an optional native goal directly...` used to pass a label
(`evidence:formal-pass`); it now drives a tool call **and its result** through the host first - which is what writes the
record - and cites `ledger:tool:suite-run`. The test got longer and truer: it demonstrates the discipline instead of
asserting around it.

**One kind was dropped from the earlier attempt:** `command:`. Nothing writes one, and a kind with no writer is a
promise the harness does not keep, so the accepted kinds are exactly the two that exist.

**Validation (all run):**

```text
node --import tsx --test tests/pi-adapter.test.ts         -> tests 33 / pass 33 / fail 0   (the pre-existing test now establishes and cites an observable)
node --import tsx --test tests/host-work-mode.test.ts     -> tests 11 / pass 11 / fail 0   (+1: the two-layer refusals)
node --import tsx --test tests/task-convergence.test.ts   -> tests 16 / pass 16 / fail 0   (a pass with no ref is still refused at the event decoder)

npm run typecheck -> 0 errors
npm test          -> tests 564 / pass 562 / fail 0 / skipped 2   (563 before, +1)
```

## M6. The verification ladder

1. A cost-ordered ladder that **short-circuits** and records `decided_by`, returning **unscored** rather
   than a default if nothing settles (Inspect's `cascade()`). Its docstring states its own premise and the
   design should state it too.
2. Rungs 1-3 only: parse/typecheck/lint; run and read the exit status; **compare against a second
   implementation** (roundtrip, idempotence). **No model.**
3. Rungs must resist the agent weakening them: a **skipped** check counts as failed, the runner requires
   positive evidence it ran at all, and the parsed result is **cross-checked against the exit status**.

**Validate**: a deliberately weakened check is caught, and rung 3 catches a mutation that rung 1 misses.

## M7. Typed termination

1. A run that does not finish stops with a **typed reason**, visible to the operator. SWE-agent's
   `_BlockedActionError / _RetryWithOutput / _ExitForfeit / _TotalExecutionTimeExceeded` is the shape;
   Aider's `max_reflections = 3` is the budget.
2. Reproduce the most-reported production failure as a test: a run that cannot make progress **stops and
   says so**, rather than looping.


### M7, 2026-09-26  **[DONE - one half already existed, one half is now tested]**

**The typed reason already existed, and the audit says so by enumeration rather than by assertion.** Every way a
request can end has a producer and a typed origin: `user` (abort), `provider` (terminal failure), `model-budget`,
`provider-round`, `progress-guard`, `convergence`, and `session` - where shutdown settles as `superseded` for a
reload/new/resume/fork and `cancelled` otherwise, **preserving** an already-decided envelope rather than replacing it
with the generic reason. `RequestTerminalOrigin` and the producers line up one for one.

**The half that was missing is the test, and writing it corrected me.** The plan asks for the most-reported
production failure to be reproduced: a run that cannot make progress must **stop and say so**. My first version drove
eight identical `ls` calls and asserted a stop; it failed, and the reason is a distinction worth pinning:

- **identical reads inside one turn are coalesced** (`coalesce`): the duplicate is answered with the first call's id,
  because repeating yourself within a turn is not the same failure as a run that cannot progress **across** turns;
- **identical reads across turns terminate** the request with a typed reason, and the reason reaches the ledger.

Both are now pinned, in two tests, with the distinction stated in each. A test that conflated them would have
"proved" either behaviour while measuring neither.

**Validation (all run):**

```text
node --import tsx --test tests/host-work-mode.test.ts -> tests 13 / pass 13 / fail 0   (+2: the stop, and the coalesce it is not)

npm run typecheck -> 0 errors
npm test          -> tests 566 / pass 564 / fail 0 / skipped 2   (564 before, +2)
```


### M6, 2026-09-26  **[DONE - rungs 1-2; rung 3 named as not built]**

`src/core/verification-ladder.ts`: rungs run **cheapest first** (cost declared, not inferred from array order) and the
ladder **stops at the first rung that settles**, reporting **which one decided** (`decidedBy`). Three rules, each
against a specific way a check can lie:

1. **A check that did not run is a failure, not a skip** - and so is a rung that could not start. A skip that reads as
   "nothing wrong" is how the agent weakens the ladder that is measuring it.
2. **Positive evidence that it ran is required**: an exit status. Absent, or `null` for a signal, means no verdict was
   reached - absence of evidence must not read as clean.
3. **The parsed result is cross-checked against the exit status**: a command that exits 0 while its own output reports
   `fail 3` is a failure, because the status is what a wrapper forwards and the output is what actually happened.

**Nothing settles implies `unscored`, never a default**, and `decidedBy` is absent then, because a default verdict is
one nobody reached.

**Rung 3 of the design's set is not built, and it is named rather than implied:** comparison against a *second
implementation* (roundtrip, idempotence). Nothing in this repository currently has a second implementation to compare
against, and writing one would be manufacturing a test double rather than adding a rung.

**Wired, not merely written.** `src/capabilities/development.ts` now decides every `dev.*` command **through the
ladder**, and a failure names the rung (`dev.typecheck failed (dev.typecheck:exit-status): ...`). The claim parser is
deliberately narrow - it reads a failure count out of a summary line - so `git status` is not cross-checked against a
claim invented for it, and an `interrupted` run now reports "the check did not run to a verdict" instead of a bare exit
code.

**Validation (all run):**

```text
node --import tsx --test tests/verification-ladder.test.ts       -> tests 5 / pass 5 / fail 0   (new)
node --import tsx --test tests/development-capabilities.test.ts -> unaffected by the rewiring

npm run typecheck -> 0 errors
npm test          -> tests 571 / pass 569 / fail 0 / skipped 2   (566 before, +5)
```

## M8. Truth in the documentation

1. `checkpoint.ts:12-13` cites "Microsoft's `WorkflowCheckpoint`". **No such class was found.** Remove the
   citation or replace it with one that exists.
2. Sweep for every claim about a guarantee the harness does not have (AC5).

## Validation

```bash
npm run typecheck                      # 0 errors
npm test                               # green, including the reachability test
node --import tsx --test tests/harness-*.test.ts
```

## Risky files and rollback

| File | Risk | Rollback |
|---|---|---|
| `src/pi-adapter/extension.ts` (2,736 lines) | the only running entry point | revert the `authorize` callback to the read-only check |
| `src/core/loop-runner.ts` | the effect claim enters at `:135` | remove the claim; behaviour returns to today's |
| `src/core/effect-ledger.ts` | `EffectOutcome` widens | the narrower union |
| `work-mode.ts` usage in the host | a bad mode refuses start | a per-mode bypass flag, removed after one release |

**Nothing in `src/core` is reachable today, so every wiring change has a blast radius of the host path
alone** - which is both why the work is needed and why it is safe to start.

## Follow-up checks before `task.py start`

- Confirm the host exposes a **pre-tool-call** boundary that can refuse, and whether it can refuse on
  **arguments** rather than only on a tool name.
- Confirm whether the host offers any hook that could contain **its own subprocesses**. C1 is a stated
  limitation only while the answer is no.
- Confirm `loop.ts` cannot be overridden once the gates are in it (C3).
