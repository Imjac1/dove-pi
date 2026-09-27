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
`.trellis/scripts/task.py`. `task verify` is a structural artifact check only
and must not claim that tests or acceptance passed.

`dove-pi session record` writes a bounded append-only `.dove/sessions.jsonl`
record and `session list` reads it back. Native session records are also
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
- Automatic goal establishment is idempotent.
- Malformed native state is never overwritten.
- A legacy fixture containing an executable `task.py` never creates its marker
  and remains unchanged after reads/import.
- Context epoch and task inventory remain bounded and schema-stable.
- Pi execution requests receive no initialization or workflow-skill guidance.

### Formal Task Convergence State

### 1. Scope / Trigger

Trigger: a formal native task needs a frozen acceptance contract, bounded
checkpoint recovery, and host-independent finish semantics. Fast-lane requests
remain outside this state machine.

### 2. Signatures

```text
python ./.trellis/scripts/task.py convergence replay [--fixture PATH] [--trace NAME]
python ./.trellis/scripts/task.py convergence status --snapshot PATH
python ./.trellis/scripts/task.py convergence apply --snapshot PATH --event JSON
```

The Dove equivalent is `dove-pi task convergence <operation>` and persists
under `.dove/tasks/<goal-id>/convergence.json`.

### 3. Contracts

- `acceptance.frozen` establishes the ordered `AC-*` set and SHA-256 revision.
- Every product-work event carries an existing `acceptanceId`; unknown IDs are
  rejected before metadata or product mutation.
- `follow_up` findings are retained but do not block current acceptance work.
- `scope_change` and `serious_unexpected_risk` create one AC-bound checkpoint.
- `ready_to_finish` is terminal for product mutation in the frozen revision.
- **`request.observed` records what a request cost, and decides nothing.** The host writes one at the
  **end of a request** (the `agent_end` block, after the `request.terminal` record), from the counters it already
  keeps, and the **same object** goes to the ledger (`appendTaskResourceObservation`) and to the record - so the two
  cannot disagree about a round. It adds `observedResources` and a revision and touches no criterion, finding,
  completed step, state or checkpoint.
- **That block is the only writer of the kind, and the site is the design.** A producer on
  `appendRequestTerminal` would fire once per terminal *transition*, and one `settle()` can terminalize several
  leases - so it would record the active request's cost more than once and would need a guard against attributing
  that cost to a superseded request. The `agent_end` block has exactly one current request, so it needs no guard.
  **A second writer was added here once**, on the belief that this call did not exist, and a real ledger showed both
  records for one request; that is why this contract now names the writer rather than describing the data.
- **A request with no task is not observed at all.** The writer's guard is a current request plan and a task id, so a
  fast-lane request produces nothing - a **known gap**, recorded rather than implied, because covering it is a
  decision with its own evidence and not a detail of which site writes.
- **When the record cannot take the observation, the skip is named rather than silent.** The event
  needs an existing `acceptanceId` and the record refuses events after `ready_to_finish` or while
  checkpointed or blocked, so the observation attaches to the criterion that is `in_progress` and
  is skipped - with a typed `convergenceSkipReason` on the ledger record - when there is no active
  criterion, the state will not take it, or there is no formal native task. "Never observed" and
  "observed and discarded" must not look the same.
- **A change manifest predicts movements, and the next read decides them.** `change.recorded`
  carries the failure evidence, the inferred root cause (distinct from the verifier-level cause),
  the fix, and a **closed-set** prediction: `criterion-status:<AC>=<status>`,
  `verification-state:<AC>=<state>`, or `gate-refusals:<label>=down|up`, where `<label>` is one of
  `deny`, `scope`, `registered`, `limit`, `conformance`, `sandbox`, `technique`, `fence`,
  `ask`, `effect-claim`. At least one predicted fix is required; an empty regression set is a
  declared claim of none rather than a blank field.
- **The baseline is the harness's read, taken when the manifest is recorded** and stored with it.
  A caller-supplied baseline is refused at the tool boundary: one party must not write both sides
  of the contract a verdict is computed from.
