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
- `currentGoalId` must resolve to exactly one active goal. Dangling, duplicate,
  overlong, or terminal-current identities make the state malformed instead of
  being silently repaired.
- Malformed state degrades diagnostics and blocks metadata mutation without
  overwriting the file. It never blocks ordinary Pi tools.
- Fast-lane execution does not create a formal task. Explicit planning,
  architecture, multi-file/cross-layer, or continuation requests may call
  `ensureFormalTask` silently to establish durable artifacts; this is
  background continuity, not a prerequisite or confirmation flow.
- Formal tasks also own `.dove/tasks/<id>/task.json`, `prd.md`, `design.md`,
  `implement.md`, `acceptance.md`, and optional append-only `evidence.jsonl`.
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

Natural-language continuation uses `current`, `single_candidate`, `ambiguous`,
or `none` from one provider projection. It must not trigger shell archaeology,
private runtime probing, or workflow-skill recommendations.

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
record, retaining at most the newest 100 records and 32,000 characters, then
rewrites only the generated `## Dove Evidence Projection` section of native
`acceptance.md`; user-authored criteria remain intact. The projection uses
`observed outcome` wording and never marks a criterion passed without an
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
- Automatic goal establishment is idempotent.
- Malformed native state is never overwritten.
- A legacy fixture containing an executable `task.py` never creates its marker
  and remains unchanged after reads/import.
- Context epoch and task inventory remain bounded and schema-stable.
- Pi execution requests receive no initialization or workflow-skill guidance.
