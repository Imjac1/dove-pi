# Implementation plan: every spec index lists its directory

## Ordered checklist

- [ ] **1. The check loops** over `.trellis/spec/*/` and compares each directory against its own index.
- [ ] **2. A directory with no index is reported.**
- [ ] **3. The seed**: prove it fails on an omission rather than trusting the comparison.
- [ ] **4. The guide** repeats the method lesson: widen the net before concluding, and take a probe form from the thing being probed.
- [ ] **5. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/document-drift.test.ts
```

## Recorded, not built

1. **The generator boilerplate**, which is Trellis own.
2. **A repository-wide link check**, with the measurement that says it has nothing to find today.
