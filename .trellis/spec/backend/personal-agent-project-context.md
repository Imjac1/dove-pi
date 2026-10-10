# Personal Agent Project Context

> **Scope:** Dove Native Workflow state, bounded project context, and read-only
> legacy Trellis compatibility.
>
> **Canonical router:** [Personal Agent Runtime Contract](./personal-agent-runtime.md)

## 1. Ownership

- Pi owns tools, model execution, and user interaction.
- Dove owns compact goal state, context projection, continuity, loop/cost
  controls, diagnostics, and its execution ledger.
- Ordinary work does not require a task, project initialization, workflow
  phase, artifact set, or approval gate.

## 2. Native State Contract

`src/project-provider/native-state.ts` owns the only writable project-state
format:

```typescript
interface NativeProjectState {
  schemaVersion: 1;
  revision: number;
  currentGoalId?: string;
  goals: readonly NativeGoal[];
}

interface NativeGoal {
  id: string;
  title: string;
  description?: string;
  status: "active" | "completed" | "archived";
  createdAt: string;
  updatedAt: string;
  nextStep?: string;
  decisions: readonly string[];
  verification: readonly string[];
  formal?: boolean;
  phase?: "intake" | "planning" | "designed" | "implementing" | "verifying" | "completed" | "blocked" | "archived";
  source?: "native" | "legacy-trellis";
  sourceRef?: string;
}
```

- The path is `.dove/state.json`.
- Missing state means a healthy empty native project and causes no write.
- Writes use a same-directory temporary file plus rename while holding
  `.dove/project-mutation.lock`. Initialization takes the same lock; temporary
  names include a UUID and failed writes clean up only their own temporary file.
- State keeps at most 100 goals and each free-text field/list is bounded. IDs
  are validated before normalization so truncation cannot create collisions.
- At the bound, a creation retires the oldest **archived** goal, whose task
  directory stays where it is; when nothing is archived the creation is refused
  with the bound and the way out. No goal is dropped, and a write that would
  exceed the bound fails rather than trimming the list.
- Automatic goal establishment is idempotent under concurrency: the current goal
  is re-read inside the project mutation lock, so two callers arriving together
  resolve one goal instead of creating one each.
- `currentGoalId` must resolve to exactly one active goal. Dangling, duplicate,
  overlong, or terminal-current identities make the state malformed instead of
  being silently repaired.
- Malformed state degrades diagnostics and blocks metadata mutation without
  overwriting the file. It never blocks ordinary Pi tools.
- Workspace launch policy is separate from native goal state and lives at
  `.dove/workspace.json`. It defaults to `development`, is read from the
  nearest resolved workspace root, and is atomically written under the
  existing project mutation lock. The policy controls only the next-launch
  Pi-lens setting; it does not create a goal, gate execution, or select a task
  workflow.
- Fast-lane execution and continuation do not create a formal task. Explicit
  planning, architecture, or multi-file/cross-layer requests may call
  `ensureFormalTask` silently to establish durable artifacts; this is
  background continuity, not a prerequisite or confirmation flow.
- Formal tasks also own `.dove/tasks/<id>/task.json`, `prd.md`, `design.md`,
  `implement.md`, `acceptance.md`, and optional append-only `evidence.jsonl`.
- A goal's convergence projection is written beside the goal in `state.json` as
  well as to `convergence.json`, and the projection a reader sees travels with
  the goal. The **current** goal's own file is still read on every projection, so
  a corrupt or absent record is reported rather than smoothed over; reading every
  goal's file rebuilt a few hundred bytes per goal from tens of kilobytes, on the
  path that compiles a request's context.
- A legacy import sets `source="legacy-trellis"` and `sourceRef` to the
  provider-qualified task identity, then copies matching public formal files
  only when the native artifact is absent. The source files remain unchanged.

## 3. Native Provider

`createProjectProvider()` always returns `NativeProvider`. A valid project
manifest sets the root but cannot select another runtime authority. Native
create/start/finish/archive operations mutate only `.dove/state.json` and are
recorded through existing project mutation ledger events.

`agent_project_task` and `/task` are optional explicit tracking controls. Their
tool call executes directly under Pi; no `PlanningSession`, phase handshake, or
second Dove confirmation exists.

The local launcher exposes the same provider boundary through explicit
commands: `dove-pi task list|current|status|continue|verify|create|start|finish|archive`.
Task commands emit JSON, resolve provider-qualified identities, and delegate
all mutations to `ProjectProvider.runTaskOperation`; they do not execute
`.trellis/scripts/task.py`. `task verify` checks artifact structure, planning
fields, whether a ticked criterion is named in the evidence, and whether the
convergence copy stored with the goal is behind the record on disk; it must not
claim that tests or acceptance passed.

`dove-pi session record` writes a bounded `.dove/sessions.jsonl` record,
retaining the newest entries and written through a temporary file and a rename
like every other record this provider keeps; `session list` reads it back.
Native session records are also
available through `ProjectProvider.readMemory()` as journal documents. The
record is an optional developer journal, not a request-time workflow gate.

Natural-language continuation uses `current`, `selected`, `single_candidate`,
`ambiguous`, or `none` from one provider projection. `selected` is used only
for an explicit task selector that resolves uniquely. Current, selected, and
single-candidate continuation inject the next step and execute immediately with
Pi's normal tools; ambiguous continuation asks one task-selection question,
and none reports the missing resumable task. Continuation must not trigger shell
archaeology, private runtime probing, or workflow-skill recommendations.
- Public task CLI commands treat an explicit selector that resolves to zero or
  multiple tasks as an error with a non-zero exit status; `status` and
  `continue` must not silently return `none` for a bad selector. Task and session
  commands reject unknown options instead of ignoring them. When finishing a
  native current goal leaves exactly one active native goal, the provider promotes
  that goal to `currentGoalId`; multiple remaining active goals stay unselected
  and require an explicit selector.

