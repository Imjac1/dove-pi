# Implementation plan: what an update may overwrite

## Ordered checklist

- [ ] **1. The marker check**: our content is after `TRELLIS:END`, proved by seeding.
- [ ] **2. The ownership check**: no tracked `.trellis/spec/**` path, vacuous and stated when the file is absent.
- [ ] **3. `AGENTS.md`**: say why the section is where it is.
- [ ] **4. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/document-drift.test.ts
```

## Recorded, not built

1. **The tracked tool files**, which are tool content.
2. **The first real turn**, which needs a Pi host.
