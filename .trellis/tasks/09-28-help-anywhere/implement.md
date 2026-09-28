# Implementation plan: a help flag answered wherever it appears

## Ordered checklist (reconstructed, and matched against what was done)

- [x] **1. Measure by running**: the launcher, its five read-only subcommands, and all fourteen `--help` invocations.
- [x] **2. Read the mechanism**: help recognised only as `arguments[0]`.
- [x] **3. The guard**: for the local CLI commands, a help flag anywhere prints the router help.
- [x] **4. Verify no regression**: `install --help` still argparse own, top level unchanged, installer suite 111 tests OK.
- [x] **5. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
```

## Recorded, not built

1. **`rpc --help` printing nothing**, which is the passthrough semantics.
2. **Per-command help text**, which the router does not have.
