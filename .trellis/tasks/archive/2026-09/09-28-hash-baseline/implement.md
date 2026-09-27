# Implementation plan: what the template hashes can and cannot say

## Ordered checklist

- [ ] **1. The check comment**: baseline, three causes, the one deliberate edit.
- [ ] **2. The suite unchanged**, with the same test and pass counts.
- [ ] **3. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **A tamper check**, which the file cannot support.
2. **The first real turn**, which needs a Pi host.
