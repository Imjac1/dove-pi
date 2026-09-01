# Dove Native Workflow

## Goal

Make Dove usable without Trellis at runtime. Pi remains the execution and tool
authority; Dove owns only compact project memory, goal continuity, loop/cost
control, and diagnostics.

## Requirements

### R1. Native project state

- A project works immediately without `.trellis`, Python, or a Trellis CLI.
- Dove stores one compact, versioned project state under `.dove/` with goals,
  status, key decisions, next step, and verification summary.
- Project mutations are atomic and recoverable through the existing ledger.

### R2. No workflow gate

- Ordinary inspect/edit/test requests execute directly through Pi tools.
- Creating a tracked goal is optional and never a prerequisite for coding.
- Dove does not require PRD/design/implementation artifacts or phase approval.
- Missing task metadata cannot trigger a project-initialization question.

### R3. Legacy compatibility

- Existing `.trellis` tasks/specs/memory remain readable as compatibility data.
- Dove never executes project-owned Trellis scripts or the bundled Trellis CLI.
- The first native mutation may import the useful current goal metadata without
  modifying or deleting `.trellis`.

### R4. Small model-facing surface

- Native project guidance contains only the current goal, next step, relevant
  decisions, and bounded verification state.
- Task inventory is deterministic and does not invite filesystem archaeology.
- Loop limits and token budgets remain progress controls, not permission checks.

### R5. Distribution

- `@mindfoldhq/trellis` is removed from runtime dependencies and release data.
- CLI, Pi commands, README, doctor, and tests describe Dove Native Workflow.
- Legacy Trellis compatibility is clearly labelled read-only.

## Acceptance Criteria

- [x] A clean project can create, continue, finish, and archive a native goal
      without `.trellis` or Python.
- [x] A normal edit request in a clean project asks no initialization/task
      question and does not require a tracked goal.
- [x] An existing Trellis project exposes its unfinished tasks and relevant
      documents without invoking `.trellis/scripts/task.py`.
- [x] Native mutations do not modify `.trellis`.
- [x] Provider-facing project context is smaller than the equivalent Trellis
      projection and remains stable until native project state changes.
- [x] No runtime import or package dependency on `@mindfoldhq/trellis` remains.
- [x] Focused tests, full tests, typecheck, installer tests, doctor, Pi smoke,
      and a real-provider clean-project flow pass.

## Notes

- Development of this migration may still use the repository's current Trellis
  process. That is not a product runtime dependency.
- Do not delete or rewrite user-owned `.trellis` directories.
