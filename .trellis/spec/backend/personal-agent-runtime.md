# Personal Agent Runtime Contract

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

## 5. Good / Base / Bad Cases

- Good: resolve `windows.host_info`, run it directly, return typed JSON and a ledger record.
- Good: preserve a large safe Ultra output request, or clamp a known provider field to the actual remaining capacity.
- Base: no matching capability; let the planner create or select a reusable capability outside the Fast Path.
- Base: preserve an explicit provider output limit that is already smaller than Dove's desired response headroom.
- Bad: embed a Pi `ExtensionAPI` object in a core capability or regenerate a long PowerShell script for an already-registered capability.
- Bad: reserve fewer tokens in accounting without updating the provider payload, or impose the plan's 4,096-token target as an Ultra ceiling.

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

## Scenario: Capability Protocol and External Adapters

### 1. Scope / Trigger

- Trigger: adding or changing a Dove capability, Capability Protocol field,
  host adapter, project-context authority, or evidence reference.
- Scope: Direct Core, Pi, local CLI/JSON-RPC, MCP, the shared execution ledger,
  projected Pi plugin capabilities, and normalized project context.

### 2. Signatures

```text
dove-pi capability list
dove-pi capability run <name> [--args=<json>] [--approve]
dove-pi rpc
dove-pi mcp

JSON-RPC: capabilities/list | capabilities/invoke
MCP tools: dove_capabilities | dove_context | dove_invoke
```

```typescript
new CapabilityInvocationService(registry, ledger, {
  authorize?: (request: CapabilityInvocationRequest) => boolean | Promise<boolean>;
}).invoke(request, signal?): Promise<CapabilityInvocationResponse>;
```

### 3. Contracts

#### Protocol and composition

- `CAPABILITY_PROTOCOL_VERSION` is an exact semantic version. Protocol request
  and response schemas reject an unsupported protocol literal, non-semver
  capability versions, unknown object properties, overlong identifiers, and
  argument maps beyond the declared bound before capability dispatch.
- Discovery returns the same reviewed manifest fields for every host:
  capability name/version, parameter schema, required arguments, platforms,
  side effects, idempotency, lifecycle, preconditions, and evidence contract.
- `createDoveRuntime()` is the single composition root for Direct Core, Pi,
  CLI/JSON-RPC, and MCP. Adapters construct `CapabilityInvocationService` over
  that registry and the execution ledger; they must not copy executor logic or
  register a host plugin as a second Core capability.
- Each response contains the protocol/capability version, normalized terminal
  status, duration, evidence references, and a new `executionId` correlated
  with the caller's `requestId` plus optional host session, provider task, and
  tool-call identifiers.

#### Trusted authorization boundaries

| Entry point | Trusted authorization source | Required behavior |
|---|---|---|
| Direct Core | An injected host-owned `authorize` callback | A payload value of `approval: "granted"` is insufficient by itself |
| Pi | Native interactive `ctx.ui.confirm` after read-only policy checks | Headless or read-only execution cannot approve side effects |
| Local CLI | The local process parses the explicit `--approve` flag and injects the callback | Omitting the flag denies side effects |
| JSON-RPC stdio | None in protocol `1.0.0` | Request payloads cannot self-authorize; side effects fail closed |
| MCP stdio | None in protocol `1.0.0` | `dove_invoke` exposes no approval argument; side effects fail closed |

JSON-RPC is newline-delimited JSON over local stdio, limits each input line to
128 KiB, and accepts only `capabilities/list` and `capabilities/invoke`. MCP is
implemented through the official SDK and exposes only `dove_capabilities`,
`dove_context`, and `dove_invoke`. Network/cloud transport, arbitrary shell
fields, and implicit vendor accounts are outside these adapter contracts.

#### Plugin capability projection

Reviewed Pi plugins remain host-owned providers for Pi-specific TUI, web and
browser access, MCP clients, diagnostics, structured questions, planning, and
background work. The extension catalog projects package/tool availability as
`available`, `configured`, or `degraded` for doctor and discovery. A projected
plugin capability never becomes a Core executor and cannot bypass Dove's
request plan, approval service, ledger, or evidence policy.

#### Interoperable project context and evidence

- Trellis/the selected `ProjectProvider`, `AGENTS.md`, `CLAUDE.md`, Agent
  Skills, and MCP resources are separately labeled authorities in one
  projection. Duplicate instruction or resource authorities are reported in
  `conflicts`; no last-write-wins or semantic merge is allowed.
- Ordinary context requests receive the index and estimates. Full external
  text is added only for a targeted instruction, skill, or MCP-resource query,
  then remains subject to the shared context compiler's relevance and size
  bounds.
- Context and evidence references exclude `.env*`, credential/secret/token/API
  key names, private-key names, and key/certificate/keystore extensions by
  default. Evidence filtering is defense in depth at the shared execution
  boundary and applies consistently to every adapter.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Unsupported protocol or invalid capability semver | Reject before dispatch |
| Arguments fail the capability's declared parameter schema | Reject before approval or execution |
| Request claims approval without a trusted host callback | Deny side effects; never start the executor |
| RPC input line exceeds 128 KiB | Return one bounded parse error for that line, discard through its newline, then continue |
| Duplicate project authorities | Preserve source labels and report a conflict; never silently merge |
| Evidence reference names credential/key material | Exclude it at the shared execution boundary |
| Capability platform is unsupported | Return `unsupported_platform` with an execution correlation ID |

### 5. Good / Base / Bad Cases

- Good: Pi, CLI/RPC, and MCP invoke the same reviewed registry entry and
  receive the same versioned result/evidence shape with distinct correlations.
- Base: a read-only capability needs no approval, but still passes schema,
  platform, ledger, evidence, and response validation.
