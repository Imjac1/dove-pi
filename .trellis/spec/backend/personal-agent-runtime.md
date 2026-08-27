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

## 5. Good / Base / Bad Cases

- Good: resolve `windows.host_info`, run it directly, return typed JSON and a ledger record.
- Base: no matching capability; let the planner create or select a reusable capability outside the Fast Path.
- Bad: embed a Pi `ExtensionAPI` object in a core capability or regenerate a long PowerShell script for an already-registered capability.

## 6. Tests Required

- Assert core modules type-check without Pi imports.
- Assert mode changes preserve the running-step snapshot and affect the next step.
- Assert exact capability resolution and required-argument validation.
- Assert PowerShell exit code, stderr, timeout, cancellation, and fallback behavior.
- Assert Pi adapter registers tools/commands/shortcuts without changing core contracts.
- Assert Trellis absence does not prevent runtime initialization.

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

## Design Decision: Adapter Firewall

Pi and Trellis are replaceable adapters, not core dependencies. This keeps Pi upgrades localized to `src/pi-adapter/**` and allows lightweight operation without full Trellis workflow injection.

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

`TrellisSnapshot` exposes both compatibility file lists and structured `tasks`, `memories`, and optional `activeTaskPath`.

### 3. Contracts

- A task directory is represented by `TrellisTaskRecord { path, id, title, status, priority?, files }` from `task.json` plus Markdown files.
- A memory file is represented by `TrellisMemoryRecord { path, kind, developer? }`, where `kind` distinguishes `journal`, `index`, and `document`.
- The current session's `.trellis/.runtime/sessions/*.json` `current_task` is resolved relative to the workspace and compared to the task directory using normalized absolute paths.
- Fast mode includes only the active task PRD and the runtime spec as required context. Standard/Ultra use relevance scoring; Ultra may include typed memory records without an application token cap.
- The Pi adapter must pass its selected `ProjectProvider` into context compilation. A cwd convenience wrapper may exist for compatibility, but it must delegate to the same provider projection rather than reading Trellis files directly.
- Dove's stable instructions are returned as `before_agent_start.systemPrompt`; dynamic project guidance is emitted as a versioned `personal-agent-context` custom message only when its context epoch changes (mode, Trellis revision, workflow hint, or active tool policy). Unchanged epochs do not append another snapshot.
- Keep provider prompt-cache prefixes stable: the static Dove system-prompt section must not include per-request mode, task, workflow, or project text. The `context` transform may remove legacy unversioned `personal-agent-context` entries for compatibility, but must never move or rebuild the current v2 snapshot on each provider request.
- In `auto` tool mode, intent-specific tools are session-monotonic: once enabled they remain active until the user explicitly changes the tool profile or starts a new session. Avoid repeated `setActiveTools()` calls when the effective set is unchanged, because tool definitions participate in the provider prompt prefix.
- When `pi-hashline-edit-pro` is present, the Pi adapter treats hashline `replace`/`insert` (and undo when available) as the edit authority and must suppress the built-in `edit` tool in every profile, including explicit `full`; this prevents another extension from reintroducing the built-in mutation path.
- `/dove-tools reset` is an explicit session-stage reset: it returns to the compact core set and lets a later `auto` request add intent tools again. The reset is allowed to change the tool prefix because it is user initiated.
- Fast and Standard apply bounded total context-character budgets for broad retrieval. Ultra has no artificial application token cap and relies on relevance scoring, content deduplication, per-document compaction, and Pi/provider model-context limits.
- When Pi exposes current context usage and model window, the adapter derives a remaining-character budget with response headroom and passes it to the compiler. This is a dynamic model limit guard, not a fixed Ultra budget.
- Model-facing project indexes use bounded previews for large collections (for example, the first 50 task records plus an omission count); complete raw collections remain provider-local details.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| `.trellis` absent | Return `enabled: false` with empty structured collections; compile lightweight context |
| Missing `task.json` | Discover Markdown files and use directory name/default `unknown` metadata |
| Malformed `task.json` | Ignore metadata parse failure without losing file discovery |
| Missing session directory | Leave `activeTaskPath` unset |
| Stale session JSON | Ignore that session entry and continue scanning |

