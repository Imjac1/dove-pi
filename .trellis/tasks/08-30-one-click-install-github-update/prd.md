# One-click install and GitHub update

## Goal

Make Dove Pi deployable and maintainable by a normal Windows user through one
obvious installation entry point and one reliable `dove-pi update` command.
The default path installs the complete supported Dove experience, verifies it,
and leaves a working global launcher without requiring the user to understand
the repository, profiles, release assets, or recovery internals.

## User Value

- A new user can install Dove Pi without cloning the repository or assembling
  commands and optional components manually.
- An existing user can update from the same public GitHub channel without
  damaging the current working release when the network or release is bad.
- Failures explain the missing prerequisite or failed stage and give one
  recovery command instead of leaving a half-installed application.

## Confirmed Facts

- The README already advertises a one-line PowerShell bootstrap from
  `releases/latest/download/install.ps1` (`README.md:9-23`).
- `install.ps1` currently stops unless Python 3.10+ and Node.js 22.19+ are
  already in `PATH` (`install.ps1:28-33`); it does not bootstrap prerequisites.
- The bootstrap and updater both depend on the unauthenticated GitHub
  `releases/latest` API (`install.ps1:12`, `installer/release.py:17,103`). A
  live audit from this machine returned HTTP 403 rate-limit errors, so a public
  install/update can fail even before asset download.
- The release workflow runs only for `v*` tags and would publish
  `dove-pi-windows.zip`, its SHA-256 file, `install.ps1`, and `release.json`
  after all gates pass (`.github/workflows/release.yml:5,24-46`).
- `git ls-remote --tags origin` returned no tags. Therefore the repository has
  no release-triggering tag and the advertised `releases/latest` install path
  cannot currently be a dependable public entry point.
- Local `master` is three commits ahead of `origin/master`, and the checkout
  also contains two in-progress tasks. Publishing must not package or push a
  dirty checkout accidentally.
- The managed installer already provides versioned installs, SHA-256 checks,
  atomic activation, current/previous state, repair, rollback, and exact
  extension reconciliation (`installer/manager.py:176-279`). These mechanisms
  should be reused rather than replaced.
- The default install profile is intended to be complete (`max`), while
  advanced profiles and skip flags remain escape hatches.
- GitHub CLI is not installed on this machine. Neither end-user installation
  nor release validation may require `gh`.

## Requirements

### R1. One obvious bootstrap

- Provide one copy-paste Windows command and an optional downloaded-script path.
- The default installs the full supported profile, bundled Trellis, managed
  extensions, launcher, PATH entry, and appropriate icon behavior.
- Progress is short and stage-oriented; advanced profile/verification flags do
  not dominate the default help or output.
- Re-running the bootstrap is safe and converges to a healthy current release.

### R2. Reliable GitHub release channel

- Stable install/update consumes immutable GitHub Release assets, never a
  mutable branch archive or `git pull`.
- Bootstrap/update must not rely solely on an unauthenticated GitHub API call;
  normal public installation remains usable when the REST rate limit is
  exhausted.
- Release publication validates the version/tag/manifest/assets contract and
  refuses a dirty, mismatched, or partially verified publication.
- A first stable release must be produced before README declares the one-line
  command operational.

### R3. Safe one-command update

- `dove-pi update` checks the stable release channel, downloads only when
  needed, verifies checksum and manifest identity, installs in staging, runs
  the selected verification, and atomically activates.
- The Pi runtime is a release-locked Dove component. Updating Dove must install
  the exact Pi version declared by the new manifest/lockfile, report the
  current/latest Pi versions during check/update, and never delegate to Pi's
  global self-updater.
- Network, checksum, dependency, verification, or activation failures preserve
  the previous working release.
- `dove-pi update --check --json` remains finite, read-only, and machine
  readable; ordinary startup never checks the network.
- Same-version update repairs the launcher and reconciles managed components
  without reinstalling application dependencies.

### R4. Foolproof recovery and diagnostics

- Errors identify the failed stage and print one next action: retry, `repair`,
  or install a missing prerequisite.
- `repair` and `rollback` continue to operate from local state/cache when the
  network is unavailable.
- Installer tests never write to the real `%LOCALAPPDATA%\DovePi`, user Pi
  state, PATH, or the current checkout.
- `dove-pi uninstall --yes` removes only Dove-managed application files and
  the Dove launcher entry from user PATH. It preserves Pi credentials,
  sessions, settings, extensions, project `.trellis`, development checkouts,
  Python, and Node.js.

### R5. Documentation and release readiness

- Chinese and English README installation/update sections describe the same
  default path and separate normal use from advanced flags.
- A release-readiness command or CI gate verifies manifest generation, asset
  names, checksums, bootstrap syntax, launcher behavior, and update/rollback
  smoke tests before tagging.

## Acceptance Criteria

- [ ] On a clean supported Windows environment, one documented command leaves
  `dove-pi --version`, `dove-pi doctor`, and Pi smoke working.
- [x] Default bootstrap installs the complete profile without asking the user
  to choose extensions or understand profiles.
- [x] Bootstrap and update can resolve/download the latest release without a
  successful GitHub REST API request.
- [x] Missing prerequisites follow the approved automatic-install or guided
  fallback policy and never fail with an unexplained command-not-found error.
- [x] A same-version reinstall/update performs no redundant archive download or
  `npm ci` when the current release is healthy.
- [x] A corrupt checksum, malformed manifest, failed verification, or simulated
  activation failure leaves current/previous state runnable.
- [x] `update --check --json` writes exactly one JSON object and mutates no
  install state.
- [x] Release CI produces exactly the four documented assets from a matching
  `v<package-version>` tag only after all quality gates pass.
- [x] Installer/unit/E2E tests use isolated temporary roots and leave the real
  user environment unchanged.
- [x] Chinese and English README commands and behavior are synchronized.
- [x] A Release update proves that the active Pi runtime moves from the old
  manifest version to the new exact manifest version and reports the change.
- [x] Uninstall removes managed files and the persisted launcher PATH entry
  while preserving all user/project/Pi data.

## Out of Scope

- Updating directly from `master` or another mutable branch.
- Silently changing an existing project's `.trellis/` files during app update.
- Automatically publishing a release from every push.
- Replacing GitHub Releases with a separate update server.
- Requiring GitHub CLI for end-user installation or update.

## Key Product Decision

- “One-click” includes prerequisite bootstrap. Existing compatible Python and
  Node installations are preserved. When either runtime is absent or too old,
  the bootstrap may use `winget` with visible stage output and accepted package
  agreements to install `Python.Python.3.12` and `OpenJS.NodeJS.LTS`, refresh
  the current process environment, and continue. If `winget` is unavailable or
  installation still does not expose a compatible executable, fail before any
  Dove activation with the exact prerequisite command and retry instruction.