- Bad: trust `approval: "granted"` or `approval: "not_required"` from an RPC/MCP
  payload, copy a Pi plugin executor into Core, or buffer an unbounded RPC line
  before checking its size.

### 6. Tests Required

The vendor-account-free smoke matrix must exercise one read-only capability
through Direct Core, CLI/JSON-RPC, official MCP transport, and Pi's registered
`agent_run_capability` tool. Every row must return the Capability Protocol
version, the same capability name/version and success status, a caller request
ID, and a non-empty execution ID. The Pi row must also demonstrate that the
registered tool is backed by the shared invocation service. Separate contract
tests cover terminal outcomes, ledger correlation, bounded RPC methods,
fail-closed RPC/MCP authorization, normalized context conflicts, and evidence
secret filtering. No interoperability claim requires a live provider account.

### 7. Wrong vs Correct

#### Wrong

```typescript
// The untrusted request decides whether a mutating capability needs approval.
const required = request.approval !== "not_required";
```

#### Correct

```typescript
// The reviewed capability declaration is the authority; the host supplies the
// trusted approval decision only when side effects require one.
const required = definition.sideEffects.some((effect) => effect !== "read_only");
const approved = required && request.approval === "granted"
  ? await hostAuthorize(request)
  : !required;
```

## Scenario: Dispatch Cost Calibration

### 1. Scope / Trigger

- Trigger: any call to the adaptive dispatcher that needs to compare its predicted route cost with observed execution cost.
- Scope: `src/core/dispatcher.ts`, `src/core/execution-ledger.ts`, and the core contracts. This does not implement replay or automatic heuristic mutation.

### 2. Signatures

```typescript
interface DispatchWork<TResult> {
  estimate: DispatchEstimate;
  runInline: () => Promise<TResult>;
  runSubagent?: () => Promise<TResult>;
  branches?: readonly (() => Promise<TResult>)[];
  reportActualMetrics?: () => DispatchActualMetrics | Promise<DispatchActualMetrics>;
}

executeDispatch<TResult>(work: DispatchWork<TResult>): Promise<DispatchOutcome<TResult>>;
```

### 3. Contracts

- Before execution, append `dispatch.decided` with `dispatchId`, route, reason, and the full `DispatchEstimate`.
- After execution, append exactly one correlated `dispatch.completed` record whenever execution starts. It contains `dispatchId`, effective route, `startedAt`, `completedAt`, `wallTimeMs`, `status`, `retries`, `humanInterventions`, and any reported startup/context/input/output token metrics.
- `reportActualMetrics` is optional and must only report observations; it must not change the selected route or policy.
- A failed worker writes `status: "failed"` and then rethrows the original error.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| No metrics provider | Record wall time and default retries/interventions to zero |
| Worker resolves | Record `status: "success"` |
| Worker rejects | Record `status: "failed"`, then propagate the original error |
| Parallel branch rejects | Record one failed dispatch completion for the joined dispatch |
| Metrics provider rejects | Preserve the worker result/error; do not silently mark a successful worker as failed due only to optional telemetry |

### 5. Good/Base/Bad Cases

- Good: provide token counts from the host adapter after a Pi/model run and correlate them with `dispatchId`.
- Base: omit optional metrics for deterministic local work; wall time still supports calibration.
- Bad: append only the prediction record, or let a metrics callback choose a different route after execution.

### 6. Tests Required

- Assert successful dispatch returns actual metrics and writes both ledger record kinds with the same `dispatchId`.
- Assert rejected work writes a failed completion record before the original error reaches the caller.
- Assert missing optional metrics defaults retries and human interventions to zero.
- Assert parallel dispatch writes one completion record for the joined operation.

### 7. Wrong vs Correct

#### Wrong

```typescript
await ledger.appendDispatchDecision(taskId, stepId, mode, decision);
await runWorker();
// No actual cost or correlation identifier is persisted.
```

#### Correct

```typescript
const outcome = await executeDispatch({
  estimate,
  runInline,
  reportActualMetrics: () => ({ inputTokens, outputTokens, retries }),
  ledger,
  ledgerContext: { taskId, stepId, mode },
});
// outcome.actual and dispatch.completed support later calibration.
```

## Scenario: Structured Trellis Context

### 1. Scope / Trigger

- Trigger: building model context from a Trellis-enabled workspace.
- Scope: `src/trellis-adapter/index.ts` owns filesystem discovery and metadata decoding; `src/trellis-adapter/context.ts` owns relevance selection. Core remains usable when `.trellis` is absent.

### 2. Signatures

```typescript
readTrellisSnapshot(cwd: string): TrellisSnapshot;
buildProjectContext(provider: ProjectProvider, query: string, mode: AgentMode): CompiledContext;
```

`TrellisSnapshot` exposes compatibility file lists plus structured `tasks` and
`memories`. Active-task identity is added only by the Trellis
`ProjectProvider`, after it validates the public command result.

### 3. Contracts

