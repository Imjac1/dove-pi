# Personal Agent Request Runtime

> **Scope:** Core contracts, Pi adapter request planning, schema stability, progress bounds, and provider budgets.
>
> **Canonical router:** [Personal Agent Runtime Contract](./personal-agent-runtime.md)
> **Related specifications:** [personal-agent-capability-runtime](./personal-agent-capability-runtime.md), [personal-agent-project-context](./personal-agent-project-context.md)

## 1. Scope / Trigger

This contract applies to the cross-layer Personal Agent runtime: Agent Core, Windows runtime, Pi adapter, native project provider, legacy context reader, and capability packages.

## 2. Signatures

```typescript
type AgentMode = "fast" | "standard" | "ultra";

interface CapabilityResult {
  status: "success" | "failed" | "blocked";
  capability: string;
  durationMs: number;
  evidenceRefs: readonly string[];
}

interface PowerShellResult {
  executable: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  interrupted: boolean;
}

providerOutputTokenLimit(payload: unknown): number | undefined;
limitProviderOutputTokens<TPayload>(payload: TPayload, maxTokens: number): TPayload;
boundedOutputReservation(input: {
  contextWindow: number;
  providerRequestedOutput?: number;
  planOutputBudget: number;
  fixedOverhead?: number;
  inputTokens?: number;
  canWriteProviderLimit?: boolean;
}): number;

interface RecoveryOwnerOptions {
  isProcessActive?: (pid: number) => boolean;
}
```

## 3. Contracts

- `src/core/**` must not import Pi packages; Pi behavior belongs in `src/pi-adapter/**`.
- Capability names are stable dotted identifiers such as `windows.host_info` and `workspace.inspect`.
- Every capability declares version, platform, side effects, idempotency, status, and execution function.
- Mode changes are persisted as `personal-agent-mode` entries and apply only at the next not-yet-started step.
- PowerShell output is structured; raw output stays in an artifact and summaries reference evidence instead of copying logs into model context.
- Pi tool results must apply a model-facing output bound to large execution strings (stdout/stderr and nested recipe results); complete output remains in tool details and execution artifacts.
- The Pi adapter bounds oversized built-in read/shell/search results before model re-entry, preserving full output in tool details and adding a narrowing marker.
- The Pi adapter normalizes complete DeepSeek DSML text tool calls at `message_end` into standard Pi `toolCall` blocks. It accepts only complete wrapper/invocation/parameter tags, preserves non-DSML content, leaves malformed text unchanged, and uses Pi's normal policy/approval path.
- Execution ledger records use JSONL and include task, step, mode, capability, status, timestamp, and duration.
- Dispatches write correlated `dispatch.decided` and `dispatch.completed` records. Completion includes unique ID, route, duration, status, and optional token/retry/intervention metrics. Failed dispatches record completion before propagating the error.
- Tool-loop fingerprints are deterministic opaque hashes. `ls` defaults to `.`; same-batch duplicate idempotent calls coalesce, while mutation/unknown tools are never cached. Successful stagnation compares call and bounded observation fingerprints, warns then terminates at configured bounds, and resets on changed arguments, observations, errors, or mutations.
- Structured `ask_user_question` calls are bounded separately from read caching. A logical user goal may execute one structured question; a second call is blocked and terminates regardless of wording, option shape, or intervening tool results. A new logical goal receives a fresh budget. Semantic fingerprints remain diagnostic evidence, not the enforcement boundary.
- Project tracking is automatic and optional. No `PlanningSession`, task-creation handshake, or workflow-specific question guard exists; the general one-question-per-goal progress bound remains.
- Provider cache evidence is per-call with bounded digests/sizes for system policy, tools, Dove context, and history. The first call per session/provider/model scope is `cold`; later records distinguish stable-prefix reuse, appended history, prefix changes, rewrites, and misses without treating cumulative reads as regressions.
- Cache diagnostics separate cumulative/session reuse, warm reuse, and a bounded recent window. Warm reuse excludes the first cold call; the recent window is request-weighted and defaults to five calls. Summaries must not present warm rate as a request count.
- Usage-only diagnostics may attribute a miss to model change or an explicit idle gap. Without prefix evidence they report `provider-miss-or-expiry`, never infer a Dove prefix change. A session with no Dove context message is labelled `no-context`, meaning the minimal prefix path rather than unknown policy.
- Oversized built-in read/shell/search observations are compacted before model re-entry with sizes, digest, and narrowing metadata; complete output remains in tool details.
- Token audit aggregates project rows using one `sinceHours` inclusion predicate for input, cache, output, reasoning, session count, and message count. `totalReasoning` is the sum of included project `reasoningTokens`; output-only entries outside the window do not affect aggregate output or reasoning percentages.

