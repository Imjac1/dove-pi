# Implementation Plan: Request Flow Logic Audit

## Ordered Checklist

- [x] Read the current task artifacts and backend request/project specs before editing.
- [x] Add focused `PlanningSession` tests for cancellation, re-questioning, same-request retry, new-request reset, create-over-current-task priority, and title/goal retention.
- [x] Add explicit cancellation/re-collection transitions in `src/core/planning-session.ts`, update guidance/decision behavior, and carry bounded goal/scope data.
- [x] Wire native confirmation cancellation in `src/pi-adapter/extension.ts` to the new transition and structured workflow result.
- [x] Extend the project-task operation boundary to pass the collected goal/description and bind create success to the newly created stable task identity, never a stale current task.
- [x] Make project mutation recovery operation-specific and collision-resistant; add tests for revision-only changes, exact create identity, and unknown outcomes.
- [x] Verify finish via current-pointer clearing, archive via removal from active tasks, and persist target pre-state evidence for startup recovery.
- [x] Fix aggregate reasoning accumulation and apply `sinceHours` consistently to output/session counts in `src/commands/token-audit.ts`; assert raw plus formatted totals.
- [x] Add adapter regression coverage for cancellation followed by a new question, existing-current-task create, requirement handoff, and successful single-confirmation creation.
- [x] Run focused tests, then typecheck, full Node/installer suites, doctor, Pi smoke, and `git diff --check`.
- [x] Run an isolated fresh-Pi replay for cancel -> re-answer -> confirm/create, existing-current-task create, requirement handoff, and run token audit against a temporary fixture plus the real read-only audit path.
- [x] Update the relevant backend spec with the verified cancellation transition and accounting invariant.
- [x] Perform the final Trellis quality check.
- [x] Commit only this task's files and product changes after the Phase 3.4 review gate.
- [x] Reproduce the real unfinished-task inventory prompt from `Desktop/code` and attribute wall time to Provider rounds rather than local tool duration.
- [x] Fix managed wrapper selection so the configured physical `-e` entry remains active while discovered duplicates are inert.
- [x] Add deterministic zero-tool task-inventory guidance, archive exclusion, read-only fallback budgets, and phase timing evidence.
- [x] Replay the exact prompt with Auto tools and isolated state; verify 9.317s wall time, one Provider round, zero tools, and no project Git changes.

## Validation Commands

```powershell
node --import tsx --test tests/planning-session.test.ts tests/pi-adapter.test.ts tests/token-audit.test.ts
npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
git diff --check
```

## Risky Files and Review Gates

- `src/core/planning-session.ts`: no direct adapter access to private state; legal transitions must be explicit.
- `src/pi-adapter/extension.ts`: cancellation must not call the Trellis mutation or success transitions.
- `src/commands/token-audit.ts`: aggregate fields must use the same inclusion/filter rules as project rows.
- Real replay must use a temporary task/project root and must not touch the unrelated active task directories.

## Rollback Points

1. Before changing the public planning state union.
2. Before wiring native confirmation cancellation into the adapter.
3. Before the full quality gate and managed Pi replay.
