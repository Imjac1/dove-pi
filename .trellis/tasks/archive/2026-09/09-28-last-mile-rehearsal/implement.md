# Implementation plan: the last mile of the guide, rehearsed on a real commit

## Ordered checklist

- [ ] **1. The test**: temp workspace and ledger, two changes against the root commit, both surfaces asserted.
- [ ] **2. The verifier and decision lines** asserted as the guide describes them.
- [ ] **3. The guide**: what a run leaves behind.
- [ ] **4. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/harness-readings.test.ts
```

## Recorded, not built

1. **The host steps**, covered by the adapter suite.
2. **The first real turn**, which needs a Pi host and a formal native task.
