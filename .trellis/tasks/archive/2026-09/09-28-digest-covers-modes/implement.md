# Implementation plan: the digest covers the modes

## Ordered checklist

- [ ] **1. `modes` joins the roots, and the roots are exported.**
- [ ] **2. The test** asserts the inclusion, and that the manifest still builds.
- [ ] **3. The specification** records what the digest covers.
- [ ] **4. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
npm run release:manifest -- "$env:TEMP\release-after.json"
```

## Recorded, not built

1. **Published digests**, which a release owner would recompute.
2. **The first real turn**, which needs a Pi host.
