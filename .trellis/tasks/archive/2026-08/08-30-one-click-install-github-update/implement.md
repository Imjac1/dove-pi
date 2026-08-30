# Implementation Plan: One-click install and GitHub update

## Change Boundary

Expected files:

1. `install.ps1` — prerequisite bootstrap, direct Release asset resolution,
   concise stages, and actionable failure output.
2. `installer/release.py` — manifest-first direct latest-release locator and
   validated asset identity.
3. `dove_pi.py` — prerequisite recovery and simplified normal help/update UX.
4. `.github/workflows/release.yml` and one release-readiness script — validate
   tag, package, manifest, archive, checksum, and asset contract.
5. `tests/*installer*_test.py` plus isolated PowerShell/bootstrap tests.
6. `README.md`, `README.en.md`, and the managed-install runtime spec.

Do not change request middleware, capability protocol semantics, Trellis task
storage, Pi session behavior, or the extension catalog except where a release
manifest test consumes its existing public projection.

## Ordered Checklist

1. Add tests for manifest-first direct Release discovery, API-rate-limit
   independence, malformed/missing assets, and version/tag mismatch.
2. Refactor `installer/release.py` so `fetch_latest_release()` uses the direct
   `release.json` asset and constructs the fixed archive/checksum URLs without
   calling the GitHub REST API.
3. Extract testable PowerShell prerequisite/version/PATH-refresh helpers in
   `install.ps1`; cover compatible, missing, outdated, winget-unavailable, and
   post-install-still-missing cases without changing the real machine.
4. Implement exact winget bootstrap for Python 3.12 and Node LTS, preserving
   existing compatible runtimes and failing before Dove activation on error.
5. Simplify bootstrap progress and success output; verify the default remains
   profile `max`, quick verification, launcher/PATH setup, extensions, Trellis,
   and icon fallback.
6. Extend update/repair prerequisite handling only where the command can
   safely recover; document rerunning bootstrap when Python itself is missing.
7. Add release-readiness validation and make the workflow prove tag/version,
   manifest, archive contents, checksum, bootstrap syntax, and isolated install
   smoke before `action-gh-release`.
8. Add local fixture E2E for install -> same-version update -> new-version
   update -> rollback -> repair, with REST API forced unavailable and all state
   under a temporary `DOVE_PI_HOME`.
9. Rewrite Chinese and English installation/update sections around one default
   command, one update command, and one repair command; move flags to Advanced.
10. Update `.trellis/spec/backend/personal-agent-runtime.md` with executable
    prerequisite, direct Release, error, and test contracts.
11. Run focused tests, full quality gates, and a clean release-readiness dry
    run. Inspect the diff for cross-task overlap before any commit.
12. After both active tasks are integrated and committed, present the exact
    release commit/tag/assets for explicit user approval. Only then push the
    release commit/tag and verify the public one-line install from the Release.
13. Project current/latest/previous Pi versions through maintenance results and
    prove an update atomically switches the release-locked Pi runtime.
14. Complete uninstall by removing the exact Dove launcher PATH entry after
    managed files are removed; preserve user/Pi/project data and JSON purity.

