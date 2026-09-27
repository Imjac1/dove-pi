# Implementation plan: the instruments enter the type gate

## Before writing code

Load `trellis-before-dev`. Curate `implement.jsonl` / `check.jsonl` and start the task in this same turn.

## Ordered checklist

- [x] **1. The tsconfig**: include `scripts/**/*.mts`, with the comment that states why.
- [x] **2. Fix the printer** by arm, and the implicit `any` by naming its type.
- [x] **3. `npm run typecheck` clean** with the scripts inside, and the two errors reported.
- [x] **4. The assertion**: the turn output names the direction for a `gate-refusals` prediction.
- [x] **5. The contract**, and the gate.

## What the gate found, in full

```text
scripts/harness-rounds.mts(120,137): error TS2339: Property 'to' does not exist on type 'PredictedMovement'.
scripts/trellis-convergence.mts(111,42): error TS7006: Parameter 'step' implicitly has an 'any' type.
two errors, and no others: the scripts were nearly clean, and the one real defect was invisible for as long as they were outside
the gate.
```

**The fixture and the printer agreed with each other and neither agreed with the union.** The test fixture wrote
`{ observable: "gate-refusals", subject: "fence", to: "down" }` and the printer read `.to`, so the reading printed a *plausible*
value for the one case the test covered - and `undefined` for every real one, because a recorded movement names its target
`direction`. Fixing the printer alone would have made the test fail, and fixing the fixture alone would have hidden the defect
again. Both are fixed, and the assertion now names the direction.

**One thing left recorded rather than fixed**: the decoder accepted a movement carrying `to` for a `gate-refusals` observable,
which the union does not name. That tolerance is why the fixture could be wrong in the first place, and it is a decision about how
strict the decoder should be - not a side effect of adding a directory to a tsconfig.

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/harness-readings.test.ts
```

## Recorded, not built

1. **`scripts/**/*.mjs`**, which has no types to check.
2. **Unifying the movement field name**, which is a migration rather than a fix.