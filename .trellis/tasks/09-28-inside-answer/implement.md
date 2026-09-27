# Implementation plan: the inside answer, from a commit found at runtime

## Ordered checklist

- [ ] **1. The scan**: bounded to thirty commits, inside the rehearsal case, returning the commit and its surface or nothing.
- [ ] **2. The assertion**: `inside` with the surface read from the answer; the fallback message when there is no subject.
- [ ] **3. The fourth answer** recorded in the comment.
- [ ] **4. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/harness-readings.test.ts
```

## Recorded, not built

1. **The unreachable fourth answer**, which needs a declaration that lags the code.
2. **The first real turn**, which needs a Pi host.
