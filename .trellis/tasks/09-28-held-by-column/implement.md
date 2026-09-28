# Implementation plan: the held-by column

## Ordered checklist

- [x] **1. The mapping**, from the last two rounds.
- [x] **2. The column.**
- [x] **3. The check and its control.**
- [x] **4. The gate.**

## What was written

```text
the table now carries a second table under it: each of the ten rows and the test that holds it
a check reads that specification, extracts every `tests/...test.ts` path, and asserts each one exists
the check declares what it does not claim: a pointer resolving is not a promise being held
```

## The control, which failed two checks rather than one

```text
planted a row naming tests/this-file-does-not-exist.test.ts
  -> tests 12, pass 10, fail 2
     AssertionError: tests/this-file-does-not-exist.test.ts is named as a holder and does not exist
removed it
  -> tests 12, pass 12, fail 0
```

**Two checks went red, not one**: the new pointer check, and an existing check that reads the same document. Evidence that the document is
held in more than one way, and that planting a wrong path is caught whichever way it is read.

## One row is named by file only, on purpose

The row for an action the mode does not grant names `tests/action-policy.test.ts` and says the case is not named **because it was not read to
a case**. Writing a case name I did not read would have been the plausible-neighbour mistake, and a pointer is only worth having if it points,

## Validation commands

```powershell
node --import tsx --test tests/spec-context-budget.test.ts
npm test
```

## Recorded, not built

1. **Judging a holder**, which needs a reader.
2. **The first real turn.**