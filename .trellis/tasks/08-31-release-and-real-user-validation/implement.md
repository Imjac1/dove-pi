# Implementation Plan: Release and Real-User Validation

## Ordered Checklist

- [x] Read the relevant backend CLI, installer, error-handling, and cross-layer specs before editing.
- [x] Add a shared, strict parser for `--since` that supports both documented argv forms.
- [x] Add CLI integration coverage for equivalent forms and invalid/missing values.
- [x] Isolate the CLI integration fixture to the spawned process after the `v0.1.3` CI test failure.
- [x] Retrieve the authenticated `v0.1.4` job log, fix normalized text-budget accounting, and add LF/CRLF equivalence coverage.
- [x] Run focused tests and inspect the diff for unrelated changes.
- [x] Bump the patch version to `0.1.5`; retain failed `v0.1.3` and `v0.1.4` as immutable history.
- [x] Run typecheck, full Node tests, installer tests, doctor, Pi smoke, and diff checks.
- [x] Build release manifest and Windows archive in a disposable release staging directory.
- [x] Run `scripts/check_release_readiness.py` once with all required assets; use the tag-triggered Windows workflow as the clean-check and source-quality gate.
- [x] Create and push the `v0.1.5` tag only after the release readiness gate passes.
- [x] Wait for the GitHub release workflow, then verify release assets and manifest remotely.
- [x] Run managed `dove-pi update` and confirm doctor/current release identity.
- [x] Verify global `token audit --since=24h` against `--since 24h` and check aggregate reasoning.
- [x] Run the isolated real-model user journey through the global launcher: chat, read-only, repair/test, and follow-up.
- [x] Collect session usage and tool-call evidence; compare filesystem snapshots for read-only containment.
- [ ] Run the final full-scope Trellis quality check, update the task journal/spec if needed, and commit task changes.

## Validation Commands

```powershell
node --import tsx --test tests/token-audit*.test.ts tests/cli*.test.ts
npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
git diff --check
npm run release:manifest -- <staging>\release.json
npm run release:check -- --tag v0.1.5 --commit <HEAD> --manifest <manifest> --archive <archive> --checksum <checksum> --bootstrap install.ps1 --asset <archive> --asset <checksum> --asset install.ps1 --asset <manifest>
dove-pi doctor
dove-pi token audit --since=24h --filter=Desktop
dove-pi token audit --since 24h --filter Desktop
```

## Risky Files and Gates

- `src/cli.ts`: parser changes must reject malformed input instead of silently changing the reporting window.
- `package.json`: version bump must match tag and generated manifest.
- `.github/workflows/release.yml`: use the existing release contract; do not weaken asset validation.
- Managed install state: update transactionally and retain the previous release.
- Real-model session: credentials and raw secrets must not be copied into the report.

## Rollback Points

1. Before editing CLI parsing: revert only the parser/test change if focused tests regress.
2. Before version/tag creation: keep source changes untagged until release readiness passes.
3. Before managed update: preserve the existing current/previous release state.
4. After global regression failure: use managed repair/rollback and report the failed evidence.
