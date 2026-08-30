# Personal Agent Request Runtime

> **Scope:** Core Agent contracts, the Pi adapter firewall, request planning, tool selection, and provider budget enforcement.
>
> **Canonical router:** [Personal Agent Runtime Contract](./personal-agent-runtime.md)
> **Related specifications:** [personal-agent-capability-runtime](./personal-agent-capability-runtime.md), [personal-agent-project-context](./personal-agent-project-context.md)

## 1. Scope / Trigger

This contract applies to the cross-layer Personal Agent runtime: Agent Core, Windows runtime, Pi adapter, Trellis adapter, and capability packages.

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

- `src/core/**` must not import Pi packages. Pi-specific behavior belongs in `src/pi-adapter/**`.
- Capability names are stable dotted identifiers such as `windows.host_info` and `workspace.inspect`.
- Every capability declares version, platform, side effects, idempotency, status, and execution function.
- Mode changes are persisted as `personal-agent-mode` entries and apply only at the next not-yet-started step.
- PowerShell output is structured; raw output is retained as an artifact and summaries reference evidence rather than copying large logs into model context.
- Pi tool results must apply a model-facing output bound to large execution strings (stdout/stderr and nested recipe results); complete output remains in tool details and execution artifacts.
- The Pi adapter also bounds oversized built-in read/shell/search results before they re-enter model context. When compacted, it preserves the original content in tool details and includes a clear request-narrowing marker.
- The Pi adapter normalizes complete DeepSeek DSML text tool calls (`<｜DSML｜tool_calls>...`) at the `message_end` boundary into standard Pi `toolCall` blocks. This compatibility path is strict (complete wrapper/invocation/parameter tags only), preserves non-DSML content, leaves malformed text unchanged, and still relies on Pi's normal `tool_call` policy and approval path.
- Execution ledger records use JSONL and include task ID, step ID, mode, capability, status, timestamp, and duration.
- Dispatches write a `dispatch.decided` record before execution and a correlated `dispatch.completed` record after execution. Completion details include a unique `dispatchId`, selected route, wall-clock duration, success/failure status, and optional startup/context/input/output token metrics plus retry and human-intervention counts. Failed dispatches must still write the completion record before propagating the original error.
- Tool-loop fingerprints are deterministic opaque hashes. `ls` with no path normalizes to `.`; same-batch duplicate idempotent calls are coalesced before execution, while mutation and unknown tools are never result-cached. Successful stagnation compares call and bounded observation fingerprints, warns at the soft threshold, terminates at the hard threshold, and resets on changed arguments, observations, errors, or mutations.
- Provider cache evidence is per-call and stores bounded digests/sizes for system policy, serialized tools, Dove context, and history. The first call in a session/provider/model scope is `cold`; later records distinguish stable-prefix reuse, appended history, prefix changes, rewrites, and provider misses without treating cumulative cache-read counters as regressions.
- Oversized built-in read/shell/search observations are compacted before re-entry into model context with original/retained/omitted sizes, a digest, and deterministic narrowing metadata. Complete output remains in tool details.

## 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Unknown capability | Return a clear error; do not generate a substitute command in Fast Path |
| Missing required argument | Reject before execution |
| PowerShell executable unavailable | Try the supported fallback, then return an environment error |
| PowerShell non-zero exit | Return `failed` with stderr and duration |
| User abort / timeout | Return `interrupted: true`; never report success |
| Pi API incompatibility | Adapter doctor reports the version issue; core remains loadable |
| Trellis absent | Use lightweight state behavior; do not fail startup |
| Provider output limit exceeds the remaining model window through a known field | Clamp that same field and validate accounting against the transmitted value |
| Provider output must be reduced but no supported output field is writable | Fail closed and abort the Pi operation; do not claim an accounting-only clamp |
| Pi provider hook rejects a request | Call `ctx.abort()` because a thrown hook exception alone is swallowed by Pi |
| Incomplete ledger record belongs to a live process | Leave it pending; recover only legacy, unowned, or inactive-owner records |
| Same idempotent call appears twice in one batch | Coalesce the later call before execution |
| Same successful read repeats without a changed observation | Warn, then terminate at the configured hard bound |
| Provider cache scope changes | Start a new cold comparison chain |

## 5. Good / Base / Bad Cases

- Good: resolve `windows.host_info`, run it directly, return typed JSON and a ledger record.
- Good: preserve a large safe Ultra output request, or clamp a known provider field to the actual remaining capacity.
- Base: no matching capability; let the planner create or select a reusable capability outside the Fast Path.
- Base: preserve an explicit provider output limit that is already smaller than Dove's desired response headroom.
- Bad: embed a Pi `ExtensionAPI` object in a core capability or regenerate a long PowerShell script for an already-registered capability.
- Bad: reserve fewer tokens in accounting without updating the provider payload, or impose the plan's 4,096-token target as an Ultra ceiling.
- Bad: key diagnostics by raw tool arguments, classify every zero cache-read value as a prefix rewrite, or share a mutation result by fingerprint.