- A task directory is represented by `TrellisTaskRecord { path, id, title, status, priority?, files }` from `task.json` plus Markdown files.
- A memory file is represented by `TrellisMemoryRecord { path, kind, developer? }`, where `kind` distinguishes `journal`, `index`, and `document`.
- The active task is resolved through Trellis' bundled public `task.py current --json` command. The adapter validates the JSON result, freshness, and normalized path containment under the public task root; command failure, stale output, malformed JSON, or an out-of-root path leaves `activeTaskPath` unset so provider-neutral candidate projection can continue without reading private runtime files.
- Fast mode includes only the active task PRD and the runtime spec as required context. Standard/Ultra use relevance scoring; Ultra may include typed memory records without an application token cap.
- The Pi adapter must pass its selected `ProjectProvider` into context compilation. A cwd convenience wrapper may exist for compatibility, but it must delegate to the same provider projection rather than reading Trellis files directly.
- `DOVE_PI_READ_ONLY=1` is an explicit degraded-mode switch. It leaves chat, lookup, snapshots, verification, and diagnostics available while blocking Trellis task mutations, workspace restore/patch operations, and side-effect capability approvals. The active mode is exposed by `agent_doctor` so an unsupported host/provider can fail visibly rather than guessing.
- Dove's stable instructions are returned as `before_agent_start.systemPrompt`; meaningful project context is emitted as a versioned `personal-agent-context` custom message only when its context epoch changes (`mode + Trellis revision`). Empty or provider-budget-omitted retrievals emit no wrapper and do not consume the epoch, so a later relevant request at the same revision can retry. Prompt-specific workflow hints are attached once to the current request (and may share its message with a newly emitted snapshot) rather than being stranded in a reused epoch. Request-exact Auto tool changes must not rebuild the project snapshot on every intent flip.
- Keep provider prompt-cache prefixes stable: the static Dove system-prompt section must not include per-request mode, task, workflow, or project text. The `context` transform may remove legacy unversioned `personal-agent-context` entries for compatibility, but must never move or rebuild the current v2 snapshot on each provider request.
- A final provider-budget recovery may omit Dove-derived context only by the exact timestamp/content identity recorded by the `context` projection. It must not remove a user message merely because the user text contains a Dove context marker.
- In `auto` tool mode, intent-specific tools are request-exact: apply the selected set once at `before_agent_start`, retain it during that request's tool-call continuations, and replace it at the next user request. Avoid repeated `setActiveTools()` calls when consecutive requests select the same set. Tier changes may reduce provider-cache reuse because tool definitions participate in the prefix; least authority and reduced per-turn schema cost take precedence over retaining stale Execution tools.
- When `pi-hashline-edit-pro` is present, the Pi adapter treats hashline `replace`/`insert` (and undo when available) as the edit authority and must suppress the built-in `edit` tool in every profile, including explicit `full`; this prevents another extension from reintroducing the built-in mutation path.
- `/dove-tools reset` explicitly returns to Auto's zero-tool Chat baseline; the next user request applies its exact intent set. The reset is allowed to change the tool prefix because it is user initiated.
- Fast and Standard apply bounded total context-character budgets for broad retrieval. Ultra has no artificial application token cap and relies on relevance scoring, content deduplication, per-document compaction, and Pi/provider model-context limits.
- When Pi exposes current context usage and model window, the adapter derives a remaining-character budget with response headroom and passes it to the compiler. On a first request, before usage is available, it falls back to the model's declared window, reserves space for system/tool/output tokens, and limits project context to a conservative window share. This is a dynamic model limit guard, not a fixed Ultra budget.
- Model-facing project indexes use bounded previews for large collections (for example, the first 50 task records plus an omission count); complete raw collections remain provider-local details.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| `.trellis` absent | Return `enabled: false` with empty structured collections; compile lightweight context |
| Missing `task.json` | Discover Markdown files and use directory name/default `unknown` metadata |
| Malformed `task.json` | Ignore metadata parse failure without losing file discovery |
| Public current-task command unavailable or fails | Leave `activeTaskPath` unset and continue with normalized task candidates |
| Stale, malformed, or out-of-root current-task result | Ignore the result; never inspect a private runtime fallback |

### 5. Good/Base/Bad Cases

- Good: load the active task's PRD and runtime spec in Fast mode, then rank relevant memory only when requested.
- Base: a Trellis project with task files but no active session still provides non-required task context in Standard/Ultra.
- Bad: have the context layer parse `task.json` or duplicate session-path logic independently.

### 6. Tests Required

- Assert task id/title/status/priority and active path are decoded from the fixture workspace through the public current-task command.
- Assert journal and index files receive distinct memory kinds.
- Assert malformed or missing metadata does not prevent snapshot creation.
- Assert Fast mode keeps active PRD/runtime spec behavior and Trellis-disabled mode remains loadable.
- Assert request-scoped Dove context is not persisted, legacy context messages are filtered, empty/budget-omitted snapshots can retry their epoch, exact Dove-only budget recovery preserves marker-bearing user text, and broad Standard retrieval stays within its character budget.

### 7. Wrong vs Correct

#### Wrong

```typescript
const active = path.startsWith(session.current_task ?? "");
// Prefix matching can select a similarly-named task and leaves metadata untyped.
```

#### Correct

```typescript
const provider = createProjectProvider(cwd);
const active = provider.getContext().currentTask;
// The provider owns normalization, public-command validation, and identity.
```

## Scenario: Transactional Workspace Operations

### 1. Scope / Trigger

- Trigger: a capability needs repeatable workspace inspection, reversible edits, or post-edit verification.
- Scope: `src/windows-runtime/workspace.ts`; operations are filesystem-only and remain independent of Pi and Trellis.

### 2. Signatures

```typescript
createWorkspaceSnapshot(cwd: string, inputPaths?: readonly string[]): Promise<WorkspaceSnapshot>;
verifyWorkspaceSnapshot(cwd: string, snapshotId: string): Promise<WorkspaceVerification>;
restoreWorkspaceSnapshot(cwd: string, snapshotId: string): Promise<WorkspaceVerification>;
applyWorkspacePatch(cwd: string, operations: readonly WorkspacePatchOperation[]): Promise<WorkspacePatchResult>;
```

### 3. Contracts

