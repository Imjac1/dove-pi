# Implementation plan: the cap holder

## Ordered checklist

- [x] **1. Read the case that already owns a harness.**
- [x] **2. Establish why it cannot host this assertion.**
- [x] **3. Write a case of its own with a small prefix.**
- [x] **4. The gate.**

## Validation commands

```powershell
npx tsx --test tests/pi-adapter.test.ts
npm test
```

## What would have made this a bad case

```text
appending to the fuse case   the fraction guard fires there first and consumes the shared flag,
                             so the cap assertion could never run
asserting only that a notice appears   a neighbour raising one would satisfy it, which is why the
                             case asserts the other two guards stayed silent in the same turn
leaving the env var set      it is restored in a finally, so the order of cases cannot matter
```
