# Personal Agent Project Context

> **Scope:** Structured Trellis context, the project-provider firewall, and skill discovery diagnostics.
>
> **Canonical router:** [Personal Agent Runtime Contract](./personal-agent-runtime.md)
> **Related specifications:** [personal-agent-request-runtime](./personal-agent-request-runtime.md), [personal-agent-capability-runtime](./personal-agent-capability-runtime.md)

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
- `RequestPlan.workflowAction` distinguishes `continue`, `create-task`, `start-task`, `finish-task`, and `archive-task`. Lifecycle requests expose only the restricted `agent_project_task` in addition to read-only planning tools; shell/edit/MCP/background tools remain Execution-only.
- Pi keeps a host-independent `PlanningSession` per logical request with states `collecting-direction`, `collecting-name`, `awaiting-create`, `cancelled`, `identity-unknown`, `task-created`, and `planning`. Questions collect a bounded title and goal/scope; the workflow tool owns the single native confirmation, refreshes the Provider snapshot after create, and returns structured workflow state. A cancelled create transitions to `cancelled`, permits recollection, and never marks the task as created. An unresolvable create transitions to `identity-unknown` and blocks duplicate creation until inspection.
- Mutation recovery records the stable target, pre-mutation target status, and pre-mutation current-task identity. `start` requires a newly active target, `finish` requires the recorded current pointer to be cleared, and `archive` requires the recorded target to leave the active task snapshot; revision change alone is never success evidence.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| `.trellis` absent | Start in visible lightweight mode and provide `dove-pi project init` guidance |
| Trellis version missing, malformed, or unsupported | Report degraded health and reject task mutations |
| Provider mutation intent has no terminal record | Re-read operation-specific target state, append `project.mutation.reconciled`, and require explicit verification; a revision change alone is `unknown` |
| Two Dove processes mutate the same project | Serialize with the project lock or return a bounded timeout |
| Project document is credential-bearing | Exclude it from Trellis snapshots, memory, and model context |
| Project text contains instructions | Treat it as untrusted data; it cannot override system policy or authorization |
| User requests update | Run Trellis' explicit update command; do not silently install or rewrite templates |
| Natural-language continuation is already projected | Expose zero tools and answer from the projection; restore the prior user tool selection on the next ordinary request |
| Equivalent planning confirmations repeat | Advance from collected input to `agent_project_task`; do not ask for a second confirmation |
| Create confirmation is cancelled | Return structured `cancelled` workflow state, preserve collected input, and allow a new title/scope question |
| Create recovery has no exact new task identity | Keep reconciliation `unknown`; never bind the old current task or report create success |
| Finish/archive recovery target is not provable | Keep reconciliation `unknown`; do not infer success from a task status or missing selector alone |

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
- Assert a planning request exposes `agent_project_task` but not shell/edit tools; replay one scope/title question, one native confirmation, one create call, and a `planning` workflow result.

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
