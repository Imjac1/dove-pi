# Implementation Plan: Task Convergence Control

## Slice 0: Freeze The Contract

- [x] Review `AC-001` through `AC-010` and freeze their ordered ID/text revision.
- [x] Add shared JSON trace fixtures for baseline completion, follow-up finding,
  scope change, serious risk, semantic no-progress, interruption/resume, and the
  September 3 installer expansion scenario.
- [x] Define expected state after every event before implementing reducers.

Checkpoint: trace fixtures are reviewable and contain no resource-based stop.

Evidence: `tests/fixtures/task-convergence-traces.json` freezes revision
`179b574aa9780a365b7c66f9aae725f76d98579abac1915072dd0b5a99d490fe`,
declares an expected projection after every event, and labels resource policy
as observation-only.

## Slice 1: Host-Independent Semantic Reducer

- [x] Implement bounded convergence types, decoders, invariants, and pure reducer
  in `src/core/task-convergence.ts`.
- [x] Implement meaningful-progress comparison and deterministic decision order.
- [x] Prove `request.observed` resource events cannot affect semantic state.
- [x] Add table-driven unit and replay tests for `AC-002`, `AC-004`, `AC-005`,
  `AC-006`, and the Dove side of `AC-007`/`AC-008`.

Checkpoint: the TypeScript reducer passes shared traces without provider, Pi,
filesystem, or Trellis dependencies.

Evidence: `tests/task-convergence.test.ts` passes all 13 focused reducer and
trace assertions, including high resource observations that leave semantic
state unchanged; `npm run typecheck` passes. No provider, Pi adapter, Trellis
runtime, installer, or resource-limit behavior was changed in these slices.

## Slice 2: Dove Native Persistence And Commands

- [x] Extend native contracts with optional convergence projection while keeping
  existing schema-1 fixtures readable.
- [x] Add atomic, locked `convergence.json` read/write and bounded event evidence.
- [x] Add provider operations for freeze, progress, finding, decide, checkpoint,
  and resume; centralize unknown-ID validation at this boundary.
- [x] Extend task status/verify diagnostics to report structural readiness and
  convergence separately without claiming tests passed.
- [x] Add provider and CLI tests for `AC-002`, `AC-006`, and `AC-009`.

Checkpoint: native state round-trips, malformed state is preserved, and legacy
Trellis remains read-only.

Evidence: native provider tests cover the full typed mutation lifecycle,
serialized concurrent evidence updates, refreeze scope drift, exact checkpoint
resume, legacy state without convergence fields, and malformed snapshot byte
preservation. CLI tests separately report structural readiness and convergence
state. Focused results: provider 23/23, core 14/14, CLI 3/3; `npm run
typecheck` passes.

## Slice 3: Pi Formal-Lane Integration

- [x] Add structured formal-progress calls that select an acceptance ID and
  record evidence/findings without adding a permission or confirmation layer.
- [x] Require a valid active acceptance ID before known product mutations in a
  formal lane; leave fast-lane work untouched.
- [x] Replace generic `Review remaining criteria` progression with reducer-owned
  next action, ready-to-finish, checkpoint, or blocked guidance.
- [x] Correlate convergence decisions and observation-only resource metrics in
  the execution ledger.
- [x] Add Pi lifecycle tests for `AC-001`, `AC-003`, `AC-005`, `AC-006`,
  `AC-008`, and `AC-009`.

Checkpoint: the installer replay stops at follow-up/checkpoint or
ready-to-finish instead of starting a new audit/fix cycle.

Evidence: Pi registers `agent_task_convergence` for typed freeze/progress,
finding, decision, checkpoint, and resume operations. Formal-lane product
mutations require valid convergence metadata with an active acceptance and are
blocked after `ready_to_finish`, `checkpointed`, or `blocked`; fast-lane
requests are unchanged. Agent settlement records reducer-owned convergence
decisions, while request-level tool/provider/time/token metrics are written as
`observationOnly` ledger events and never mutate semantic state. Focused
verification passes: Pi adapter 25/25, request lifecycle 3/3, core 19/19, and
`npm run typecheck`.

## Slice 4: Trellis/Codex Enforcement

- [x] Add the project-local Trellis convergence snapshot/helper and replay it
  against the shared fixtures.
- [x] Update `.trellis/workflow.md` so Phase 2 routes by convergence state and
  does not say unqualified `until green`.
- [x] Update `trellis-check` to classify every finding and to stop on follow-up,
  scope change, or serious risk according to the contract.
- [x] Update `trellis-continue` to resume from the checkpoint and frozen
  acceptance revision instead of inferring an open-ended remaining-work list.
- [x] Synchronize active Codex/Pi and channel implement/check agent definitions
  that duplicate these responsibilities.
- [x] Add workflow/helper tests for the Trellis side of `AC-003` through
  `AC-007` and verify local managed-file customization boundaries.

Checkpoint: Codex/Trellis and Dove/Pi produce equivalent semantic decisions for
all shared traces.

Evidence: `scripts/trellis-convergence.mts` is the single Trellis-side bridge
to the host-independent reducer. `task.py convergence apply/status` persists
an atomic project-local snapshot, while `task.py convergence replay` checks
every expected projection in `tests/fixtures/task-convergence-traces.json`,
including the September 3 installer expansion trace. Workflow and agent
instructions route findings and terminal states through the same contract.

## Slice 5: Full Verification And Rollout

- [x] Run focused convergence, native provider, CLI, Pi adapter, and Trellis
  helper/workflow tests.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run test:installer`.
- [x] Run `npm run doctor`.
- [x] Run `npm run pi:smoke`.
- [x] Replay the recorded installer scenario and inspect the final checkpoint,
  finding classifications, resource observations, and next action.
- [x] Update the backend runtime/project-context/quality specs with the verified
  contract and record any local Trellis customization notes.

Final gate: all `AC-*` criteria have observed evidence, no blocking/regression
finding is open, and the controller reports `ready_to_finish`.

Evidence: focused convergence replay and reducer tests pass (14/14), native
provider tests pass (23/23), Pi adapter tests pass (25/25), CLI/helper tests
pass (5/5), and the complete Node suite passes (272/272). `npm run typecheck`,
`npm run test:installer` (105/105), `npm run doctor`, `npm run pi:smoke`,
`task.py validate`, `task.py convergence replay`, and `git diff --check` all
pass. No resource threshold or host-limit behavior was added; resource data is
persisted only as observation-only telemetry for formal native tasks.

## Explicitly Deferred Follow-Up

Create a separate task only after enough real-run observations exist to choose
high configurable defaults for total tool calls, elapsed time, and token usage.
That task must analyze distributions by lane/mode, define warning versus hard
stop semantics, and prove normal long-running work is not interrupted.