- Snapshots store normalized relative roots, file sizes, SHA-256 hashes, directory entries, and binary-safe payload copies under `.agent-data/workspace-snapshots/<id>/`.
- Verification is read-only and reports `missing`, `changed`, and `extra` paths; `ok` is true only when all three are empty.
- Patch operations are `write`, `delete`, or `mkdir`. A patch always creates a pre-image snapshot and restores it if any operation fails.
- Relative paths must remain inside `cwd`. `.git`, `node_modules`, `.agent-data`, and the snapshot storage subtree are excluded during recursive workspace-root snapshots.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Path escapes workspace root | Reject before reading or mutating |
| Snapshot id is malformed or belongs to another root | Reject restore/verify |
| Snapshot input path is missing | Retain the root in the manifest and allow restore to remove a later-created path |
| Patch operation fails | Restore the pre-image snapshot, then propagate the original error |
| Symlink or unsupported filesystem entry is encountered | Skip recursive symlinks; reject unsupported entries |

### 5. Good/Base/Bad Cases

- Good: snapshot a project file set, apply a patch, verify drift, and restore to the exact hashed contents.
- Base: use `inspectWorkspacePath` or `readWorkspaceText` for read-only operations without creating a snapshot.
- Bad: compose an unbounded shell command for edits or remove the snapshot directory during restore.

### 6. Tests Required

- Assert snapshot verification detects changed, missing, and extra files.
- Assert restore returns content and file set to the pre-image and preserves snapshot storage.
- Assert a failed multi-operation patch rolls back earlier successful operations.
- Assert path traversal and reserved snapshot paths are rejected.

### 7. Wrong vs Correct

#### Wrong

```typescript
await writeFile(target, content);
// A later failure leaves a partial workspace mutation with no recovery point.
```

#### Correct

```typescript
const result = await applyWorkspacePatch(cwd, [
  { kind: "write", path: "src/config.ts", content },
]);
const verification = await verifyWorkspaceSnapshot(cwd, result.snapshotId);
```

## Scenario: Reusable Development Capabilities

### 1. Scope / Trigger

- Trigger: common development diagnostics or the repository test gate are requested repeatedly.
- Scope: `src/capabilities/development.ts` owns fixed command definitions; the PowerShell runtime owns process execution. This slice does not accept arbitrary command text.

### 2. Signatures

```typescript
registerDevelopmentCapabilities(registry: CapabilityRegistry): void;
```

Registered names are `dev.git_status`, `dev.node_version`, `dev.python_version`, `dev.project_test`, `dev.npm_install`, `dev.npm_build`, and `dev.typecheck`. The `dev.validate_project` recipe runs typecheck before tests.

### 3. Contracts

- Every capability has a stable dotted name, semantic version, platform metadata, side-effect classification, and fixed command string.
- `dev.git_status`, `dev.node_version`, and `dev.python_version` are idempotent read-only checks.
- `dev.project_test` runs the repository's declared `npm test` script, is marked `workspace_write`, and has a ten-minute timeout.
- `dev.npm_install` runs `npm install` and is marked `workspace_write`; `dev.npm_build` runs `npm run build` and is marked `workspace_write`; `dev.typecheck` runs `npm run typecheck` and is marked `read_only`.
- A non-zero exit code or interruption becomes a Fast Path failure; successful commands return structured executable, stdout, stderr, exit code, and duration fields.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Capability name is unknown | Registry rejects it; do not synthesize a command |
| Fixed executable is unavailable | PowerShell fallback behavior returns an environment error |
| Command exits non-zero | Return Fast Path `failed` with stderr/stdout detail |
| Command times out or is aborted | Return `failed`; preserve interruption through the runtime result |
| Caller supplies arbitrary command text | No API field accepts it; use a new reviewed capability instead |

### 5. Good/Base/Bad Cases

- Good: call `dev.git_status` repeatedly and receive the same structured status without model-generated shell text.
- Base: add a new fixed capability with its own version, side-effect declaration, timeout, and test.
- Bad: expose `command: string` in a generic development tool and interpolate it into PowerShell.

### 6. Tests Required

- Assert the registry exposes the fixed development names and side-effect metadata.
- Execute `dev.node_version` through Fast Path and assert structured version output.
- Cover non-zero, timeout, and missing-tool behavior at the runtime/capability boundary without nesting a full project test gate inside the test suite.

### 7. Wrong vs Correct

#### Wrong

```typescript
const script = args.command;
return runPowerShell(script);
```

#### Correct

```typescript
const devNodeVersion = "node --version"; // reviewed, versioned capability
return runPowerShell(devNodeVersion, { cwd, signal, timeoutMs: 15_000 });
```

## Scenario: Extension Profiles and Doctor

### 1. Scope / Trigger

- Trigger: reviewing or composing optional third-party Pi extensions for a Dove Pi installation.
- Scope: `src/extensions/catalog.ts` owns the package/profile manifest; `src/extensions/doctor.ts` owns offline-first compatibility checks; `src/cli.ts` and `dove_pi.py` expose the CLI boundary.
- The catalog remains the single source of truth for extension package/profile metadata. Explicit `extensions install <profile>` and the source installer may install the selected profile by delegating each package to Pi's official `pi install` command; they must not implement package resolution or settings mutation themselves. Dove Pi core, dispatch, workspace recovery, and scope policy remain authoritative.
- Profile installation is failure-tolerant by default: a failed optional package is recorded in a structured `failed` list, reported with an actionable warning, and does not prevent remaining profile entries or the Dove core from being installed. The Pi child process preserves npm optional dependencies so packages with platform-native helpers (for example `pi-lens`/`@ast-grep/cli`) can resolve their binaries. If a stale `pi-lens` install still fails, the installer removes the managed `@ast-grep/cli` and matching Windows `@ast-grep/cli-*` directories, force-reifies the native package and JS wrapper, and retries once. Callers that require all entries may opt into fail-fast behavior through the installer API.

