# Acceptance Evidence: Installer Reliability and Recovery

## Automated Gates

- `npm run typecheck`: passed.
- `npm test`: 240 passed, 0 failed.
- `npm run test:installer`: 105 passed, 0 failed.
- `npm run doctor`: passed; the existing managed installation remained healthy.
- `npm run pi:smoke`: passed; Dove Pi 0.1.6 and Pi 0.84.3 reported correctly.
- `git diff --check`: passed.
- Release readiness: generated manifest, archive, checksum, and bootstrap passed the four-asset readiness check.

## Isolated Release Exercise

All mutable state used temporary `DOVE_PI_HOME` and `PI_CODING_AGENT_DIR` roots. PATH, fonts, optional extensions, the real managed installation, project state, and user Pi state were not modified.

1. Ran the current `install.ps1` through `http://127.0.0.1:10808` against the real GitHub `v0.1.6` Release.
2. Completed prerequisite detection, manifest/archive/checksum download, safe extraction, real `npm ci`, activation, and launcher execution.
3. Installed the current worktree bundle as `0.1.6+installer-e2e`, then checked the stable channel. The check correctly reported a Dove identity update while Pi 0.84.3 remained unchanged.
4. Updated atomically to `0.1.6+f5df94e`, preserving `0.1.6+installer-e2e` as previous, then rolled back successfully.
5. Truncated `install.json`; repair preserved the corrupt file, recovered a verified state, and rewrote a healthy launcher/state pair.
6. Disabled network through an unreachable proxy and set npm offline, damaged both current and previous runtime trees, then repaired from the exact verified cache. The result retained distinct current and previous release identities.
7. Uninstalled both isolated installations. Dove application, cache, backup, and corrupt-state files were removed; independent Pi-state marker files remained present.
8. Removed all generated release and installation test directories after verification.

## Review Findings Resolved

- Fixed `.cmd` control flow so PowerShell Core fallback is reachable and child exit codes are preserved.
- Probed Python 3.10+ at launcher invocation instead of trusting a command name or installation-time path.
- Prevented same-identity repair from replacing previous with a broken duplicate identity.
- Required formal manifest equality before reusing an existing release directory.
- Removed backup/corrupt/temp state artifacts during confirmed uninstall.

## Residual Note

Node emits the existing `DEP0205 module.register()` deprecation warning during tests and CLI execution. It is unrelated to this installer change and does not fail any gate.