## 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Unknown capability | Return a clear error; do not generate a substitute command in Fast Path |
| Missing required argument | Reject before execution |
| PowerShell executable unavailable | Try the supported fallback, then return an environment error |
| PowerShell non-zero exit | Return `failed` with stderr and duration |
| User abort / timeout | Return `interrupted: true`; never report success |
| Pi API incompatibility | Adapter doctor reports the version issue; core remains loadable |
| Native project state absent | Treat it as a healthy empty project; do not fail or ask to initialize |
| Provider output limit exceeds the remaining model window through a known field | Clamp that same field and validate accounting against the transmitted value |
| Provider output must be reduced but no supported output field is writable | Fail closed and abort the Pi operation; do not claim an accounting-only clamp |
| Pi provider hook rejects a request | Call `ctx.abort()` because a thrown hook exception alone is swallowed by Pi |
| Incomplete ledger record belongs to a live process | Leave it pending; recover only legacy, unowned, or inactive-owner records |
| Same idempotent call appears twice in one batch | Coalesce the later call before execution |
| Same successful read repeats without a changed observation | Warn, then terminate at the configured hard bound |
| A second structured question is attempted in one logical goal | Block and terminate before the third-party question tool runs |
| Question wording changes or another tool returns | Preserve the one-question goal budget; wording and tool churn do not bypass it |
| Ordinary execution has no native state | Execute normally and best-effort create a compact current goal without asking |
| Provider cache scope changes | Start a new cold comparison chain |
| Token audit has a time window | Apply it to every usage field and count; do not count a session unless it has an included usage sample |

## 5. Good / Base / Bad Cases

- Good: resolve `windows.host_info`, run it directly, return typed JSON and a ledger record.
- Good: preserve a large safe Ultra output request, or clamp a known provider field to the actual remaining capacity.
- Base: no matching capability; let the planner create or select a reusable capability outside the Fast Path.
- Base: preserve an explicit provider output limit that is already smaller than Dove's desired response headroom.
- Bad: embed a Pi `ExtensionAPI` object in a core capability or regenerate a long PowerShell script for an already-registered capability.
- Bad: reserve fewer tokens in accounting without updating the provider payload, or impose the plan's 4,096-token target as an Ultra ceiling.
- Bad: key diagnostics by raw tool arguments, classify every zero cache-read value as a prefix rewrite, or share a mutation result by fingerprint.
- Bad: treat `ask_user_question` as an unlimited non-idempotent escape hatch after the user has already confirmed the same action.
- Bad: sum reasoning per project but omit it from the aggregate, or filter input/cache while counting all session output.

## 6. Tests Required

- Assert core modules type-check without Pi imports.
- Assert mode changes preserve the running-step snapshot and affect the next step.
- Assert exact capability resolution and required-argument validation.
- Assert PowerShell exit code, stderr, timeout, cancellation, and fallback behavior.
- Assert Pi adapter registers tools/commands/shortcuts without changing core contracts.
- Assert native state absence does not prevent runtime initialization or tool execution.
- Assert a 12.8K model with a 16,384 requested output limit clamps a known provider field and still dispatches when the final request fits.
- Assert large-window Ultra may exceed the 4,096 planning target, while a smaller explicit provider limit is preserved.
- Assert an unknown/unwritable output limit fails closed through `ctx.abort()` and never records a started provider call.
- Assert live-owner records are not recovered, stop reasons are normalized, and negated/explanatory execution phrases remain read-only.
- Assert opaque input hashing, same-batch coalescing, unchanged-observation warning/stop, changed-result reset, bounded result metadata, and cold-first/provider-scope cache attribution.
- Assert all recorded September 1 question variants are blocked before question two, including after other tool results.
- Assert ordinary project execution injects no task-creation or workflow-skill prompt and does not require `agent_project_task`.
- Assert explicit native goal creation preserves title/description without a second confirmation, and token audit aggregate rows remain mathematically consistent under `sinceHours`.

