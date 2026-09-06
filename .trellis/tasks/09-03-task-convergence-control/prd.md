# Task Convergence Control

## Goal

Make formal agent tasks converge on a frozen, observable definition of done.
An implementation/check cycle must finish when the accepted work is verified,
checkpoint when it cannot make semantic progress, and preserve unrelated
findings as follow-ups instead of silently expanding the current task.

## Problem Evidence

- The September 3 installer run lasted about four hours in one turn. Most tool
  calls succeeded, but the work repeatedly widened from implementation into
  additional audit and repair work.
- Trellis currently says `fix -> re-check, until green`, while its check skill
  separately says out-of-scope fixes must stop. There is no structured state
  that decides which instruction wins or records that the task is already done.
- Dove's `ProgressGuard` detects repeated calls, unchanged observations,
  repeated failures, and request-local provider-round exhaustion. It cannot
  detect a task that keeps producing different actions without improving the
  task's acceptance state.
- Dove native goals persist phase, next step, decisions, and verification, but
  do not persist a frozen acceptance set, classified findings, a checkpoint,
  or a task-run convergence decision.

## Definitions

- **Acceptance criterion**: a stable `AC-*` identifier with an observable
  expected outcome. The accepted set is frozen when implementation starts.
- **Meaningful progress**: exactly one of the following:
  - an acceptance criterion moves to a better state;
  - evidence is attached to an existing acceptance criterion;
  - a planned step serving an existing acceptance criterion completes;
  - the current failure set shrinks;
  - a current acceptance blocker is removed.
- **Finding**: a structured observation classified as `blocking`,
  `regression`, `follow_up`, `scope_change`, or
  `serious_unexpected_risk`.
- **Checkpoint**: a resumable snapshot containing the frozen acceptance
  revision, last stable criterion states, blockers, evidence references, and
  exactly one next action tied to an acceptance criterion.

## Requirements

### R1. Frozen acceptance contract

- Formal tasks must use stable acceptance IDs before implementation begins.
- The accepted ID set and text are snapshotted with a deterministic revision.
- Later edits that add, remove, or materially change criteria are recorded as
  `scope_change`; they must not silently become current-task obligations.
- Ordinary chat, lookup, and small fast-lane edits remain task-free and
  unaffected.

### R2. Structured convergence state

- A formal task has one versioned convergence snapshot and append-only decision
  evidence.
- The runtime states are `working`, `verifying`, `ready_to_finish`,
  `checkpointed`, and `blocked`.
- The state reducer is deterministic and host-independent. Replaying the same
  event trace must produce the same acceptance vector, findings, and terminal
  decision.
- Every product mutation during a formal task must have an active existing
  acceptance ID. Task bookkeeping may update state without changing product
  scope.

### R3. Finding classification and scope discipline

- `blocking` means an accepted outcome is unmet and the fix remains within the
  frozen task boundary.
- `regression` means previously satisfied accepted behavior now fails because
  of current work and is blocking.
- `follow_up` means a real issue outside the frozen acceptance set. Record it,
  but do not fix it in the current task.
- `scope_change` means satisfying the request now requires changing the frozen
  acceptance contract. Checkpoint and return to planning.
- `serious_unexpected_risk` means continuing may create security, data-loss,
  release-integrity, or similarly high-impact risk. Checkpoint and surface the
  evidence; do not silently widen the implementation.
- Every finding records the acceptance ID that led to its discovery. A
  follow-up does not become a blocker merely because it was discovered during
  a blocking criterion's verification.

### R4. Deterministic finish, checkpoint, and resume

- When every non-waived criterion passes and no blocking/regression finding is
  open, transition to `ready_to_finish`. Further product mutation is rejected;
  only final reporting, spec capture, and task wrap-up remain.
- When the next action requires unavailable user input or an external state
  change, transition to `blocked` and record the concrete unblock condition.
- When work is internally resumable but the current run should stop, transition
  to `checkpointed` and persist one criterion-bound next action.
- Consecutive semantic no-progress decisions first produce corrective guidance
  and then a checkpoint. Tool churn, new wording, or additional unclassified
  findings do not reset this signal.
