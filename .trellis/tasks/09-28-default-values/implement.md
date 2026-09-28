# Implementation plan: the defaults

## Ordered checklist

- [x] **1. The documented defaults**, from the help and both READMEs.
- [x] **2. The coded defaults**, from argparse, the bootstrap and the TypeScript fallbacks.
- [x] **3. The comparison.**
- [x] **4. Fix or record, then the gate.**

## The measurement

```text
help says                              code applies
--verify ... quick (default)           argparse default="quick", three times          agree
development is the default             workspaceMode || "development"                agree
--profile (default: stored, else max)  default=None, resolved later                  agree

install.ps1                            -Profile max, -Verify quick, passed unconditionally
```

**Three agree and the bootstrap is the exception.** It defaults `-Profile` to `max` and passes it unconditionally, so a user running the
downloaded script without the flag gets `max` even when `.dove/manifest.json` holds a stored profile - while `dove-pi install` without the
flag resolves the stored one.

**Both defaults are deliberate**: the bootstrap is the fresh-install path and the flag is the maintenance path. What was missing is the
statement, and a reader of either help would conclude the stored profile is used.

## The control

Drifting the bootstrap default makes the check fail with the declaration it could not find, and restoring it makes it pass.

## Validation commands

```powershell
python dove_pi.py --help
npm run typecheck
npm test
```

## Recorded, not built

1. **Defaults of undocumented flags**, which promise nothing.
2. **The first real turn**, which needs a Pi host.