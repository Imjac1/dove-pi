# Personal Agent Capability Runtime

> **Scope:** Capability Protocol, external adapters, dispatch calibration, transactional workspace operations, and reusable development capabilities.
>
> **Canonical router:** [Personal Agent Runtime Contract](./personal-agent-runtime.md)
> **Related specifications:** [personal-agent-request-runtime](./personal-agent-request-runtime.md), [personal-agent-project-context](./personal-agent-project-context.md)

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

JSON-RPC: capabilities/list | capabilities/invoke | diagnostics/status
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
| Pi | The accepted Pi tool call, after the explicit Dove read-only switch is checked | Dove adds no second confirmation; headless Pi calls work, while read-only mode blocks side effects |
| Local CLI | The local process parses the explicit `--approve` flag and injects the callback | Omitting the flag denies side effects |
| JSON-RPC stdio | None in protocol `1.0.0` | Request payloads cannot self-authorize; side effects fail closed |
| MCP stdio | None in protocol `1.0.0` | `dove_invoke` exposes no approval argument; side effects fail closed |

**Held by**, entry point by entry point. Four were read; the fifth was implemented and unheld, and a holder was added for it.

| Entry point | Held by |
|---|---|
| Direct Core | `tests/capability-protocol.test.ts`, where a payload `granted` with no callback is denied |
| Pi | `tests/pi-adapter.test.ts`, which sets `DOVE_PI_READ_ONLY` and restores it |
| Local CLI | `tests/cli-approval.test.ts` - **added because this row was implemented and held by nothing** |
| JSON-RPC stdio | `tests/local-rpc.test.ts`, the approval refusals |
| MCP stdio | `tests/mcp-adapter.test.ts`, which asserts `dove_invoke` exposes no `approve` argument |