### 2. Signatures

```typescript
inspectExtensionProfile(profile, options): Promise<ExtensionDoctorReport>;
getProfilePackages(profile): ExtensionPackageDefinition[];

type ExtensionUpdateStatus = "updated" | "unchanged" | "skipped-empty" | "skipped-disabled" | "failed";

type ExtensionInstallResult = {
  profile: ExtensionProfile;
  updated: boolean;
  updateStatus: ExtensionUpdateStatus;
  updateError?: string;
  installed: readonly string[];
  skipped: readonly string[];
  failed: readonly ExtensionInstallFailure[];
};
```

```powershell
dove-pi extensions list
dove-pi extensions show dev
dove-pi extensions doctor security
dove-pi extensions install max
```

### 3. Contracts

- Profiles are `minimal`, `dev`, `research`, `security`, and `max`; package definitions include install spec, tested version, minimum Pi/Node versions, platform, risk, conflicts, and load-order requirements.
- The combined Python installer defaults to installing the complete recommended `max` profile. `--extensions <profile>` selects another profile and `--no-extensions` skips third-party packages. Installation is explicit at the package-operation boundary and is never performed by doctor.
- `dove-pi icons setup|status|install` detects/configures the `pi-open-tui` icon mode, reports the current font state, or installs the default `DEVCOM.JetBrainsMonoNerdFont` package through winget. The installer sets `nerd` mode after a successful font install and otherwise uses `ascii`.
- `pi-open-tui` is the preferred single TUI/status authority. Profiles load `extension-settings` before `pi-open-tui`; `pi-powerbar`, `pi-powerline-footer`, and `pi-tps-status` are mutually exclusive fallback renderers and must not share a profile with `pi-open-tui`.
- `installExtensionProfile` reconciles Dove-owned identities one at a time through Pi's exact-spec `install` command. Pi 0.84.3 exposes only a single-source persistent install operation; its multi-source resolver does not persist settings, and concurrent npm mutations against the shared Pi root are unsafe. The installer therefore remains serial, reports bounded start, `[current/total]`, and completion progress on stderr, and keeps stdout for one machine-readable JSON result. `updateStatus` is `updated` when an existing Dove package was reconciled, `unchanged` when configured entries were already exact, `skipped-empty` on first install, `skipped-disabled` for `--no-extension-updates`, and `failed` when any optional entry fails; failure details remain structured and fail-open.
- Context, cumulative tokens, cache, model/provider, TPS, TTFT, duration, stalls, cost, Git, and extension-status rendering belong to the selected TUI extension. Dove publishes only compact mode/operation text (`Dove · Fast|◆ Standard|✦ Ultra · Ready|Running`) plus the current Pi thinking level through `ctx.ui.setStatus`; it must not implement a duplicate telemetry collector or footer renderer. Dove accepts only `fast`, `standard`, and `ultra`; Pi's native thinking level `max` and the extension installation profile `max` remain separate concepts. Changing Dove mode does not silently change Pi thinking; `/status` and `agent_doctor` show both values.
- Cache diagnostics are a read-only projection of Pi session entries, not a second accounting system. `/status full` and `agent_doctor` may show both the latest-request cache hit rate and the cumulative session rate, plus cache read/write totals and a best-effort miss reason (`warmup`, `model-change`, `idle`, or `prefix-change`). For custom OpenRouter provider IDs, the adapter may add `x-session-affinity` from the current Pi session unless `DOVE_PI_DISABLE_SESSION_AFFINITY=1` is set; existing provider headers take precedence.
- The last effective Pi thinking level is persisted through Pi's official `defaultThinkingLevel` setting when `thinking_level_select` fires, so a new session restores the user's previous level without a parallel configuration format.
- The preferred renderer refreshes telemetry at approximately 1 Hz; critical Dove state transitions may update immediately. Keyboard interaction remains available through Dove's single execution-policy cycle shortcut (`Ctrl+Alt+M`), Pi's native model picker (`Ctrl+P`), native exit controls (`Ctrl+D`/`/quit`), and Dove's `/status` command.
- Missing packages are warnings; Pi/Node incompatibility, invalid load order, and conflicting authority packages are errors.
- Doctor checks local settings and executables without requiring npm/network access. It must not rewrite `~/.pi/agent/settings.json` or silently install software.
- Third-party sub-agent, background-task, plan, workspace, or security packages must remain optional when they overlap a Dove Pi authority contract.
- The Dove `auto` tool profile may use the active normalized Trellis task (status and bounded file-path preview) as an intent hint in addition to the current prompt. It must not use task titles alone as a broad trigger, and Ultra must not force all tools or unsafe parallel dispatch.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Pi settings missing or malformed | Report a warning and continue offline checks |
| Extension is not configured | Report `not-configured` warning |
| Minimum Pi/Node version not met | Report an error |
| Required load order is wrong | Report a `load-order` error |
| Profile contains conflicting authorities | Report a `profile-conflict` error |
| Optional executable is missing | Report a warning; never install it implicitly |

### 5. Tests Required

- Assert profile order places extension-settings before pi-open-tui and no default profile contains another footer/TUI authority.
- Assert missing package configuration produces warnings without network calls.
- Assert invalid load order and conflicting max authorities are detected.

## Scenario: Trellis-First Project Provider Firewall

### 1. Scope / Trigger

- Trigger: starting Dove Pi in a project, reading Trellis context, or changing a Trellis task.
- Scope: `src/project-provider/**`, `src/trellis-adapter/**`, `src/core/execution-ledger.ts`, and the Pi adapter. Trellis is the project-data authority; Dove is the execution-data authority.

### 2. Signatures

