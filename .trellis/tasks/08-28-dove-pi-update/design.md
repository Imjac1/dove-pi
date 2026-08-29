# Dove Pi V2 托管安装与更新 — Technical Design

## 1. Architecture

```text
GitHub latest stable release
  ├─ install.ps1
  ├─ dove-pi-windows.zip
  ├─ dove-pi-windows.zip.sha256
  └─ release.json
             |
             v
%LOCALAPPDATA%\DovePi\staging\<transaction-id>
  download -> hash verify -> extract -> npm ci -> quick verify
             |
             | atomic activation only after required checks pass
             v
%LOCALAPPDATA%\DovePi\app\versions\<release-id>
%LOCALAPPDATA%\DovePi\state\install.json
%LOCALAPPDATA%\DovePi\bin\dove-pi.ps1 + dove-pi.cmd
             |
             +---- current release
             +---- previous release (rollback)

External user state (never moved into app versions)
  ~/.pi/agent                  Pi settings, sessions, package root
  <project>/.trellis           project data and generated workflows
  arbitrary development clone user work
```

The stable launcher is the only permanent executable surface. It reads `state/install.json`, validates that `current.installPath` stays below the managed versions root, and starts that release's `dove_pi.py`. It never discovers a source checkout implicitly.

## 2. Source boundaries

### Application-owned and transactional

- Dove Python launcher/maintenance code.
- Dove TypeScript runtime and extension.
- locked `node_modules`, including exact Pi core/TUI and bundled Trellis CLI.
- release metadata required to validate compatibility.

### User-scoped and non-transactional

- Pi settings, models, credentials, sessions and package root.
- Dove-managed Pi extensions recorded by identity/spec in install state.
- user-installed Pi extensions not recorded as Dove-managed.
- project `.trellis/` directories.
- terminal font and Terminal settings.

The application transaction may not claim that external components rolled back. External components are reconciled separately and reported as healthy/degraded.

## 3. Release contract

The GitHub workflow runs only for `v*` tags matching `package.json` and produces immutable assets. A release contains a machine-readable manifest similar to:

```json
{
  "schemaVersion": 1,
  "version": "0.2.0",
  "releaseId": "0.2.0+abcdef0",
  "commit": "abcdef012345...",
  "platform": "windows",
  "runtime": { "python": ">=3.10", "node": ">=22.19.0" },
  "components": {
    "pi": "0.84.3",
    "piTui": "0.84.3",
    "trellis": "0.6.16"
  },
  "profiles": {
    "max": ["npm:package-a@1.2.3"]
  }
}
```

The checked-in catalog remains the authoring source for extension identity/order/compatibility notes. Release packaging resolves every managed npm package to an exact version and writes the release manifest. Packaging fails if a profile still contains an unpinned resolved spec or if package-lock disagrees with Pi/TUI/Trellis versions.

`@mindfoldhq/trellis` becomes a locked application dependency. The project provider invokes its bundled bin by absolute path. A user's unrelated global Trellis remains untouched.

## 4. Managed layout and state

```text
DovePi/
  bin/
    dove-pi.cmd
    dove-pi.ps1
  app/versions/
    0.2.0+abcdef0/
    0.1.0+1234567/
  cache/releases/
  staging/<uuid>/
  state/
    install.json
    maintenance.lock
  logs/maintenance-YYYYMMDD-HHMMSS.log
```

`install.json` stores no secrets:

```json
{
  "schemaVersion": 2,
  "current": { "releaseId": "0.2.0+abcdef0", "installPath": "..." },
  "previous": { "releaseId": "0.1.0+1234567", "installPath": "..." },
  "profile": "max",
  "managedExtensions": [
    { "identity": "npm:package-a", "spec": "npm:package-a@1.2.3", "status": "healthy" }
  ],
  "lastMaintenance": { "command": "update", "status": "ready", "at": "..." }
}
```

Writes use a temp file in the same state directory, flush/close, then `os.replace`. Readers reject install paths that resolve outside `app\versions`. If current is missing/invalid and previous validates, the launcher falls back to previous and prints one repair notice.

## 5. Maintenance planner and executor

All commands build the same internal plan:

```text
discover local state
  -> acquire lock
  -> resolve requested release
  -> compute steps (download/stage/reconcile/activate/cleanup)
  -> execute with per-step result
  -> atomically persist final state
  -> release lock
```

This avoids separate install/update implementations drifting again. `install`, `update`, and `repair` differ only in target selection and which health failures schedule work.

### Lock contract

- Create lock atomically with exclusive create.
- Store PID, command, start time and process start identity where available.
- An existing live owner causes a fast actionable exit.
- A dead PID/expired lock is renamed to a diagnostic stale file before retry; never blindly overwrite an ambiguous live lock.
- Lock acquisition and release are covered by multi-process tests.

## 6. Command flows

### Bootstrap install