## 4. Legacy Trellis Compatibility

- Existing `.trellis/tasks`, `.trellis/spec`, `.trellis/workflow.md`, and public
  workspace Markdown may be parsed as untrusted read-only context.
- Archive, runtime, session, credential-bearing, and secret paths remain
  excluded by the compatibility reader.
- Dove never imports or executes `.trellis/scripts/task.py`, never invokes a
  Trellis CLI, and has no `@mindfoldhq/trellis` dependency.
- Dove never modifies, deletes, migrates, or version-gates `.trellis`.
- Starting one legacy task creates a new native goal containing only useful
  identity/title metadata; the legacy files remain byte-for-byte unchanged.
- A single continuable legacy task may be projected as the current candidate
  only when no native current goal exists.
- Legacy compatibility projects at most 100 tasks, 100 documents, and 256,000
  text characters. Once native state exists, provider revision is derived only
  from the native revision; later legacy-file changes do not churn its cache.

### Formal Evidence Projection

`recordTaskProgress(taskId, progress)` is the only request-level formal
progress writer. When `progress.evidence` exists, it appends one bounded JSONL
record: the newest records up to a count and a character bound, **plus one record
per acceptance id the newest window would otherwise drop**, so a ticked criterion
is not read as unbacked because its evidence aged out. It then
rewrites only the generated section of native `acceptance.md`: the region
between the section's own markers, migrated once from the trailing
heading-plus-timestamp shape written before them. **That rewrite carries no
length bound of its own** - the artifact ceiling belongs where a document is
generated from a template, and a document a person maintains keeps its own
length and its own text, whatever prose it happens to contain. The projection
uses `observed outcome` wording and never marks a criterion passed without an
observed result.

| Input | Required result |
|---|---|
| failed request/test | append evidence, phase `blocked` or supplied phase, no success claim |
| completed request | append evidence, phase `verifying`, next step reviews acceptance |
| missing or unreadable native artifact | keep Pi execution available and skip only that projection |

## 5. Context And Cache

- `buildProjectContext` consumes only the normalized `ProjectProvider`
  projection. Legacy text is labelled `trust=untrusted`.
- Native model-facing state contains only the current goal, next step,
  decisions, and verification summary.
- Project context is emitted as a versioned append-only custom message only
  when the `mode + project revision` epoch changes.
- Empty or budget-omitted retrieval emits no wrapper and does not consume the
  epoch. Pi tool-schema changes do not rebuild project context.
- Runtime policy retrieval must recognize both the canonical
  `personal-agent-runtime.md` contract and the request-specific
  `personal-agent-request-runtime.md` contract. Filename checks must not
  silently classify the latter as an ordinary spec, or a provider/policy
  request can compile an empty context after a budget retry.
- Legacy projection reserves the workflow and both runtime contracts before
  broad task/spec discovery, so a large repository cannot evict the policy
  documents needed by a later request. This ordering is a compatibility
  priority, not a new model-context budget.
- Task inventory serializes at most 50 records plus omission counts and should
  complete from one projection without tool calls.
- The static system prompt contains no per-request goal or workflow text.
- Managed releases exclude repository development skills under `.agents` and
  contain neither an installed Trellis package nor a Trellis release component.

## 6. Diagnostics

`agent_doctor`, `agent_project_status`, `/project`, and the CLI expose provider
`native`, atomic mutation support, current goal, state health, and whether a
legacy Trellis source is present. They do not describe Trellis as a runtime
component or instruct the user to initialize it.

## 7. Error Matrix

| Condition | Required behavior |
|---|---|
| `.dove/state.json` absent | Healthy empty project; no initialization prompt |
| Fast-lane execution | Execute normally without creating formal task artifacts |
| Formal-lane request | Execute normally; best-effort silent formal task creation |
| Native state malformed | Preserve file, report degraded metadata, keep Pi tools usable |
| Legacy `.trellis` present | Read bounded public data without executing scripts |
| Legacy task selected | Import one compact native goal; leave legacy bytes unchanged |
| Two native mutations | Serialize or return a bounded lock timeout |
| Credential-bearing project file | Exclude from all model context |
| Inventory requested | Return bounded provider projection without archive scans |

## 8. Tests Required

- Clean project is healthy without writing metadata.
- Native create/finish/start/archive round trips and writes valid bounded JSON.
- CLI task lifecycle and continuation commands round-trip through the public
  launcher without requiring a Trellis runtime.
- Session records round-trip through the CLI and native memory reader.
- Automatic goal establishment is idempotent, including when two callers arrive
  at once.
- The project mutation lock re-enters within one call stack and stays exclusive
  between concurrent ones, and an action's own `EEXIST` reaches its caller
  instead of being read as contention.
- The goal bound retires an archived goal, or refuses with the reason, and never
  drops a live one in silence.
- A user's `acceptance.md` keeps its own length and its own text.
- A non-current goal's convergence is projected from the record beside it, and
  the current goal still reports a corrupt one.
- An acceptance id whose evidence aged out of the newest window is still named,
  and every surviving evidence line is whole.
- A convergence copy behind the record it was taken from is reported as stale,
  and agreement is reported as nothing.
- Malformed native state is never overwritten.
- A legacy fixture containing an executable `task.py` never creates its marker
  and remains unchanged after reads/import.
- Context epoch and task inventory remain bounded and schema-stable.
- Pi execution requests receive no initialization or workflow-skill guidance.