```typescript
createProjectProvider(startPath?: string): ProjectProvider;
withProjectMutationLock<T>(projectRoot: string, action: () => Promise<T>): Promise<T>;
ExecutionLedger.findIncompleteProjectMutations(): Promise<readonly ProjectMutationIntent[]>;
```

```powershell
dove-pi project
dove-pi project init
dove-pi project update
dove-pi project bind trellis|lightweight
```

### 3. Contracts

- Provider selection is deterministic: `.dove/project.json` wins, otherwise the nearest `.trellis/` wins, otherwise a visible `lightweight` provider is used. Lightweight mode must not create a second task/spec database.
- Trellis owns tasks, PRD/design/implementation files, specs, workflow, journals, and memory. Dove owns capabilities, policy, approvals, runtime state, evidence, and the execution ledger. Records correlate `trellis:<taskId>` with Dove execution IDs; they never substitute Pi session IDs for task IDs.
- Dove derives continuation as `current`, `single_candidate`, `ambiguous`, or `none` from the normalized public `ProjectContextSnapshot`. Pi tools expose the same projection and workflow guidance performs at most one structured status read; it never probes guessed Trellis/Pi private runtime paths or mirrors task state.
- A natural-language continuation request exposes zero provider tools even when Pi started with an explicit tool selection; the next non-continuation request restores that user selection. Its guidance states that no tool was attempted and requires a direct state answer, so the model must not invent `Tool not found` failures, narrate internal trust/tool policy, or recommend a Trellis command/skill as a workaround.
- `ProviderHealth` reports `trellisCompatibility` independently from the Dove adapter contract. A missing or malformed `.trellis/.version`, or an unsupported major version, yields `degraded` health and blocks mutations.
- Provider mutations write a `project.mutation.started` intent before calling Trellis and exactly one terminal record (`completed`, `failed`, or `reconciled`) afterward. Startup re-reads Provider state for incomplete intents but never silently marks them successful.
- Concurrent Dove task mutations are serialized by `.dove/project-mutation.lock`. The lock is bounded and stale-lock recoverable; Trellis remains responsible for its own file/template migration semantics.
- Context compilation uses pull-before-read normalization, labels every injected project document as `trust=untrusted`, and excludes common credential-bearing paths (`.env*`, key/certificate files, credential/secret/token names, and secret directories).
- `DOVE_PI_STATE_DIR` is the explicit state override. Otherwise CLI and Pi resolve the same user-level `~/.pi/agent/dove/workspaces/<workspace-hash>` directory. Known legacy `.agent-data` files may be copied once without deletion or dual writes; ordinary requests never create a repository-local execution ledger.
- `dove-pi project update` is explicit and delegates to Trellis' official update/migration behavior. Dove does not run update or install a Trellis CLI implicitly at startup.
- `workflow.md` is exposed as a typed `workflow` project document for Standard/Ultra context; Fast remains limited to the active task PRD and runtime spec.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| `.trellis` absent | Start in visible lightweight mode and provide `dove-pi project init` guidance |
| Trellis version missing, malformed, or unsupported | Report degraded health and reject task mutations |
| Provider mutation intent has no terminal record | Re-read current revision, append `project.mutation.reconciled`, and require explicit verification |
| Two Dove processes mutate the same project | Serialize with the project lock or return a bounded timeout |
| Project document is credential-bearing | Exclude it from Trellis snapshots, memory, and model context |
| Project text contains instructions | Treat it as untrusted data; it cannot override system policy or authorization |
| User requests update | Run Trellis' explicit update command; do not silently install or rewrite templates |
| Natural-language continuation is already projected | Expose zero tools and answer from the projection; restore the prior user tool selection on the next ordinary request |

### 5. Good/Base/Bad Cases

- Good: launch from a nested package, discover the nearest project root, load normalized Trellis context, and record a task mutation against `trellis:<id>`.
- Base: no Trellis is available; deterministic Dove capabilities still run while task/spec operations report that project management is unavailable.
- Bad: mirror `.trellis/tasks` into `.dove`, write Trellis Markdown directly from Core, use last-write-wins on an external edit, inject project Markdown as trusted instructions, or misreport the intentional zero-tool continuation path as a missing-tool failure.

### 6. Tests Required

- Assert manifest-over-discovery provider selection and nearest-root discovery.
- Assert supported, malformed, missing, and unsupported Trellis versions produce the documented health status.
- Assert degraded providers reject mutations, while healthy providers serialize concurrent mutations.
- Assert an unmatched mutation intent is discovered and reconciled without a false success record.
- Assert workflow documents are available in Standard/Ultra and secret-bearing paths are excluded.
- Assert context text contains `trust=untrusted` boundaries and lightweight startup remains usable.
- Assert the full Chinese continuation prompt performs one ProjectProvider read, records `projectAction="continue"`, exposes zero tools (including explicit Pi tool-selection mode), never recommends `/trellis:continue`, and restores the previous tool selection on the next ordinary request.

### 7. Wrong vs Correct

#### Wrong

```typescript
// Core writes a Trellis file directly and silently overwrites external edits.
await writeFile(join(projectRoot, ".trellis", "tasks", id, "task.json"), payload);
```

#### Correct

```typescript
await ledger.appendProjectMutationStarted(taskId, stepId, mode, mutationId, "start", "trellis", "before");
await provider.runTaskOperation("start", [taskPath]);
await ledger.appendProjectMutationCompleted(taskId, stepId, mode, mutationId, "start", "trellis", provider.getContext().revision);
```

## Scenario: Skill Discovery Diagnostics

Pi remains the owner of skill loading and execution. Dove exposes a read-only
diagnostic projection so users can verify what Pi can discover without
duplicating skill parsing or changing project files.