### 5. Good/Base/Bad Cases

- Good: load the active task's PRD and runtime spec in Fast mode, then rank relevant memory only when requested.
- Base: a Trellis project with task files but no active session still provides non-required task context in Standard/Ultra.
- Bad: have the context layer parse `task.json` or duplicate session-path logic independently.

### 6. Tests Required

- Assert task id/title/status/priority and active path are decoded from the fixture workspace.
- Assert journal and index files receive distinct memory kinds.
- Assert malformed or missing metadata does not prevent snapshot creation.
- Assert Fast mode keeps active PRD/runtime spec behavior and Trellis-disabled mode remains loadable.
- Assert request-scoped Dove context is not persisted, legacy context messages are filtered, and broad Standard retrieval stays within its character budget.

### 7. Wrong vs Correct

#### Wrong

```typescript
const active = path.startsWith(session.current_task ?? "");
// Prefix matching can select a similarly-named task and leaves metadata untyped.
```

#### Correct

```typescript
const snapshot = readTrellisSnapshot(cwd);
const active = snapshot.tasks.find((task) => task.path === snapshot.activeTaskPath);
// One adapter owns normalization, metadata decoding, and active-task identity.
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

## Scenario: Dove Pi Installation Boundary

### 1. Scope / Trigger

- Trigger: installing the repository on Windows or launching the configured Agent from a target project.
- Scope: `dove_pi.py` is the combined installer and launcher; `bin/dove-pi.cjs` is only the npm shim. The official Pi package remains an implementation dependency and is not renamed or forked.

### 2. Signatures

```powershell
python dove_pi.py install [--profile PROFILE] [--verify quick|full|none] [--no-font] [--no-path] [--clean]
python dove_pi.py setup [same options as install]
dove-pi [official-pi-options]
```

### 3. Contracts

- The installer requires Python, Node.js `>=22.19.0`, and npm. On the first install (or with `--clean`) it uses `npm ci`; subsequent installs use lockfile-aware `npm install --prefer-offline` instead of a broad `npm update`, so repeated setup is faster and does not unexpectedly upgrade the dependency graph. When a selected profile already has configured Pi packages, it first delegates extension updates to Pi's official `pi update --extensions`, then installs only missing profile entries through Pi's official `pi install` command. Update failure is reported as a warning and does not prevent profile reconciliation; `--no-extension-updates` opts out. It installs the `max` extension profile by default (or the selected profile, unless `--no-extensions` is supplied), attempts the Windows Nerd Font installation through winget unless `--no-font` is supplied, and runs quick type-check/Pi smoke verification by default. `--verify full` adds the complete test suite and `--verify none` skips checks. If winget is unavailable or the font install fails, it configures the TUI to use ASCII icons and continues. `setup` is a user-friendly alias for `install`; `--profile` and `--verify` are the primary options, while `--extensions` and `--skip-checks` remain compatibility aliases.
- The same `dove_pi.py` entry point launches the configured Pi host when invoked without the `install` subcommand.
- Invoking `python dove_pi.py` with no arguments must launch Pi (it must not index an empty argv list); installer help
  keeps the common controls (`--verify`, `--no-font`, `--no-path`, `--clean`) separate from advanced profile controls.
- Repeated setup should keep extension installation output concise: already configured packages are skipped without one
  noisy line per package unless verbose diagnostics are explicitly requested.
- The launcher keeps `process.cwd()` as the target workspace and injects `.pi/extensions/personal-agent.ts` from the installed Dove Pi source tree.
- By default the installer creates `%LOCALAPPDATA%\DovePi\bin\dove-pi.ps1` and `dove-pi.cmd`, and adds that directory to the user PATH. `--no-path` suppresses the PATH mutation. The `.cmd` file is ASCII-only and resolves its sibling PowerShell launcher via `%~dp0`, so non-ASCII user/repository paths never need to be encoded into the batch file; the PowerShell launcher is UTF-8 with BOM for PowerShell 5.1/7 compatibility.
- The underlying `@earendil-works/pi-coding-agent` executable remains `pi`; only the user-facing project launcher is named `dove-pi`.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Node or npm missing | Stop before dependency mutation |
| Node below 22.19.0 | Stop with an actionable version error |
| Lockfile present and dependencies absent (or `--clean`) | Use `npm ci` for reproducible installation |
| Lockfile present and dependencies already present | Use `npm install --prefer-offline` and retain the lockfile |
| Quality gate fails | Stop unless `-SkipChecks` was explicitly supplied |
| User PATH already contains launcher directory | Do not duplicate the entry |
| Target project launched from another directory | Preserve that directory as Pi's working directory |

### 5. Good/Base/Bad Cases

- Good: clone Dove Pi, run `python dove_pi.py install`, open a new PowerShell window, and invoke `dove-pi` from a target project.
- Base: use the generated absolute launcher path when PATH changes are not desired.
- Bad: rename or replace the official Pi package, or launch with the Agent repository as the working directory when the target project is elsewhere.

### 6. Tests Required

- Assert the package exposes a `dove-pi` bin entry and the shim delegates to `dove_pi.py`.
- Run Python syntax/parameter checks in CI or a Windows smoke job.
- Assert the launcher preserves the caller's working directory and forwards Pi arguments.

### 7. Wrong vs Correct

#### Wrong

```powershell
pi -e C:\path\to\extension.ts
# Uses whichever global Pi happens to be first in PATH.
```

#### Correct

```powershell
dove-pi
# Uses the installed Dove Pi launcher and its tested Pi dependency.
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