- **The verdict is computed in the status read and never written back.** `pending` until any event
  has landed after the manifest's revision, then `confirmed` / `contradicted` / `unobserved`.
  `unobserved` answers for an observable that cannot be read and can never be `confirmed`; a
  predicted movement that was already true at the baseline is `contradicted`, because it is not
  evidence for the change.
- **Two limits, stated rather than left to be discovered.** One task's run is not a benchmark, so
  an observed delta here is weak evidence; and the regression predictions are a **record, not a
  control** - AHE measured P 11.6% / R 11.1% over 9 rounds, so regression detection stays with the
  held-out criteria, the gates, and the fence.
- **The declared editable surface** (`.trellis/harness-surface.yaml`, `src/core/harness-surface.ts`) is the
  file-level representation of the harness's own components: AHE's requirement that "every editable harness
  component [has] a file-level representation so the action space is explicit and **revertible**". The seven
  components are the ones `CHANGE_SURFACES` names, and the declaration binds each to workspace-relative paths.
  It is recorded here because it is the bounded context a proposal is made from and because the evidence-plane
  specification in `personal-agent-framework-core.md` is near its cap.
  - **Every entry must resolve**, refused as `component:path` when it matches nothing: a map whose entries are not
    real names an action space that is not there.
  - **It is not a partition.** One path may belong to two components (`extension.ts` is a tool description *and*
    middleware); forcing a partition would make the map lie about one of them.
  - **One vocabulary**: the parser refuses a component outside `CHANGE_SURFACES`, and a test asserts they agree in
    **both** directions.
  - **It belongs to the harness, not to the workspace a run happens to be in**, so it is resolved from the
    extension's own root and its entries resolve against the same root. Reading it from the current workspace was
    the first implementation, and a host test in another project refused it: every entry looked missing for a map
    that was there all along. A project-level map is a different declaration, not built.
  - **A missing or broken map is reported, not fatal**: the status read returns `surfaceIssue` with the reason and
    the rest of the read is unaffected.
  - **`revertible` is a convention here, stated rather than assumed**: one logical harness edit is one commit,
    which is what gives an edit a revert and what a change manifest's `fix` describes.
- **The failure reading (`src/core/failure-reading.ts`) is the mining half of the loop: a pure function of the
  ledger that turns an unsuccessful request into a bounded record.** It reads; it clusters nothing, ranks nothing and
  proposes nothing.
  - **The class and the mechanism are separate fields.** `reason` is one of the nine terminal reasons (usually
    `failed`) and `terminal.code` is what actually went wrong - `provider-attempt-limit`,
    `retry-refused-after-effect`, `model-budget-rejected`. Two requests that share the class and differ in the
    mechanism must not read the same, which is the distinction Self-Harness says is usually missing.
  - **Which terminals count as failures is the SSM axis's rule** (`classifyTerminal`), not a second one, so the
    reading and the axis cannot disagree.
  - **A refusal is attributed to a request by id, never by ledger position.** The four `appendGateRefused` sites
    pass the live `requestId`, and a refusal that carries none is **counted in `unrefused` rather than guessed
    at**: `issueRequestHostAbort` can settle a previous request after the next one has been received, so position
    would attribute a refusal to the wrong request.
  - **A convergence refusal is a terminal, not a gate refusal.** That path aborts the request instead of refusing one
    tool call, so the ledger holds a `request.terminal` with `origin: convergence` and no `gate.refused` record -
    which is why the reading attributes from the terminal's origin as well as from refusals.
  - **The component attribution is stated, with its evidence, or it is `unattributed`.** A refusal points at
    `middleware` (the policy that refuses); a provider outcome points at nothing of ours. An invented attribution
    would point an edit at the wrong file, which is worse than saying the records do not determine one.
  - **An empty corpus is a finding.** The reading reports how many requests it examined and what the corpus does not
    contain, so "nothing failed" cannot be read as "the reader is broken".
  - **A failing tool leaves no record at all**, because `appendToolObserved` is called only when the tool did not
    error - the same write is what offers the observable marker a passing criterion may cite. A failure record
    therefore cannot name the tool that failed. **Recorded as a decision, not an oversight**: recording an errored
    tool would also make its id citable by a pass, which is a change to the citation rule rather than to telemetry.
  - **The reading prints and never asserts** (`scripts/harness-failures.mts`, exit 0 always), like the axis.