## Validation Commands

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
npm run release:manifest -- "$env:TEMP\dove-release.json"
git diff --check
```

The implementation should add a finite release-readiness command and an
isolated bootstrap E2E command; include both in the final gate once their names
are defined.

## Review Gates

- A GitHub REST 403 cannot block normal bootstrap or update.
- Existing compatible runtimes are never upgraded automatically.
- Missing/outdated runtimes either become compatible through exact winget IDs
  or fail before application activation with one retry instruction.
- No test touches real PATH, winget installation state, `%LOCALAPPDATA%\DovePi`,
  Pi user state, project Trellis state, or GitHub publication.
- Same-version update performs no archive download or `npm ci`.
- A failed new release never replaces the runnable current release.
- The tag/version/manifest/archive/checksum/assets contract is proven before
  the publication action.
- Shared dirty files from the two current tasks are not staged wholesale.

## Rollback Points

- Revert direct Release discovery independently while retaining prerequisite
  bootstrap.
- Revert prerequisite auto-install independently while retaining improved
  diagnostics and release discovery.
- Revert help/output simplification without changing installer transactions.
- Release workflow changes do not affect already installed versions until a
  new tag is explicitly published.

## Start Review Checklist

- PRD has no unresolved product decision.
- Design preserves immutable Releases and the existing atomic installer.
- Publication is separated from implementation and requires explicit approval.
- Implementation/check context manifests contain real project specs and source
  evidence.
- User explicitly approves this final plan in a subsequent message before
  `task.py start`.

## Validation Evidence (2026-08-30)

- PowerShell 5.1-compatible parser and isolated bootstrap helper tests pass.
- Installer suite: 75/75 passed; no test invokes real winget, mutates real
  PATH, or writes the real managed/user roots.
- Full Node suite: 168/168 passed; TypeScript, doctor, Pi 0.84.3 smoke, and
  `git diff --check` passed.
- A locally assembled four-asset Release bundle passed `release:check` for
  `v0.1.0` / `0.1.0+5180037`.
- Direct manifest discovery, object-storage redirects, full external/embedded
  manifest identity, same-version/different-release identity, JSON stdout
  purity, corrupt assets, rollback, and offline cache repair are covered.
- The complete PowerShell bootstrap success path now runs in an isolated
  Unicode workspace, and `update --check` is proven read-only by a byte-for-byte
  managed-root snapshot. Same-release repair falls back to PowerShell Core when
  `powershell.exe` is unavailable.
- A locally assembled archive with no `node_modules` completed real `npm ci`,
  manifest validation, quick verification, managed activation, launcher
  doctor/version smoke, and max-profile reconciliation in isolated
  `DOVE_PI_HOME` / `PI_CODING_AGENT_DIR` roots. This exposed and fixed Pi/npm
  child progress contaminating the JSON stdout protocol; the rerun finished
  with all 13 managed extensions healthy and zero degraded entries.
- Managed extension children retain optional native dependencies while
  disabling repeated npm audit, funding, progress, and update-notifier work.
  Package errors and security-policy warnings remain visible; installs stay
  serialized because Pi 0.84.3 documents one package source per command and
  concurrent npm mutations would be unsafe.
- Pi 0.84.3's exported package-manager surface was inspected and has no public,
  stable persistent multi-source install operation. Dove therefore keeps exact
  package reconciliation serialized, emits bounded `[current/total]` progress
  on stderr, and lets the Python maintenance launcher inherit that stream live
  while capturing only the final JSON stdout document.
- `dove-pi --version` now reports both product identities from the release-
  locked package metadata (`Dove Pi 0.1.0 (Pi 0.84.3)`) instead of exposing only
  the underlying Pi version; the bilingual install quick-checks document the
  command.
- External acceptance remains intentionally open for a virgin Windows machine
  and the first public GitHub Release; no tag, push, real winget/PATH mutation,
  or user-root installation was performed.
- Managed update now reports current/previous/latest Pi versions, rejects an
  installed Pi/TUI/Trellis package version that differs from the Release
  manifest, and has an atomic `0.84.3 -> 0.85.0` fixture proving current and
  previous identities move together.
- Confirmed uninstall now removes the exact persisted Dove launcher PATH entry
  after deleting managed application files while preserving Pi/user/project
  data. JSON mode reports `pathRemoved` without contaminating stdout.
- Final augmentation gate: Node 201/201, installer 84/84, typecheck, doctor,
  Pi smoke, task manifest validation, Python compile, and `git diff --check`
  passed. No real PATH, user root, Release, tag, or remote was mutated.
- The first public v0.1.0 isolated install completed, but its real deep npm
  tree exposed a Windows legacy `MAX_PATH` uninstall failure that shallow
  fixtures missed. The patch validates the owned path before using Win32
  extended-length deletion and adds a greater-than-260-character regression.
- The corrective Release version is `0.1.1`; v0.1.0 remains immutable. Public
  v0.1.1 install/update/uninstall acceptance is required before task archive.
- Corrective local gate: Node 201/201, installer 89/89, typecheck, doctor,
  Pi smoke, PowerShell parser, task manifest validation, Python compilation,
  and `git diff --check` pass. The full same-release bootstrap fixture proves
  `-NoPath/-NoFont/-NoExtensions` do not mutate skipped surfaces.
- Public v0.1.1 bootstrap acceptance exposed PowerShell native pipeline exit-
  code loss: a healthy Python 3.11.6 was classified as missing before any Dove
  activation. The run was interrupted before winget installed anything. The
  fix captures native output without a pipeline, adds a real Python regression,
  and advances the immutable corrective Release to v0.1.2.
- Public v0.1.2 acceptance passed from `releases/latest/download`: the script
  preserved compatible Python 3.11.6 and Node 26.5.0, performed real `npm ci`,
  typecheck and Pi smoke, activated `0.1.2+e07788c`, and left user PATH
  byte-for-byte unchanged under `-NoPath/-NoFont/-NoExtensions`. The installed
  launcher reported Dove 0.1.2 / Pi 0.84.3, doctor was healthy, update-check
  was current, and confirmed uninstall removed every managed child from the
  real deep npm tree while preserving an isolated Pi user marker.
