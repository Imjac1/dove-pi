# Implementation plan: the third module, measured

## Before writing code

Load `trellis-before-dev`; read the boundary contract in `.trellis/spec/backend/personal-agent-harness-loop.md` and the
verifier block in `.trellis/harness-surface.yaml`. Curate `implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [x] **1. The contract**: extend the embedded note with the decision, the numbers and the reopening condition.
- [x] **2. The declaration**: one sentence where the map is read.
- [x] **3. Confirm no source file changed**, and run the suite, the budget test and the three readings.

## Verified, not promised

```text
git status:  M .trellis/harness-surface.yaml
            M .trellis/spec/backend/personal-agent-harness-loop.md
            (no source file)

npm test:   713 tests, 711 pass, 0 fail, 2 skipped
budget:     5 of 5   - loop spec 24,314 / 24,576
```

The diff being two specifications and no code is the whole claim of this task, and it is checked rather than stated. The
numbers are recorded with their method - non-comment lines matching each name, per module - because a count without a method
is a count nobody can check.

**And one thing to note for the next round**: recording the decision took the loop specification to 262 bytes of headroom.
The gate was green before the commit this time, which is the rule that was broken two rounds ago and is now being kept.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
node --import tsx --test tests/spec-context-budget.test.ts
```

## Risky files

| File | Risk | Mitigation |
|---|---|---|
| The contract | A decision paragraph can grow into an essay. | Three sentences and a table of numbers, checked against the budget test. |

**Rollback** is a checkout of two files.

## Recorded, not built

1. **The refactor**, with its reopening condition stated in the contract.
2. **The Pi-hosted turn.**