1. `install.ps1` validates Windows, PowerShell, Python and Node.
2. Resolve GitHub latest non-prerelease assets.
3. Download zip and checksum to a unique temp directory.
4. Verify SHA-256, then invoke the packaged Python maintenance entry with explicit managed root.
5. Stage/extract, validate `release.json`, run `npm ci` and quick verification.
6. Move staged app into `app\versions\<release-id>`.
7. Reconcile default `max` managed extensions through bundled Pi using exact specs; optional failures become degraded entries.
8. Install font only when missing; failure selects ASCII and remains non-fatal.
9. Write state and launchers atomically, add bin to user PATH idempotently.
10. Print the installed version and `dove-pi doctor` next step.

### Update

1. Acquire lock and fetch only explicit stable release metadata.
2. If release differs, perform the same staging and verification path as bootstrap.
3. If release is unchanged, skip archive/npm work.
4. Reconcile launcher/state and only missing or mismatched Dove-managed exact extension specs.
5. Activate a new app only after app checks pass; record external degraded components separately.
6. Keep previous version, prune older safe versions after path validation.

### Check

`update --check` fetches release metadata, compares release ids, and reads local component state. It never acquires a write transaction, runs npm, changes settings or cleans staging. Network errors produce an `unavailable` result rather than implying the installation is outdated.

### Repair

Repair verifies current files/manifest, launcher target, runtime availability and managed extension state. A damaged app is rebuilt into a sibling version directory from cache first, then the stable asset if needed. It never edits the current directory in place.

### Rollback

Rollback validates previous, swaps current/previous atomically, and leaves external extensions unchanged. It then runs local doctor and reports any compatibility warning honestly.

### Uninstall

Uninstall validates the managed root and requires confirmation. It removes launchers and managed application/state/cache only. Pi user data, projects, external extensions and development clones remain unless a future explicit purge command is designed.

## 7. Managed extension reconciliation

Pi's package manager compares npm identity independent of version and replaces the configured spec when an exact version changes. Dove therefore calls Pi official install once per mismatched Dove-managed package:

```text
pi install npm:<name>@<exact-version>
```

Rules:

- Never call untargeted `pi update --extensions` from Dove maintenance.
- Never alter a package identity absent from the Dove ownership ledger unless it is part of the selected profile and the user is installing/migrating that profile.
- Preserve package filters/metadata where Pi's persisted object form is present.
- Install in catalog load order.
- Retry known optional native dependency failures once; never kill processes or delete the entire Pi npm root.
- Record required/optional result per component for doctor and JSON output.

## 8. V1 migration

The installer recognizes old launchers whose target is outside the managed versions root. It reads the old `.dove/manifest.json` only for a valid profile; commit fields are diagnostic, not trusted as installed version.

Migration sequence:

1. Snapshot old launcher target and profile.
2. Perform a complete V2 install without modifying old launcher.
3. Verify the new managed launch directly.
4. Atomically replace launchers/state.
5. Report the old checkout path and explicitly leave it untouched.

If migration fails before step 4, the old launcher remains active. `--force` is removed from this path.

## 9. Output and diagnostics

Human mode emits stable stages such as `Resolve`, `Download`, `Verify`, `Install`, `Extensions`, `Activate`. It does not stream duplicate JSON objects from child commands; detailed child output goes to the maintenance log unless a failure occurs.

`--json` emits one final JSON document to stdout. Progress and diagnostics use stderr. Error documents include code, failed step, current release, whether fallback remains runnable and log path; they exclude environment dumps and secrets.

## 10. Compatibility and rollout

- Windows managed install is the supported V2 path.
- `python dove_pi.py install` delegates to managed install for one compatibility cycle.
- Existing `dove-pi` launch behavior and target project cwd remain unchanged after launcher resolution.
- Developers continue to run `python dove_pi.py` from a checkout. No implicit global dev link is created.
- README stops recommending clone-as-install after V2 assets exist.
- The first implementation PR may prepare release workflow and local fixtures without publishing a GitHub release; publication remains an explicit release operation.

## 11. Security and rollback considerations

- SHA-256 is verified before extraction; archive entries are rejected if they escape staging (zip-slip).
- Every recursive delete/move resolves the absolute target and proves it is below the expected managed root.
- Release directories become read-only by convention after activation; repair creates a replacement instead of editing current.
- The running updater never deletes its own current/previous version.
- Release signing is deferred and documented as a limitation.

## 12. Key trade-offs

- Managed releases use more disk than in-place git pull, but make failure recovery and developer isolation possible.
- Bundling Trellis duplicates a user's optional global Trellis installation, but gives Dove a tested deterministic runtime.
- Exact extension versions reduce surprise; users who want latest unrelated extensions manage them through Pi separately.
- App rollback cannot atomically downgrade user-level extensions, so Dove core must remain usable when optional extensions are newer or degraded.
