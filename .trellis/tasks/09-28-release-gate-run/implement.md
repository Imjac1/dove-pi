# Implementation plan: the release gate, given artifacts

## Ordered checklist

- [ ] **1. Build the stage**: the shipped roots plus `release.json`, in a temp directory.
- [ ] **2. Zip it and checksum it**, with the same names the workflow uses.
- [ ] **3. Run `release:check` with the five arguments.**
- [ ] **4. Record the verdict**, and clean up.

## Validation commands

```powershell
npm run release:manifest -- "$env:TEMP\dove-gate\release.json"
python scripts/check_release_readiness.py --help
```

## Recorded, not built

1. **A real install**, which writes outside the repository.
2. **The first real turn**, which needs a Pi host.