- Discover `.agents/skills/**/SKILL.md` from the current directory and parents.
- Prefer the nearest project copy when the same skill name is inherited from a
  parent directory.
- Expose the projection through Pi `/skills [query]` and `dove-pi skills [query]`.
- Keep skill documents as project content; discovery must not execute them or
  treat their text as a policy override.
- Dove's `/project init` hides Trellis platform flags and uses the current
  non-interactive shared-skill compatibility preset `--yes --codex --no-monorepo`.
- The Dove boundary must not install Trellis' competing `.pi` extension; it
  reports provider health and discovered Trellis skill count after init.
- A missing Trellis project must not block Pi's startup lifecycle with a synchronous confirmation. Startup shows a non-blocking hint; bootstrap confirmation is deferred to the first implementation, planning, or task-oriented request, while `/project init` remains an explicit immediate path.

## Scenario: Managed Dove Pi Installation and Stable Updates

### 1. Scope / Trigger

- Trigger: changing `dove_pi.py`, `installer/**`, release packaging, the stable launcher, managed extension reconciliation, or the bundled Trellis dependency.
- Scope: Windows V2 installs under `%LOCALAPPDATA%\DovePi`; Pi user state, project `.trellis/`, global Trellis, and development checkouts remain external.

### 2. Signatures

```text
dove-pi update [--check] [--verify quick|full|none] [--json] [--no-extensions]
dove-pi repair [--verify quick|full|none] [--json]
dove-pi rollback [--json]
dove-pi uninstall --yes [--json]
dove-pi --version
DOVE_PI_HOME=<absolute test root>
```

```python
ComponentReconciler = Callable[[InstallState], Sequence[ManagedExtensionState]]

ManagedInstaller.install_source(
    source: Path,
    profile: str | None,
    verify: str,
    reconcile_components: ComponentReconciler | None,
    source_asset: tuple[Path, Path, str] | None,
) -> MaintenanceResult
ManagedInstaller.update(
    check: bool,
    verify: str,
    reconcile_components: ComponentReconciler | None,
) -> MaintenanceResult
ManagedInstaller.repair(
    verify: str,
    reconcile_components: ComponentReconciler | None,
) -> MaintenanceResult
ManagedInstaller.rollback() -> MaintenanceResult
ManagedInstaller.uninstall(confirmed: bool) -> MaintenanceResult
```

### 3. Contracts

- The launcher reads `state/install.json` schema 2 and may execute only a path strictly below `app/versions` containing `dove_pi.py`, `release.json`, and `node_modules`.
- The stable Python launcher is the public command router as well as the Pi entry point. Every documented local Dove command family (including `capability`, `rpc`, and `mcp`) must be classified explicitly and forwarded to the bundled TypeScript CLI; unknown/interactive arguments alone may fall through to Pi. Adding a CLI command without updating and testing this router is an incomplete cross-layer change.
- Exact `version` and `--version` requests are handled before Pi launch and read both release-locked identities from the packaged `package.json`, producing `Dove Pi <dove-version> (Pi <pi-version>)`.
- Install into a staging sibling, run locked dependency installation and verification, move to an immutable version, then activate with atomic state replacement. Retain current and previous.
- Install, update, and repair hold the same cross-process maintenance lock through application activation, managed-component reconciliation, final state persistence, launcher rewrite, and pruning. The component reconciler is an injected callback so the Python installer does not duplicate the TypeScript extension catalog; never release the maintenance lock and reacquire a separate component lock between these steps.
- A healthy current release with the same stable version is an application no-op: no archive download and no `npm ci`. Launcher repair and Dove-managed extension reconciliation may still run.
- The public Windows bootstrap owns prerequisite setup. It preserves compatible Python `>=3.10` and Node `>=22.19.0`; missing, incomplete, or older runtimes use only the exact reviewed winget package IDs `Python.Python.3.12` and `OpenJS.NodeJS.LTS`, refresh process PATH, and are revalidated before any archive activation. When winget is unavailable or the runtime remains unusable, fail with the exact package command and bootstrap retry instruction.
- `repair --verify none` checks the local manifest and required runtime files. `quick` additionally runs typecheck and Pi smoke against each candidate; `full` also runs the complete test suite. A candidate that fails the requested level is not healthy and repair proceeds to previous, verified cache, or stable release.
- A source checkout without complete `release.json` component/profile metadata is hydrated only after `npm ci` by the existing TypeScript `release:manifest` generator. The generated manifest preserves the source release ID/commit and becomes the installed manifest. A formal release manifest must instead match the lockfile and TypeScript extension catalog exactly; mismatch aborts before activation.
- GitHub stable releases, not a checkout branch, are the update authority. Bootstrap and managed update read `releases/latest/download/release.json` first and derive the fixed archive/checksum URLs from that response; the normal path never requires GitHub's unauthenticated REST API. A resolved tag, manifest version/release ID, archive manifest, and checksum must identify the same immutable release. Managed update never fetches, merges, or resets a checkout and never updates global Trellis.
- `@mindfoldhq/trellis` is an exact application dependency. Project init/update invokes its absolute bundled entry; application updates never rewrite existing project `.trellis/`.
- Reconcile only selected-profile extension identities through `pi install npm:<name>@<exact-version>`. Untargeted `pi update --extensions` is forbidden.
- Optional component failures do not roll back an already verified application release; the reconciler records each failure as `degraded`, final state is written under the same maintenance lock, and offline doctor exposes the degraded ledger.
- `--json` reserves stdout for exactly one JSON document on both success and failure. During managed extension reconciliation, TypeScript redirects both Pi/npm child streams to stderr; Python captures only the TypeScript result stdout and inherits stderr live. Human diagnostics and subprocess progress must not corrupt stdout, and captured failure excerpts must be bounded. Mutating maintenance writes a bounded local success/failure log; `update --check` may read remote metadata but must not acquire the mutation lock, write state, or create a maintenance log.
- A bootstrap-provided archive/checksum/tag is SHA-verified again and copied into the managed release cache before activation so `repair` can rebuild offline. Release tag, advertised version, and archive manifest version must match.
- Release publication is tag-only and fail-closed. Before the GitHub publish action, readiness validation requires a clean source checkout, `v<package-version>`, exact package/lock/manifest components, one valid archive root, matching embedded and external manifests, a matching checksum, parseable PowerShell bootstrap, and exactly the four documented assets.
- Tests and development E2E set a temporary `DOVE_PI_HOME`; they never modify real `%LOCALAPPDATA%\DovePi`, `~/.pi/agent`, global npm, or project state.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| SHA mismatch, unsafe zip entry, `npm ci`, or verification failure | Abort before activation; current remains unchanged |
| Current exists but required files are missing | Validate and run previous with a repair warning |
| Install path escapes `app/versions` | Reject it; never execute or delete it |
| Live maintenance lock exists | Exit with owner PID/command; do not overwrite it |
| Dead maintenance lock exists | Rotate it to a stale diagnostic before retrying |
| Maintenance lock metadata is malformed or unreadable | Fail closed with an actionable diagnostic; never guess that the owner is stale |
| `repair --verify quick/full` candidate fails its requested commands | Reject that candidate and continue the documented recovery order |
| Packaged manifest differs from generated lock/catalog metadata | Abort before activation; do not silently rewrite a formal release |
| GitHub tag/version differs from archive manifest | Reject the asset and preserve current |
| GitHub REST API is rate-limited | Continue through direct stable Release assets; do not fall back to a mutable branch |
| Python/Node is absent or too old during bootstrap | Install the reviewed exact winget package, refresh PATH, and revalidate before downloading/activating Dove |
| winget is absent or the installed runtime remains unavailable | Stop before activation and print one exact install-and-retry action |
| Optional managed extension fails | Activate app and record `degraded` |
| A documented Dove command reaches the launcher | Route it to the bundled local CLI; never pass it through as a Pi prompt/argument |
| Managed extension child emits progress | Stream it on stderr while preserving exactly one TypeScript JSON document on stdout |
| JSON maintenance command fails | Emit one parseable error document on stdout and put human details in the local log/stderr |
| `update --force` is supplied | Reject with a repair instruction; never reset a checkout |
| Uninstall lacks `--yes` | Refuse and preserve all data |

