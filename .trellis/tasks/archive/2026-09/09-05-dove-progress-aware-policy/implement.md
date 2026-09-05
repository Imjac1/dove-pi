# Implementation Plan: Progress-aware exploration policy

## Ordered Work

- [x] Add a focused `ProgressGuard` regression for changing observations beyond
      the historical hard-stop count.
- [x] Change the guard so a read-only count is advisory and only semantic
      repetition/no-progress can terminate a read call.
- [x] Add a public black-box provider scenario for twenty changing reads and a
      bounded unchanged-read scenario.
- [x] Update strategy/README/spec wording and terminal diagnostics.
- [x] Run focused guard and black-box tests.
- [x] Run full Node tests, typecheck, doctor, Pi smoke, and diff check.
- [x] Review only task-owned hunks against the parallel dirty worktree.

## Validation Commands

```powershell
node --import tsx --test tests/pi-adapter.test.ts tests/real-dove-blackbox.test.ts
npm test
npm run typecheck
npm run doctor
npm run pi:smoke
git diff --check
```

## Risks

- Removing a count terminal could allow an unchanging but varied-input loop to
  continue; the repeated-observation and repeated-failure guards must be tested
  independently.
- Existing consumers may interpret `readOnlyToolHardStopThreshold` as a real
  stop. Keep the field for diagnostics and document its advisory meaning.
