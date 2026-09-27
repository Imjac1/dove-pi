# Implementation plan: the harness gets an entrance

## Ordered checklist

- [ ] **1. The index** at `.trellis/spec/README.md`: five answers, each a link, about a screen.
- [ ] **2. The pointer** in `AGENTS.md`, outside the managed block.
- [ ] **3. The check** in `tests/document-drift.test.ts`, with its stated limit.
- [ ] **4. Every link resolved** by the test, and the gate.

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/document-drift.test.ts
```

## Recorded, not built

1. **The README pointer**, which is a product-document decision rather than a development one.
2. **The first real turn**, which needs a Pi host.