## 6. Tests Required

- Assert core modules type-check without Pi imports.
- Assert mode changes preserve the running-step snapshot and affect the next step.
- Assert exact capability resolution and required-argument validation.
- Assert PowerShell exit code, stderr, timeout, cancellation, and fallback behavior.
- Assert Pi adapter registers tools/commands/shortcuts without changing core contracts.
- Assert Trellis absence does not prevent runtime initialization.
- Assert a 12.8K model with a 16,384 requested output limit clamps a known provider field and still dispatches when the final request fits.
- Assert large-window Ultra may exceed the 4,096 planning target, while a smaller explicit provider limit is preserved.
- Assert an unknown/unwritable output limit fails closed through `ctx.abort()` and never records a started provider call.
- Assert live-owner records are not recovered, stop reasons are normalized, and negated/explanatory execution phrases remain read-only.
- Assert opaque input hashing, same-batch coalescing, unchanged-observation warning/stop, changed-result reset, bounded result metadata, and cold-first/provider-scope cache attribution.

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
// Core exposes a capability; the Pi adapter registers it and the Windows
// runtime owns PowerShell process details.
registry.register(windowsHostInfoCapability);
const result = await executeFastPath(registry, ledger, "windows.host_info", {}, context);
```

#### Provider Budget: Wrong

```typescript
// Accounting claims a smaller response, but transport still asks for 16,384.
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

## Design Decision: Adapter Firewall

**Context**: Dove is primarily used through Pi, and forcing every Pi callback
through a generic host abstraction would add indirection without improving the
user experience.

**Options considered**:

1. Make `src/pi-adapter/**` a minimal event translation layer.
2. Keep all logic in the Pi extension.
3. Keep Pi-specific lifecycle/UX specialization, while isolating only
   safety-critical runtime decisions.

**Decision**: Use option 3. Pi and Trellis are replaceable boundaries, not
dependencies of the host-independent Kernel. Pi may own rich lifecycle,
shortcut, tool-profile, streaming, and TUI behavior. Budget validation,
approval policy, capability execution, provider mutation, and recovery state
must remain in shared runtime modules.

**Example**:

```typescript
// Pi-specific UX can remain here.
pi.on("before_agent_start", async (event, ctx) => {
  const plan = createRequestPlan({ message: event.prompt, mode: mode.current });
  return runtime.prepareRequest(plan, ctx.model);
});
```

**Extensibility**: A future CLI or MCP host can reuse the Kernel contracts, but
must not require moving Pi-only behavior into generic abstractions first.

## V2 Request Planning and Provider Budget Firewall

The clean-slate runtime derives an immutable `RequestPlan` before compiling
prompt/context. Intent classes are `chat`, `lookup`, `project-work`, and
`execution`; ordinary conversation has no project-task context or capability
requirements. Mutation/execution language always wins over a caller-provided
`explicitIntent`, so an untrusted hint cannot downgrade approval requirements.
Negated or explanatory mentions of an execution verb remain read-only. The
planner evaluates clause-local actions and polarity so Chinese/English read-only
constraints do not accidentally grant execution, while a later independent
imperative is classified separately and still requires the execution boundary.
Summaries of the immediately preceding conversation remain Chat, and natural
language project continuation is read-only Project Work.

The request plan is the only owner of the capability tier. A fresh Auto Chat
turn exposes zero tools; Lookup exposes bounded read/search tools; Project Work
adds read-only diagnostics and planning; and Execution alone adds shell, edit,
task, capability, and workspace mutation tools. At each user-request boundary,
Auto activates exactly the current RequestPlan-selected set and keeps it stable
through that request's provider/tool continuations. It reasserts that exact set
when another extension changes host state, but never absorbs the foreign names.
The next user request replaces the set, so Execution authority cannot remain on
a later Chat or Lookup. Generic MCP dispatch, browser automation, and
background helpers remain Execution-only because their hosts may expose
mutations without enforcing Dove's request tier. Lookup may add only bounded
read-only web retrieval helpers.

Chat turns do not retrieve a fresh project projection for tool heuristics or
task correlation, but the provider-facing history remains append-only: the
context projection never removes or recreates a current v2 Dove message based
on intent. Browser phrases such as opening a webpage or taking a screenshot are
Lookup, read-only analysis with English or Chinese negation stays Lookup, and
repair/fix/implementation or explicit run/test imperatives are Execution.

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
must receive an explicit approval callback. Missing or denied approval returns
`status: "blocked"`, writes `capability.blocked`, and never invokes the
capability executor. The Pi layer may supply the callback through its native
confirmation UI; it does not bypass the shared runtime check.

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
session, and tool-call correlation. Host integrations may persist an explicit
`capability.approval.pending` transition. Cancellation and timeout are
terminally distinguished, and startup scans incomplete `capability.started`
records and marks them `capability.recovered` without replaying a potentially
non-idempotent side effect. A user must explicitly retry through the normal
approval boundary after reconciliation. Approved decisions are recorded
separately from blocked decisions. Optional evidence capture is best-effort:
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
