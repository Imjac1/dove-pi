# Current install and update audit (2026-08-30)

## Repository evidence

- `README.md:9-23` advertises a one-line
  `releases/latest/download/install.ps1` bootstrap and requires Windows,
  PowerShell 5.1+, Python 3.10+, and Node 22.19+.
- `install.ps1:12,28-33` calls the unauthenticated GitHub latest-release API
  and stops when Python/Node are missing or old.
- `installer/release.py:17,103` makes the same REST API the sole updater release
  locator.
- `.github/workflows/release.yml:5,24-46` triggers only on `v*` tags, runs the
  quality gates, and publishes the expected archive/checksum/bootstrap/manifest
  assets.
- `installer/manager.py:176-279` already owns install/update/repair/rollback
  transactions. It must remain the application-state authority.
- `scripts/build-release-manifest.mts` already rejects a GitHub tag whose
  version differs from `package.json` and validates exact locked runtime
  components.

## Live environment evidence

- `git ls-remote --tags origin` returned no tags, so no `v*` tag currently
  exists to trigger the Release workflow.
- The GitHub REST checks for latest release, tags, and workflow runs returned
  HTTP 403 rate-limit errors without authentication. End-user deployment must
  not depend on that quota.
- Local `master` is three commits ahead of `origin/master`; the checkout also
  has uncommitted request-middleware and interoperability work. It is not a
  safe release source until those tasks are integrated and committed.
- GitHub CLI is absent and must not be an end-user prerequisite.
- `winget 1.29.290` resolves `OpenJS.NodeJS.LTS` to Node 24.19.0 and
  `Python.Python.3.12` to Python 3.12.10. Both satisfy Dove's minimums and are
  the approved automatic prerequisite packages.

## Chosen implementation constraints

- Primary release discovery is manifest-first through
  `releases/latest/download/release.json`; archive and checksum use the same
  direct stable-asset path. REST metadata is optional only.
- Existing compatible Python/Node installations are preserved. Missing or old
  runtimes may be installed through exact winget package IDs, then process PATH
  is refreshed and versions are revalidated before any Dove activation.
- The default remains full profile `max` plus quick verification.
- Publishing a release/tag is not part of ordinary code implementation; it is
  an explicit final external action after a clean integrated commit and user
  approval.
