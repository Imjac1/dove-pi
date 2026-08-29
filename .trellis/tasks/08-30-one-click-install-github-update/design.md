# Technical Design: One-click install and GitHub update

## Boundary

Keep GitHub Releases as the stable distribution authority and reuse the
existing managed installer transaction. The change simplifies the bootstrap
and release locator; it does not replace versioned installs, extension
reconciliation, repair, rollback, or Trellis ownership.

Owned surfaces:

- `install.ps1`: zero-to-running Windows bootstrap and prerequisite setup.
- `installer/release.py`: stable Release asset discovery without mandatory
  GitHub REST API access.
- `dove_pi.py`: concise installation/update UX and prerequisite recovery for
  commands that can already start.
- `.github/workflows/release.yml` plus a release-readiness script: enforce the
  tag/version/manifest/assets contract before publication.
- Installer tests and synchronized Chinese/English README sections.

The current mixed checkout contains request-middleware and interoperability
work. Implementation must preserve those changes and stage/commit this task by
explicit paths or hunks only.

## Installation Flow

```text
one documented PowerShell command
  -> download stable install.ps1 asset
  -> preflight Windows + PowerShell
  -> resolve compatible Python and Node
       -> keep existing compatible runtime
       -> otherwise install reviewed winget package
       -> refresh process PATH and re-resolve
  -> download latest release.json through latest/download
  -> validate schema/version/releaseId
  -> download archive + SHA-256 through latest/download
  -> verify checksum and safe archive shape
  -> invoke packaged dove_pi.py install (profile=max, verify=quick)
  -> atomic managed activation + exact extension reconciliation
  -> PATH/launcher repair + doctor/Pi smoke summary
```

Normal output shows a short fixed sequence such as Prerequisites, Release,
Verify, Install, Ready. Advanced flags remain accepted but move below the
normal path in help and documentation.

## Prerequisite Contract

`install.ps1` checks versions, not only command presence:

- Python: `>=3.10`; preferred bootstrap package
  `Python.Python.3.12`.
- Node: `>=22.19.0`; preferred bootstrap package
  `OpenJS.NodeJS.LTS`.
- PowerShell: `>=5.1` remains the bootstrap floor.

An existing compatible executable always wins. An incompatible or absent
runtime triggers `winget install --id <package> --exact --silent` with source
and package agreements. After installation, the script rebuilds process PATH
from Machine and User environment values and resolves the executable again.
Failure stops before archive activation and reports the exact package command.
No prerequisite is upgraded merely because a newer version exists.

The bootstrap cannot repair a missing PowerShell. A previously installed
`dove-pi` launcher also cannot run when its Python executable was externally
removed; rerunning the public bootstrap is the documented recovery path.

## Release Discovery Without REST Dependence

Use these stable public URLs as the primary channel:

```text
https://github.com/Imjac1/dove-pi/releases/latest/download/release.json
https://github.com/Imjac1/dove-pi/releases/latest/download/dove-pi-windows.zip
https://github.com/Imjac1/dove-pi/releases/latest/download/dove-pi-windows.zip.sha256
https://github.com/Imjac1/dove-pi/releases/latest/download/install.ps1
```

The locator downloads and parses `release.json` first, derives the expected
tag as `v<version>`, and returns the three direct asset URLs. The archive's
embedded manifest must still match the downloaded manifest/tag and locked
components. GitHub's REST API may enrich diagnostics but is never required for
normal public install/update, so an exhausted unauthenticated API quota does
not block deployment.

`releases/latest` intentionally selects the latest non-draft, non-prerelease
GitHub Release. Branch archives and raw `master` files are not fallback update
sources because they are mutable and cannot satisfy the atomic release
identity contract.

## Update and Recovery Flow

`dove-pi update` keeps the existing transaction boundary:

1. Resolve the direct stable release manifest.
2. Compare installed version/release identity.
3. For a healthy same version, skip archive download and `npm ci`; repair the
   launcher and reconcile selected managed extensions under the same lock.
4. For a new version, download to a temporary directory, verify checksum and
   manifest, prepare dependencies in staging, run verification, then activate.
5. Preserve current as previous. Any pre-activation failure leaves state
   untouched; activation/state failures use existing transaction recovery.

`update --check --json` downloads metadata only, holds no mutation lock, writes
no maintenance log, and emits exactly one JSON object. Ordinary Pi startup and
doctor remain offline.

## Release Publication Contract

The release workflow remains tag-triggered. A release-readiness gate must
reject publication unless:

- the ref is exactly `v<package.json version>`;
- lockfile and exact Pi/TUI/Trellis/extension versions match the generated
  manifest;
- all TypeScript, Node, installer, doctor, Pi smoke, and bootstrap tests pass;
- the staged archive contains one valid release root and the required files;
- generated archive SHA-256 matches its checksum asset;
- the asset set is exactly `dove-pi-windows.zip`,
  `dove-pi-windows.zip.sha256`, `install.ps1`, and `release.json`.

Creating/pushing the first stable tag is a separate externally visible action
performed only after the checkout is clean, both active tasks are integrated,
the user explicitly approves publication, and the remote branch contains the
release commit.

## Compatibility and Migration

- Existing schema-2 managed state, current/previous installs, cache, profiles,
  launchers, and user Pi state remain valid.
- Existing advanced flags continue to work.
- Source-checkout `python dove_pi.py install` remains a development path; it is
  not presented as the normal end-user install.
- No application update rewrites existing project `.trellis/` content or a
  development checkout.

## Security and Failure Handling

- Keep SHA-256 verification, zip-slip protection, path-validated launchers,
  maintenance locks, and atomic state writes.
- Do not pipe a branch/raw script into PowerShell; the public one-liner targets
  a published Release asset.
- Prerequisite installation uses exact winget package IDs and does not execute
  search-result text.
- Test overrides for asset URLs or install roots must accept only explicit
  test configuration and never weaken production URL validation silently.
- Every failure is labeled by stage and gives one recovery action.

## Trade-offs

- Automatically installing runtimes makes first use simpler but may display a
  Windows installer/UAC prompt and increases bootstrap time.
- Requesting direct `latest/download` assets removes REST rate-limit failures
  but provides less release metadata; the signed manifest/checksum identity is
  the authoritative data actually needed by the installer.
- The first public one-liner cannot work until a clean stable Release is
  published. Documentation must distinguish “release-ready” from “published”.

## Rollback

- Prerequisite installs are external system components and are not removed by
  Dove rollback/uninstall.
- Application rollback continues to switch only current/previous managed
  releases.
- If direct Release discovery regresses, the locator can temporarily fall back
  to the existing API implementation for diagnostics, but never to a mutable
  branch archive.