## 7. Wrong vs Correct

### Wrong

```typescript
// Core code coupled to the host and to a raw shell command.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export function run(pi: ExtensionAPI) {
  return pi.exec("powershell ...");
}
```

### Correct

```typescript
registry.register(windowsHostInfoCapability);
const result = await executeFastPath(registry, ledger, "windows.host_info", {}, context);
```

#### Provider Budget: Wrong

```typescript
const gateway = new ModelGateway({ contextWindow: 12_800, reservedOutput: 4_096 });
return originalPayload;
```

#### Provider Budget: Correct

```typescript
const reservedOutput = boundedOutputReservation({
  contextWindow,
  providerRequestedOutput: providerOutputTokenLimit(payload) ?? model.maxTokens,
  planOutputBudget: plan.outputBudget,
  inputTokens,
  fixedOverhead,
  canWriteProviderLimit: providerOutputTokenLimit(payload) !== undefined,
});
return limitProviderOutputTokens(payload, reservedOutput);
```

## Design Decision: Adapter Coordination Boundary

**Context**: Dove is primarily used through Pi, so a generic host abstraction
would add indirection without improving this boundary.

The alternatives were a minimal event layer or putting all logic in the Pi
extension; both lose the boundary below.

**Decision**: Use option 3. Pi and the native project provider are replaceable boundaries, not
Kernel dependencies. Pi owns lifecycle, shortcuts, active tools, streaming,
and TUI behavior. Dove's shared runtime owns context budgeting, execution
records, mutation recovery, and standalone transport validation, but never a
second Pi tool-permission policy.