- Trellis calls the shared TypeScript reducer through its narrow helper; Dove
  never imports or executes Trellis scripts.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Duplicate or unknown `AC-*` | Reject the convergence event before mutation |
| Malformed snapshot | Preserve bytes and block only convergence metadata writes |
| Acceptance revision drift | Record `scope_change` and checkpoint |
| Two semantic no-progress reviews | Checkpoint with one criterion-bound next action |
| All criteria pass with no open blocker | Enter `ready_to_finish`; reject further product mutation |
| Missing resource usage | Keep the field unknown; never infer a stop |
| A surface entry that resolves to nothing | Refused, naming the entry as `component:path` |
| A component outside `CHANGE_SURFACES`, or one with no paths | Refused, naming the components there are |
| A missing or unreadable surface declaration | `surfaceIssue` on the status read; the read itself is unaffected |
| A refusal recorded with a live request | Carries `correlation.requestId` for the request it refused |
| A refusal with no request id | Counted as unrefused by the failure reading; never attributed by position |
| A terminal whose mechanism is unfamiliar | Emitted with the mechanism carried through; never dropped |
| A request whose converged state will not take an event | The ledger names the state; the convergence record is untouched |
| A request terminal with no active criterion, or in a state that refuses events | Record the ledger observation with a `convergenceSkipReason`; offer nothing to the record |
| A superseded request settling after the active one | Record no observation for it; its `request.terminal` record stands alone |
| A change manifest with no predicted fix | Refused: a change with nothing predicted is a rationale, not a contract |
| A prediction outside the closed set | Refused, naming the observables and the gate labels |
| A caller-supplied `baseline` | Refused at the tool boundary: the baseline is the harness's read |
| A manifest field on `operation=status` | Refused, and the refusal names the operation that records one |

### 5. Good/Base/Bad Cases

- Good: replaying `tests/fixtures/task-convergence-traces.json` through both
  hosts yields the same state, findings, checkpoint, and terminal decision.
- Base: a long run emits large resource observations while semantic state is
  unchanged and remains eligible to continue.
- Bad: treat a follow-up as current remaining work, regenerate an open-ended
  backlog after resume, or use tool/time/token totals as a hard stop.

### 6. Tests Required

- Replay every shared trace incrementally and from its complete event list.
- Assert `task.py convergence apply/status` round-trips an atomic snapshot.
- The surface declaration resolves every entry against the real tree, agrees with `CHANGE_SURFACES` in both
  directions, and lets one path belong to two components; the status read reports it.
- The failure reading keeps the mechanism beside the class, counts only the terminals the axis calls failures,
  attributes refusals by id, reports an empty corpus as a finding, and returns `unattributed` where the records
  do not determine a component.
- Assert fast-lane requests create no convergence file or mutation guard.
- Assert `ready_to_finish`, checkpoint, scope drift, and malformed-state paths
  fail closed at the Pi tool boundary.
- From a request terminal, assert the ledger observation and the snapshot's `observedResources`
  describe the **same** request (the record equals the snapshot delta), that the revision advanced
  by exactly one, and that a settle of two leases records one observation rather than two.
- Record a manifest and read the same revision (`pending`), then read after one event
  (`contradicted`, carrying the movement it compared); assert the stored baseline is the one the
  runtime read, and that a caller-supplied baseline is refused.

### 7. Wrong vs Correct

#### Wrong

```text
Check failed -> fix -> re-check until green, including newly discovered scope.
```

#### Correct

```text
Classify the finding against an existing AC; checkpoint scope/risk, and stop
product mutation once the reducer reports ready_to_finish.
```
