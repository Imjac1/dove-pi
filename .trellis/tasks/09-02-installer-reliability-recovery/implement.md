# Implementation Plan: Installer Reliability and Recovery

## Ordered Work

1. Add focused regression fixtures for corrupt state, cache identity mismatch,
   repair lock lifetime, moved Python, proxy requests, and unsafe ZIP entries.
2. Implement strict state-read outcomes, atomic backup retention, and repair
   recovery without changing schema-2 valid-state behavior.
3. Refactor update/repair to share one locked transaction and add tests proving
   no interleaving or destructive prune on uncertain state.
4. Make release cache identity-aware, add mismatch redownload, exact offline
   selection, and bounded retention.
5. Replace the install-time-only Python launcher binding with runtime discovery;
   cover PowerShell and `.cmd` host fallback on Windows.
6. Add PowerShell request timeout, proxy resolution, bounded redirects, and
   cleanup diagnostics while preserving all existing switches.
7. Complete Python and PowerShell archive entry validation, then run release
   readiness checks against the resulting bundle.
8. Update bilingual recovery documentation and the managed-install spec with
   only the new executable contracts.
9. Run focused tests after each stage, then full quality gates and isolated
   Release E2E through `127.0.0.1:10808`.

## Validation Commands

```powershell
python -m unittest discover -s tests -p '*installer*_test.py'
npm run typecheck
npm test
npm run doctor
npm run pi:smoke
npm run release:manifest -- "$env:TEMP\dove-release.json"
npm run release:check -- ...
git diff --check
```

The E2E harness must set temporary `DOVE_PI_HOME` and Pi state roots. It must
exercise install, same-version no-op update, replacement-asset update, corrupt
state repair, rollback, offline repair, launcher invocation after runtime
relocation, and uninstall preservation. It must not modify real user PATH,
`%LOCALAPPDATA%\DovePi`, Pi state, project state, or GitHub assets.

## Review Gates

- No valid existing release is deleted because a state file is malformed.
- No cache mismatch is reported as an unrecoverable update when a fresh asset
  is available.
- Repair fallback has one lock from candidate selection through prune.
- Valid schema-2 installations and current release URLs remain compatible.
- `--json` stdout is exactly one parseable document for every maintenance
  success and failure path.
- No permission gate or unrelated runtime/request code is introduced.
- Full-scope check includes all touched layers and release packaging.

## Rollback Points

- Revert state recovery independently if schema migration exposes incompatibility.
- Revert cache retention independently; identity checks must remain enabled.
- Revert launcher discovery independently while retaining managed transaction
  fixes.
- Revert bootstrap network changes independently while retaining Python-side
  release verification.

## Scope Exclusions

Do not change `.trellis/tasks` outside this task, `C:\Users\rebot\Desktop\code`,
Pi request behavior, extension selection, or release publication until the
implementation and isolated acceptance suite are green.