**The CLI row is worth the note it carries.** Its behaviour was implemented at `src/cli.ts:363` and `src/cli.ts:374``, and searching the tests for the flag,
for `createLocalAdapter`, and for `capability run` found nothing - the only `"approve"` literal in the suite is the MCP assertion that it is
*absent* there. **A safety row with no holder is the defect this column exists to make visible.**

JSON-RPC is newline-delimited JSON over local stdio, limits each input line to
128 KiB, and accepts only `capabilities/list`, `capabilities/invoke`, and the
read-only `diagnostics/status` projection. MCP is
implemented through the official SDK and exposes only `dove_capabilities`,
`dove_context`, and `dove_invoke`. Network/cloud transport, arbitrary shell
fields, and implicit vendor accounts are outside these adapter contracts.

#### Plugin capability projection

Reviewed Pi plugins remain host-owned providers for Pi-specific TUI, web and
browser access, MCP clients, diagnostics, structured questions, planning, and
background work. The extension catalog projects package/tool availability as
`available`, `configured`, or `degraded` for doctor and discovery. A projected
plugin capability never becomes a Core executor. Pi remains its tool authority;
Dove's request plan cannot grant or remove it, while shared validation, ledger,
and evidence contracts still apply to Dove-owned executors.

#### Interoperable project context and evidence

- Dove's native `ProjectProvider`, legacy project documents, `AGENTS.md`, `CLAUDE.md`, Agent
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
- `diagnostics/status` reads the append-only execution ledger without executing
  capabilities and returns `schemaVersion: 1` plus optional `lastTerminal`,
  `lastResourceObservation` and `lastRefusals` records. Filters may restrict
  `sessionId` and/or `requestId`; the projection bounds terminal strings, stop
  reasons, refusal reasons, and numeric resource fields, and never echoes
  arbitrary ledger details - which is why a refusal carries its gate and reason
  but not its remediation, that being long prose. A refusal is carried at all
  because a request can be refused and continue: `checkpointed`, `blocked` and
  "no active criterion" all return `block` without ending the request, and the
  refusal is what the operator has to act on. Pi's `agent_doctor`, CLI `doctor`
  (under `requestDiagnostics`) and the in-session `/status full` use the same
  projection so headless and interactive clients can attribute a generic host
  `Operation aborted`, or a refusal that wrote no terminal, to one stable
  origin and gate. The existing CLI install diagnostics array remains backwards
  compatible alongside this projection.
- **A mode's grant list and the registry are different things, and the gap between them is a deployment fact.** A
  mode declares what it *authorizes*; the registry holds what this build *implements*. Six of the nine capabilities
  the shipped modes declare have no implementation (`repo.read`, `report.write`, `net.scan`, `exploit.run`,
  `market.read`, `order.submit`, checked 2026-09-27), so a mode naming them is stating what its environment must
  provide - `modes/trading/MODE.md` says so in as many words. **Loading does not refuse the mismatch**, because a mode
  file is a portable document and the registry is a deployment; the host's tool-call boundary refuses it instead, and
  that refusal comes **before** the approval prompt and **before** the effect claim: an action that cannot run has no
  arguments worth judging and must not spend the operator's attention.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Unsupported protocol or invalid capability semver | Reject before dispatch |
| Arguments fail the capability's declared parameter schema | Reject before approval or execution |
| Request claims approval without a trusted host callback | Deny side effects; never start the executor |
| RPC input line exceeds 128 KiB | Return one bounded error for that line - `-32600`, since an oversized *request* is an invalid request, not a JSON parse failure - discard through its newline, then continue |
| Duplicate project authorities | Preserve source labels and report a conflict; never silently merge |
| Evidence reference names credential/key material | Exclude it at the shared execution boundary |
| Capability platform is unsupported | Return `unsupported_platform` with an execution correlation ID |
| An invocation names an action the mode grants and the registry does not implement | Refuse at the host's tool-call boundary, before the approval prompt and before any effect claim |
| An invocation names an action the mode does not grant | Refuse as a scope denial: that is a policy decision, and it is reported ahead of the deployment fact |
| Diagnostics filter is not an object or contains non-string IDs | Return a JSON-RPC error without reading or mutating state |

**Held by**, row by row: the test that goes red if the behaviour changes. Each of these was read, not guessed, and one of them is named by
file only because its case was not read to a case.

| Condition | Held by |
|---|---|
| Unsupported protocol or invalid capability semver | `tests/capability-protocol.test.ts`, the invalid-semver case |
| Arguments fail the declared parameter schema | `tests/capability-protocol.test.ts`, the case whose own name says before execution |
| Request claims approval without a trusted host callback | `tests/local-rpc.test.ts`, three `approval_denied` assertions |
| RPC input line exceeds 128 KiB | `tests/local-rpc.test.ts`, an oversized line followed by a valid one |
| Duplicate project authorities | `tests/interoperable-context.test.ts`, the `conflicts` assertion |
| Evidence reference names credential/key material | `tests/context.test.ts`, the sensitive-path case |
| Capability platform is unsupported | `tests/capability-protocol.test.ts`, the status name |
| Action granted by the mode and not implemented | `tests/host-work-mode.test.ts`, which also holds that nothing is put to the operator |
| Action not granted by the mode | `tests/action-policy.test.ts` - **the case is not named because it was not read to a case** |
| Diagnostics filter is not an object | `tests/local-rpc.test.ts`, the case added with the corrected code |

**What these pointers are, and what they are not.** A path here says where to look, and a check holds every one of them to a file that
exists. **It does not claim that the test holds the promise** - that judgement needs a reader, and a check which implied it would be the kind
of control this project refuses to fake. The pointers are a reading aid with a resolution check; the reading is still the work.

### 5. Good / Base / Bad Cases

- Good: Pi, CLI/RPC, and MCP invoke the same reviewed registry entry and
  receive the same versioned result/evidence shape with distinct correlations.
- Base: a read-only capability needs no approval, but still passes schema,
  platform, ledger, evidence, and response validation.
- Bad: trust `approval: "granted"` or `approval: "not_required"` from an RPC/MCP
  payload, copy a Pi plugin executor into Core, buffer an unbounded RPC line
  before checking its size, or expose raw ledger records through diagnostics.

### 6. Tests Required

- A granted-but-unregistered capability is refused at the boundary with no approval prompt and no effect claim; a
  registered one runs; an ungranted one is refused as a scope denial. Each of the three is load-bearing on its own -
  removing either check must fail a case.
- A mode naming an unimplemented capability still **loads**, because the mismatch is a deployment fact and not a
  malformed mode.

The vendor-account-free smoke matrix must exercise one read-only capability
through Direct Core, CLI/JSON-RPC, official MCP transport, and Pi's registered
`agent_run_capability` tool. Every row must return the Capability Protocol
version, the same capability name/version and success status, a caller request
ID, and a non-empty execution ID. The Pi row must also demonstrate that the
registered tool is backed by the shared invocation service and adds no Dove UI
confirmation. Separate contract
tests cover terminal outcomes, ledger correlation, bounded RPC methods,
fail-closed RPC/MCP authorization, normalized context conflicts, and evidence
secret filtering. Diagnostics tests assert session/request filtering, bounded
terminal/resource projection, and parity with Pi doctor. No interoperability
claim requires a live provider account.

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
