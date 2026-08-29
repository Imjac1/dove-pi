# Implementation Plan

1. Audit the ten existing dirty files against the archived usage evidence and current runtime spec.
2. Complete provider budget helpers so accounting and transmitted output limits agree without imposing a fixed Ultra ceiling.
3. Fix comma-delimited negation/action intent classification.
4. Verify provider abort, stop-reason normalization, isolated state, and live-owner recovery behavior.
5. Run focused tests, typecheck, full tests, doctor, Pi smoke, and `git diff --check`.
6. Run final Trellis quality review, sync the runtime spec, then commit and archive this task separately from release work.

## Validation

```powershell
npm run typecheck
node --import tsx --test tests/core.test.ts tests/pi-adapter.test.ts tests/request-plan-model-gateway.test.ts
npm test
npm run doctor
npm run pi:smoke
git diff --check
```

## Rollback

The change remains isolated to core planning/accounting/recovery, the Pi adapter integration, and their tests. Reverting the task commit restores the previous provider hook behavior without changing user settings or session files.