### 5. Good / Base / Bad Cases

- Good: under one maintenance lock, verify a versioned release, prepare/activate a sibling, reconcile exact Dove extension specs, persist final state, rewrite launchers, and prune.
- Base: stable matches a healthy current; repair launcher/state and skip archive/dependency work.
- Bad: release the application lock before extension reconciliation, duplicate the TypeScript catalog in Python, point the launcher at a checkout, run `git pull`, update global Trellis, or broadly update every Pi extension.

### 6. Tests Required

- Test state schema/path filtering, activation failure, zip-slip, and checksum rejection.
- Use a separate process to prove only one maintenance command owns the lock.
- Execute the PowerShell launcher with incomplete current and complete previous; assert previous runs.
- Assert same-version update performs no download and invokes no npm runner.
- Assert another maintenance process cannot interleave between activation, component reconciliation, and final state persistence.
- Assert `repair` applies `none`, `quick`, and `full` verification to existing current/previous candidates and falls through on failure.
- Assert a source checkout with no generated metadata is hydrated after `npm ci`, while a mismatched formal release manifest is rejected.
- Assert malformed lock metadata fails closed and JSON success/failure paths each produce exactly one parseable stdout document.
- Assert bootstrap assets populate a verified cache usable by offline repair, and tag/archive version mismatch is rejected.
- Assert direct manifest-first discovery succeeds without any REST API request and rejects malformed manifest, redirect-tag/version, and release-ID mismatches.
- Dot-source bootstrap helpers under an explicit test-only switch and cover compatible, missing, outdated, winget-unavailable, and post-install-still-missing prerequisites without invoking real winget or changing machine/user PATH.
- Assert release readiness rejects dirty, mismatched, unsafe, checksum-invalid, or partial four-asset bundles before the publication action.
- Assert offline doctor reports current/previous managed state and degraded managed extensions without network access.
- Invoke each documented non-maintenance command family through `dove_pi.py` and assert it reaches the Dove CLI rather than Pi; keep this routing test isolated from the real user installation and Pi state.
- Assert `dove-pi --version` reports both packaged Dove and Pi versions without launching Pi, and exact-spec extension reconciliation remains serial with bounded progress on stderr and one JSON stdout result.
- Assert valid V1 profile migration and corrupt-manifest fallback leave the checkout unchanged.
- Assert uninstall removes only known managed children while preserving Pi data, project `.trellis/`, checkouts, third-party extensions, and unknown caller-owned files.
- Validate release metadata against exact `package.json` and `package-lock.json` Pi, TUI, and Trellis versions.

### 7. Wrong vs Correct

#### Wrong

```python
subprocess.run(["git", "reset", "--hard", "origin/master"], cwd=checkout)
subprocess.run(["npm", "update", "-g", "@mindfoldhq/trellis"])
```

#### Correct

```python
with MaintenanceLock(layout.lock_path, "update"):
    prepared = transaction.prepare_source(release_root, manifest, verify="quick")
    state = transaction.activate(prepared, state, command="update")
    state.managed_extensions = list(reconcile_components(state))
    write_state(layout, state, command="update")
    write_managed_launchers(layout)
```