type ExtensionUpdateStatus = "updated" | "skipped-empty" | "skipped-disabled" | "failed";

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
- `installExtensionProfile` delegates updates to Pi's `update --extensions` and exposes a stable `updateStatus`: `updated` after a successful update, `skipped-empty` when no packages are configured, `skipped-disabled` for `--no-extension-updates`, and `failed` when update fails. Update failure retains `updateError` and remains fail-open; profile reconciliation still runs. Stage summaries go to stderr so `dove-pi extensions install` keeps stdout machine-readable JSON.
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
- `ProviderHealth` reports `trellisCompatibility` independently from the Dove adapter contract. A missing or malformed `.trellis/.version`, or an unsupported major version, yields `degraded` health and blocks mutations.
- Provider mutations write a `project.mutation.started` intent before calling Trellis and exactly one terminal record (`completed`, `failed`, or `reconciled`) afterward. Startup re-reads Provider state for incomplete intents but never silently marks them successful.
- Concurrent Dove task mutations are serialized by `.dove/project-mutation.lock`. The lock is bounded and stale-lock recoverable; Trellis remains responsible for its own file/template migration semantics.
- Context compilation uses pull-before-read normalization, labels every injected project document as `trust=untrusted`, and excludes common credential-bearing paths (`.env*`, key/certificate files, credential/secret/token names, and secret directories).
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

### 5. Good/Base/Bad Cases

- Good: launch from a nested package, discover the nearest project root, load normalized Trellis context, and record a task mutation against `trellis:<id>`.
- Base: no Trellis is available; deterministic Dove capabilities still run while task/spec operations report that project management is unavailable.
- Bad: mirror `.trellis/tasks` into `.dove`, write Trellis Markdown directly from Core, use last-write-wins on an external edit, or inject project Markdown as trusted instructions.

### 6. Tests Required

- Assert manifest-over-discovery provider selection and nearest-root discovery.
- Assert supported, malformed, missing, and unsupported Trellis versions produce the documented health status.
- Assert degraded providers reject mutations, while healthy providers serialize concurrent mutations.
- Assert an unmatched mutation intent is discovered and reconciled without a false success record.
- Assert workflow documents are available in Standard/Ultra and secret-bearing paths are excluded.
- Assert context text contains `trust=untrusted` boundaries and lightweight startup remains usable.

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
