# Implementation plan: the per-round score

## Ordered checklist

- [ ] **1. The decision** recorded in the PRD, with its three reasons.
- [ ] **2. The appender**: the vector and the counter.
- [ ] **3. The host call site**: pass them from the snapshot already read.
- [ ] **4. The axis**: ITQ from the decision sequence, and the entry leaves `UNCOMPUTABLE_AXES`.
- [ ] **5. Tests** for the record and for each number.
- [ ] **6. The convergence record specification** gains the decision.
- [ ] **7. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/harness-axes.test.ts tests/pi-adapter.test.ts
```

## Recorded, not built

1. **A threshold for ITQ**, which is not the harness business to choose.
2. **The Pareto axis**, which needs a second objective.
