# Implementation plan: fixtures from the writer types

## Ordered checklist

- [x] **1. The readings helper types its kind as `ExecutionRecordKind`.**
- [x] **2. The suite passes, so no hand-written kind in it is invented.**
- [x] **3. Every other ledger-line builder checked**: none exists outside the readings suite, and the kinds named anywhere in the
      suite are all declared.
- [ ] **4. The correction recorded** in the previous task and the contract: who reads the resource record.
- [ ] **5. The method lesson in the guide.**

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/harness-readings.test.ts
```

## Recorded, not built

1. **Renaming `task.convergence.observed`**, which reads oddly for a resource observation but costs nothing measured.
2. **Refusing an unknown kind at read time**, which the additive-kinds rule exists to avoid.