- Resume starts from the checkpoint and frozen acceptance revision. It does not
  regenerate an open-ended `Remaining Work` list.

### R5. Two execution planes, one semantic contract

- Codex/Trellis agents use the contract through project-local workflow, task
  state, continue behavior, and implement/check instructions.
- Dove/Pi uses the same event and decision semantics through a host-independent
  controller, native project state, Pi lifecycle integration, and ledger
  evidence.
- Shared trace fixtures must verify that both planes reach equivalent semantic
  decisions. Persistence formats may differ where platform ownership requires
  it.
- Dove remains independent of Trellis at runtime and never executes or mutates
  `.trellis` as part of normal product operation.

### R6. Resource metrics are observation-only

- Record tool calls, provider rounds, elapsed time, and provider-reported token
  usage when available, correlated to task and acceptance IDs.
- Missing or partial usage data must remain explicitly unknown.
- These metrics do not warn, checkpoint, abort, or change task state in this
  task.
- Future hard thresholds require a separate task, real-run calibration, high
  configurable defaults, and tests proving that normal long work is unaffected.

### R7. Compatibility and diagnostics

- Existing schema-1 native state and existing Trellis tasks remain readable.
- Malformed convergence state fails closed for metadata mutation while leaving
  ordinary Pi tools usable.
- User-facing status explains the current acceptance ID, convergence state,
  blocker/checkpoint reason, and next action without exposing raw prompts or
  secrets.
- No permission system, tool allow-list, or new user confirmation ceremony is
  introduced.

## Acceptance Criteria

- [ ] **AC-001 Fast lane isolation:** chat, lookup, and non-formal small edits produce no convergence files, prompts, mutation blocks, or extra questions.
- [ ] **AC-002 Acceptance freeze:** starting a formal task snapshots stable IDs and a deterministic revision; silent criterion drift is detected as `scope_change`.
- [ ] **AC-003 Mutation attribution:** every formal-task product mutation is associated with an existing acceptance ID, while an unknown ID is rejected before the mutation executes.
- [ ] **AC-004 Finding discipline:** blocking/regression findings stay in the current task; follow-ups are recorded but excluded from current remaining work; scope changes and serious risks checkpoint instead of auto-fixing.
- [ ] **AC-005 Finish convergence:** all accepted criteria passing with no open blocker deterministically yields `ready_to_finish` and prevents another implement/check product-mutation cycle.
- [ ] **AC-006 Checkpoint recovery:** semantic no-progress, interruption, and external blocking produce bounded checkpoints; resume restores the frozen acceptance vector and one criterion-bound next action.
- [ ] **AC-007 Cross-plane parity:** shared trace fixtures produce equivalent semantic decisions for Trellis/Codex and Dove/Pi, including the installer expansion scenario.
- [ ] **AC-008 Observability only:** tool-call, provider-round, elapsed-time, and available token metrics are recorded and queryable but never influence a convergence decision.
- [ ] **AC-009 Backward compatibility:** existing native/Trellis fixtures stay readable, malformed new state is preserved, and ordinary tool execution remains available.
- [ ] **AC-010 Quality gate:** focused convergence tests, full Node tests, typecheck, installer tests, doctor, and Pi smoke pass; Trellis workflow and agent instructions agree on the same terminal semantics.

## Out of Scope

- Hard limits on total tool calls, task elapsed time, or total tokens.
- Raising or depending on undocumented Codex host limits.
- A new permission model, tool allow-list, or confirmation flow.
- Automatic repair of follow-up findings or automatic acceptance of scope
  changes.
- Replacing request retry, provider-round, context-window, or repeated-read
  safety guards that already protect narrower failure modes.
- Modifying the active installer task or mixing installer fixes into this task.

## Rollout Constraint

Implement in independently verifiable slices. Do not begin a later slice until
the earlier slice's named acceptance criteria pass and a checkpoint is written.
If the full scope cannot remain convergent as one task, split the implementation
into child tasks without changing this parent acceptance contract.
