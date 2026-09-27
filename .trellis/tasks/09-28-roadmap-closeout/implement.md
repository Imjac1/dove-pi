# Implementation plan: the roadmap closed out

## Before writing code

Load `trellis-before-dev`; read `.trellis/tasks/09-27-harness-scaffold-frontier/decisions.md` (the record being extended)
and the round-13 task list to check the evidence table. Curate `implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [ ] **1. The Round 14 entry**: what shipped with its evidence, where D6 stands, the two round decisions, and what cannot
      be built here.
- [ ] **2. Check every claim** in the table against the artifact it names - the same discipline as the spec files.
- [ ] **3. Archive the frontier task** with the house flag, and record the active count before and after.
- [ ] **4. The gate**: suite, budget, readings, and a check that no source or specification file changed.

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/spec-context-budget.test.ts
git status --porcelain
```

## Risky files

| File | Risk | Mitigation |
|---|---|---|
| The decision record | An entry that claims more than the artifacts support. | Every claim names its artifact, and the archives are checked. |

**Rollback** is a checkout of the decisions file plus un-archiving, which is a file move.

## Recorded, not built

1. **The variant comparison** D6 wants, which needs a task set.
2. **The first turn**, which needs a Pi host.
