# Implementation plan: every path a specification names

## Ordered checklist

- [ ] **1. The check**: owned paths in the specifications, resolved from the root or the file, with the limit stated.
- [ ] **2. The seed**: a specification naming a missing file is reported; one naming an existing file is not.
- [ ] **3. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/document-drift.test.ts
```

## Recorded, not built

1. **The guides**, whose example paths are not claims.
2. **The first real turn**, which needs a Pi host.
