# Technical Design: Task Convergence Control

## Change Boundary

The smallest behavior gap is a missing task-level decision owner. Request
retry, provider-round, and repeated-tool guards already exist, but no component
can answer whether formal work improved a frozen acceptance contract, is ready
to finish, must checkpoint, or discovered work that belongs elsewhere.

The behavior lives in two execution planes:

1. Project-local Trellis controls Codex implementation/check/continue behavior.
2. Dove Core and the Pi adapter control the shipped personal-agent runtime.

Both planes use one documented event/state contract and shared replay fixtures.
They keep separate persistence because Dove's runtime must not depend on or
write Trellis state.

Expected implementation surfaces:

- `src/core/task-convergence.ts`: typed events, pure reducer, invariants, and
  semantic decisions.
- `src/project-provider/contracts.ts`, `native-state.ts`,
  `native-artifacts.ts`, and `native-provider.ts`: versioned native persistence,
  task projection, checkpoint recovery, and backward compatibility.
- `src/pi-adapter/extension.ts`: formal-lane lifecycle integration, structured
  progress recording, mutation attribution, finish/checkpoint guidance, and
  observation-only resource samples.
- `src/core/execution-ledger.ts` and diagnostics: additive correlated decision
  and resource records.
- `.trellis/workflow.md`, `.agents/skills/trellis-check/SKILL.md`,
  `.agents/skills/trellis-continue/SKILL.md`, and the active Codex/Pi/check
  agent definitions: the same finding and terminal rules for development work.
- Focused unit, provider, Pi adapter, CLI, workflow, and shared trace replay
  tests.

Explicitly untouched: provider transport ceilings, platform billing/account
limits, authorization policy, tool profiles, installer product behavior, and
the existing installer task.

## Shared Semantic Model

```typescript
type AcceptanceStatus =
  | "pending"
  | "in_progress"
  | "passed"
  | "failed"
  | "waived";

type FindingKind =
  | "blocking"
  | "regression"
  | "follow_up"
  | "scope_change"
  | "serious_unexpected_risk";

type TaskRunState =
  | "working"
  | "verifying"
  | "ready_to_finish"
  | "checkpointed"
  | "blocked";

interface AcceptanceCriterionState {
  id: string;
  text: string;
  status: AcceptanceStatus;
  evidenceRefs: readonly string[];
}

interface TaskFinding {
  id: string;
  kind: FindingKind;
  discoveredFromAcceptanceId: string;
  summary: string;
  open: boolean;
  evidenceRefs: readonly string[];
}

interface TaskResourceObservation {
  toolCalls: number;
  providerRounds: number;
  elapsedMs: number;
  inputTokens?: number;
  cacheReadTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
}

interface TaskCheckpoint {
  acceptanceRevision: string;
  acceptanceVector: Readonly<Record<string, AcceptanceStatus>>;
  openFindingIds: readonly string[];
  nextAcceptanceId: string;
  nextAction: string;
  unblockCondition?: string;
}

interface TaskConvergenceSnapshot {
  schemaVersion: 1;
  taskId: string;
  revision: number;
  acceptanceRevision: string;
  state: TaskRunState;
  criteria: readonly AcceptanceCriterionState[];
  findings: readonly TaskFinding[];
  consecutiveNoProgress: number;
  checkpoint?: TaskCheckpoint;
  observedResources: TaskResourceObservation;
}
```

The actual implementation should use bounded fields and exported decoders. Raw
JSON is decoded once by the state owner; consumers use typed projections.

## Event And Reducer Contract

The reducer accepts versioned events such as:

- `acceptance.frozen`
- `acceptance.started`
- `acceptance.evidence_attached`
- `acceptance.passed`
- `acceptance.failed`
- `planned_step.completed`
- `finding.recorded`
- `finding.resolved`
- `request.observed`
- `task.checkpointed`
- `task.blocked`
- `task.resumed`

Every event that changes product-work state carries `acceptanceId` and rejects
an ID outside the frozen set. `finding.recorded` also carries the discovering
criterion. `request.observed` may update resource counters but is forbidden from
changing acceptance status, no-progress count, or run state.

An event is meaningful progress only when it satisfies the PRD definition. The
reducer compares the acceptance vector and open failure/blocker set before and
after the event; arbitrary tool activity and new follow-up findings do not count.

Decision order is deterministic:

1. Invalid state or unknown acceptance ID: reject the metadata mutation.
2. Serious unexpected risk or scope change: `checkpointed`.
3. External dependency/user input with a concrete condition: `blocked`.
4. Open blocking/regression finding or failed criterion: continue against its
   existing acceptance ID.
