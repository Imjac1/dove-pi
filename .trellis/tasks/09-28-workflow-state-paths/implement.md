# Implementation plan: the source of truth names two artifacts that are not there

## Ordered checklist

- [ ] **1. The check**: our front-door documents resolve; the tool document missing set is exactly the two known paths.
- [ ] **2. The correction** in the `AGENTS.md` section, naming the real path.
- [ ] **3. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/document-drift.test.ts
```

## Recorded, not built

1. **`workflow.md` itself**, which is tool content.
2. **The first real turn**, which needs a Pi host.