**Example**:

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  const plan = createRequestPlan({ message: event.prompt, mode: mode.current });
  return runtime.prepareRequest(plan, ctx.model);
});
```

Future CLI/MCP hosts can reuse the Kernel contracts.

## V2 Request Planning and Provider Budgets

The clean-slate runtime derives an immutable `RequestPlan` before compiling
prompt/context. Intent classes are `chat`, `lookup`, `project-work`, and
`execution`; ordinary conversation has no project-task context. Mutation or
execution language always wins over a caller-provided `explicitIntent` for
context and goal accounting, never for tool permission. Negated or explanatory
mentions of an execution verb remain read-only. The
planner evaluates clause-local actions and polarity so Chinese/English read-only
constraints do not accidentally grant execution, while a later independent
imperative is classified separately and still requires the execution boundary.
Summaries of the immediately preceding conversation remain Chat, and natural
language project continuation is read-only Project Work.

`RequestPlan.workflowAction` is compatibility metadata for explicit goal
commands; it never injects a phase workflow or restricts Pi tools.

`RequestPlan.interactionMode` is an independent user-facing context preference:
`auto` keeps the adaptive default, `chat` omits project context and formal task
persistence, and `work` permits project context while still keeping ordinary
small edits on the fast lane. Neither interaction mode changes Pi's tool
authority. A short affirmative continuation inherits a pending formal lane so
an accidental model question cannot detach the follow-up from its durable task.

Auto records Pi's provider-visible schema at session start and never calls
`setActiveTools` because of Chat, Lookup, Project Work, or Execution intent.
`RequestPlan` contains context, guidance, budget, and goal-accounting metadata;
it contains no capability allow-list or approval tier. Pi extensions own
optional/deferred tools. Explicit user `core`/`full` compatibility profiles may
replace the schema and are reported as cache-prefix changes.

Chat turns do not retrieve a project projection for tool heuristics or task
correlation; provider history remains append-only and v2 Dove context is not
rebuilt on intent changes. Web viewing is Lookup; read-only analysis remains
Lookup; repair, implementation, and explicit run/test imperatives are
Execution.

The host-independent `ModelGateway` owns provider payload accounting. It
subtracts reserved output, reasoning, tool-schema, and provider-overhead tokens
from the model context window, validates the complete request before transport
dispatch, and throws a structured diagnostic on overflow. Required segments are
ranked first but never bypass the final budget check. Provider stop reasons are
normalized once at this boundary. The final provider gate estimates tool-schema
tokens from the serialized `tools` array in the actual payload; count-based
estimation is only a pre-payload fallback. A request plan's output budget is minimum
response headroom, not a fixed provider-output ceiling; a large-window Ultra
request may retain a larger provider-requested limit when the final payload fits.
When Dove clamps output, it must write the same value through a known provider
field (`max_tokens`, `max_output_tokens`, or `max_completion_tokens`) so
accounting and transport remain synchronized. If no known field can be updated,
the request fails closed instead of pretending the transport limit changed.

`executeFastPath` accepts an optional authorization boundary:

```typescript
executeFastPath(registry, ledger, name, args, context, {
  required: true,
  authorize: async ({ name, sideEffects, args }) => boolean,
});
```

When `required` is enabled, any capability with a non-`read_only` side effect
must receive a host callback. Missing or denied authorization returns
`status: "blocked"`, writes `capability.blocked`, and never invokes the
capability executor. In the Pi adapter, the accepted Pi tool call supplies that
host decision without a second Dove confirmation. Standalone CLI/RPC/MCP hosts
retain their transport-specific authorization boundary.

Provider calls are runtime decisions rather than incidental transport details.
The Pi `before_provider_request` hook converts the final opaque payload into
shared ModelGateway segments, reserves model output/tool/provider headroom,
and rejects the request before HTTP dispatch when the complete payload cannot
fit. It may remove only Dove-derived context and retry the deterministic check;
user history is never silently truncated. Accepted and rejected calls are
correlated in the execution ledger with request, session, task, and
provider-call identifiers, while `after_provider_response` records the HTTP
outcome and usage projection. Pi records and swallows extension-hook exceptions,
so a rejected `before_provider_request` must call the host `ctx.abort()` boundary;
throwing alone is only the fallback for hosts that do not expose that boundary.

Capability executions receive a unique `executionId` and optional request,
session, and tool-call correlation. Standalone host integrations may persist an
explicit `capability.approval.pending` transition. Cancellation and timeout are
terminally distinguished, and startup scans incomplete `capability.started`
records and marks them `capability.recovered` without replaying a potentially
non-idempotent side effect. A user must explicitly retry through a new host tool
call after reconciliation. Host decisions are recorded separately from blocked
decisions. Optional evidence capture is best-effort:
an unavailable artifact is reported in ledger details without converting an
already completed side effect into a false execution failure. Started
capability and provider records carry an optional host-owned process ID;
recovery must leave records owned by a live process untouched, while legacy,
unowned, or inactive-owner records remain recoverable. Core receives the
liveness callback and never imports host process APIs.

## Request Lifecycle Identity and Retry Contract

### 1. Scope / Trigger

This contract applies when Pi receives, retries, compacts, continues, steers,
or settles a user submission. It prevents host machinery from turning one
submission into duplicate request plans, guidance, user entries, or effects.

### 2. Signatures

```typescript
RequestLifecycleController.acceptSubmission(input): {
  lease: RequestLease;
  delivery: "initial" | "steer" | "follow-up";
  newLogicalRequest: boolean;
  coalesced: boolean;
  terminalized: readonly RequestTerminalTransition[];
};
RequestLifecycleController.startAttempt(trigger): RequestAttempt;
RequestLifecycleController.retryDecision(failure): { retry: boolean; reason: string };
RequestLifecycleController.settle(reason, { detail?, policyAbort? }): readonly RequestTerminalTransition[];
```

Ledger correlation keeps `requestId`, `attemptId`, `providerCallId`,
`executionId`, and `toolCallId` as separate optional fields so legacy JSONL
records remain readable.

### 3. Contracts

Pi's `input` hook owns logical request identity because it runs before skill or
template expansion and before `before_agent_start`. `RequestPlan.requestId`
must receive that logical ID rather than generating a second identity. A
low-level `agent_start` owns a distinct attempt ID, each provider dispatch owns
a provider-call ID, capability execution owns an execution ID, and Pi retains
its tool-call ID; ledger correlation keeps these values separate.

One active logical request survives Pi's low-level `agent_end`, automatic
provider retry, compaction retry, and continuation machinery. It closes only at
`agent_settled` or an explicit terminal transition. Steering and queued
follow-up inputs are deliberate user deliveries, never automatic retries;
Pi consumes them inside the active run without a second `before_agent_start`,
so their `request.received` records retain the active logical request ID and do
not create orphan request leases that can never own the provider/tool work they
trigger. The active request closes once at settlement and cannot leak into the
next prompt. A queued input that fails model/auth/startup preflight before
`before_agent_start` is terminalized as `startup-failed` when the next input or
host shutdown exposes the abandoned lease.

Pi 0.84.3 exposes no host submission ID. Dove may therefore use prompt digest
only as supporting evidence while an equivalent request is already active; it
must never deduplicate a merely queued preflight lease or a completed same-text
submission. A coalesced active redelivery is handled at `input` so Pi does not
persist a second user entry. `request.planned` and current guidance are emitted
once per logical request.

Automatic retry is bounded and fail-closed. HTTP 408/425/429/5xx and reviewed
transport-reset/timeout codes are transient only while the attempt limit has
not been reached and no non-idempotent effect has started. Cancellation,
startup conflict, invalid configuration, authorization denial, other terminal
HTTP statuses, and any failure after a non-idempotent tool/capability effect
are converted to an `aborted` assistant stop at `message_end` so Pi's real
post-run retry loop cannot continue; `agent_end` also calls `ctx.abort()` as a
host boundary. Dove keeps the policy terminal reason separately, so
`agent_settled` records `authorization-denied`, `invalid-configuration`, or a
`failed` detail such as `attempt-limit`/`non-idempotent-effect` instead of
misreporting a policy abort as user cancellation. Retry safety uses a reviewed
read-only Pi-tool allowlist, Core capability idempotency, and every capability
step in a recipe; unknown plugin tools fail closed as non-idempotent.
Ledger events `request.received`, `request.redelivery.coalesced`,
`request.attempt.started`, `request.attempt.completed`, and `request.terminal`
are additive; legacy readers may ignore them.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Active same-source redelivery with equivalent digest | Return `handled` at `input`; retain one request/user entry |
| Same text after `agent_settled` | Create a new logical request ID |
| Preflight fails before `before_agent_start` | Terminalize the queued lease as `startup-failed` on the next input or shutdown |
| Steer/follow-up during an active run | Record a deliberate delivery on the active request; do not create an orphan request or retry attempt |
| 408/425/429/reviewed 5xx or transport reset within limit | Permit the next attempt only if no non-idempotent effect started |
| Cancellation, authorization/config/startup failure, attempt limit, or non-idempotent effect | Convert the error stop to `aborted`, call `ctx.abort()`, and preserve the structured policy terminal reason |
| Unknown or third-party tool | Treat as non-idempotent unless its exact read-only contract is reviewed |

### 5. Good / Base / Bad Cases

- Good: five host attempts share one `requestId` while each has a distinct
  `attemptId` and provider calls retain their own IDs.
- Base: a completed request is deliberately submitted again and receives a new
  request ID even when its text is identical.
- Bad: hash completed prompts for deduplication, count steer as an automatic
  retry, default unknown plugins to idempotent, or report a policy abort as a
  user cancellation.

### 6. Tests Required

- Assert `input -> before_agent_start -> agent_start/provider/agent_end ->
  agent_settled` produces one plan and one terminal record.
- Assert active redelivery is handled before Pi persistence, while a settled
  same-text submission receives a new ID.
- Assert steer/follow-up `request.received` records keep the active request ID.
- Assert provider, capability, recipe, and tool ledger records carry the same
  request/attempt chain with distinct execution IDs.
- Assert transient retry bounds, terminal HTTP status, policy terminal detail,
  non-idempotent capability/recipe, and unknown-plugin fail-closed behavior.
- Assert legacy ledger readers ignore additive lifecycle kinds.

### 7. Wrong vs Correct

#### Wrong

```typescript
// Digest alone suppresses a later deliberate repeat and unknown tools replay.
const requestId = sha256(prompt);
const idempotent = !knownMutatingTools.has(toolName);
```

#### Correct

```typescript
const accepted = lifecycle.acceptSubmission({ text, source, streamingBehavior });
const requestId = accepted.lease.logicalRequestId; // reused only while unsettled
const idempotent = reviewedReadOnlyTools.has(toolName)
  || reviewedCapabilityOrRecipeIsIdempotent(toolName, input);
```
