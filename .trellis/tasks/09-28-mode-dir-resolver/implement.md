# Implementation plan: the mode suites read the directory the runtime reads

## Ordered checklist (reconstructed, and matched against what was done)

- [x] **1. Measure whether the shipped modes are validated**: they are, by three suites, against the real files.
- [x] **2. Measure how the host resolves a mode**: `workModeDirectory`, not a hand-written path.
- [x] **3. Point the three suites at the resolver**, each with the reason.
- [x] **4. Verify**: the three suites pass, 36 tests.
- [x] **5. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/code-audit-mode.test.ts tests/pentest-mode.test.ts tests/trading-mode.test.ts
```

## Recorded, not built

1. **Other tests that spell paths**, which this round did not measure.
2. **The first real turn**, which needs a Pi host.