5. All non-waived criteria passed: `ready_to_finish`.
6. Meaningful progress occurred: reset semantic no-progress and continue.
7. First consecutive no-progress request: continue with corrective guidance.
8. Second consecutive no-progress request: persist a checkpoint and settle.

The value `2` is a semantic transition threshold, not a tool/time/token budget.
It advances only on completed formal-task decisions with no defined progress.

## Persistence

### Dove native plane

Add an optional compact convergence summary to `NativeGoal` and a versioned
`.dove/tasks/<goal-id>/convergence.json` snapshot. Write it atomically under the
existing project mutation lock. Add decision/evidence records to the existing
bounded `evidence.jsonl`; do not place raw tool output in native state.

Existing schema-1 state without convergence fields normalizes unchanged. A
formal task lazily creates convergence state only after stable acceptance IDs
are available. Malformed convergence state is preserved and blocks only task
metadata mutation, not Pi tools.

### Trellis/Codex plane

Add a project-local `.trellis/tasks/<task>/convergence.json` snapshot managed by
a narrow `task.py convergence ...` command or helper. Agent instructions call
the command to begin a criterion, record structured evidence/findings, decide,
checkpoint, and resume. They do not hand-edit the snapshot.

The Trellis helper and Dove reducer consume the same JSON trace fixtures and
must agree on semantic output. The local helper is development workflow state;
Dove never imports or executes it.

## Acceptance Freeze

Formal PRDs use a strict line grammar for stable IDs, for example:

```markdown
- [ ] **AC-003 Mutation attribution:** observable expected outcome.
```

At start, the owner parses only this explicit grammar, validates uniqueness and
bounds, normalizes line endings/whitespace, and hashes the ordered ID/text set.
The snapshot, not later Markdown edits, becomes the execution source of truth.

A deliberate re-plan creates a new acceptance revision and records a
`scope_change` decision. It never merges new Markdown checkboxes into a running
task implicitly.

## Formal Mutation Attribution

The Pi plane exposes a structured formal-progress operation that can select an
existing acceptance ID and record evidence/findings. It is task metadata, not a
new permission decision. Before a known product-mutating tool executes in a
formal lane, the controller requires an active acceptance ID. Unknown IDs are
rejected; fast-lane requests bypass the controller entirely.

Trellis implement/check instructions require the same selection before edits
and checks. The workflow's review step validates the current acceptance ID and
state before dispatch. No user-visible confirmation is added.

## Finish And Checkpoint Integration

`ready_to_finish` is terminal for product edits in the current acceptance
revision. The only allowed next actions are final verification projection,
spec-learning review, commit planning, and archive/wrap-up.

`checkpointed` stores one next action, not an unconstrained backlog. `resume`
verifies the acceptance revision, restores the checkpoint, and dispatches work
for `nextAcceptanceId`. If the PRD changed, resume reports `scope_change` and
returns to planning.

`blocked` additionally requires `unblockCondition`; without a concrete external
condition the correct state is `checkpointed`.

## Resource Observation

Reuse existing ledger correlations and provider usage records. Aggregate, per
formal task and acceptance ID:

- tool-call count;
- provider-round count;
- elapsed wall time;
- input, cache-read, output, and reasoning tokens when reported.

The decision reducer receives resource observations through a separate event
branch whose tests assert that it cannot change the semantic result. There are
no thresholds or warning copy in this task.

## Failure Behavior

| Condition | Required behavior |
| --- | --- |
| No stable acceptance IDs at formal start | Stay in planning; report the structural defect |
| Duplicate or unknown acceptance ID | Reject convergence metadata mutation before product mutation |
| PRD acceptance hash differs after freeze | Record `scope_change`; checkpoint |
| Follow-up found during check | Persist follow-up; keep it out of current remaining work |
| Serious unexpected risk | Persist evidence; checkpoint and report |
| All accepted criteria pass | `ready_to_finish`; no new implement/check mutation cycle |
| First semantic no-progress completion | Inject one corrective next action tied to an AC |
| Second semantic no-progress completion | Checkpoint and settle the run |
| Resume with same acceptance revision | Restore exact checkpoint and next AC |
| Resume after scope drift | Do not resume implementation; return to planning |
| Resource usage absent | Record unknown values; semantic decision unchanged |
| Convergence file malformed | Preserve bytes; block only convergence metadata mutation |

## Compatibility And Security

- Bound IDs, descriptions, findings, evidence references, and retained events.
- Store digests and artifact references rather than raw commands, prompts, or
  secrets in compact state.
- Keep additive ledger event kinds backward compatible.
- Do not change Pi authorization behavior or use convergence as a tool allow-list.
- Keep task/project/provider/request/tool/execution identifiers distinct and
  correlated.
