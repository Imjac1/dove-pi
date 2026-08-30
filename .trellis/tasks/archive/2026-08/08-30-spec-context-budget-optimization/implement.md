# Implementation plan: Trellis runtime specification context budget

- [x] Snapshot all current top-level headings and their owning topic.
- [x] Create the five routed runtime spec files using mechanical section moves.
- [x] Replace `personal-agent-runtime.md` with the compact router and update backend `index.md`.
- [x] Add the spec-budget/router integrity regression test.
- [x] Update active `implement.jsonl` and `check.jsonl` references from the monolith to relevant topic files.
- [x] Validate every active task manifest and confirm no 32 KB truncation warning remains.
- [x] Run typecheck, Node tests, installer tests, doctor, Pi smoke, and `git diff --check`.
- [x] Review the diff for lost headings/contracts and unrelated semantic edits.

## Validation Commands

```powershell
python .\.trellis\scripts\task.py validate .trellis\tasks\08-30-spec-context-budget-optimization
npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
git diff --check
```

## Risky Files and Rollback Points

- `.trellis/spec/backend/personal-agent-runtime.md`: preserve all contracts before replacing it with the router.
- Active task `implement.jsonl` / `check.jsonl`: update only references to the monolithic runtime spec.
- Stop and compare heading/content coverage before deleting any migrated section from the original file.
