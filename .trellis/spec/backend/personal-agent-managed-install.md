# Personal Agent Managed Installation

> **Scope:** Managed installation, release, update, repair, and launcher contracts.
>
> **Canonical router:** [Personal Agent Runtime Contract](./personal-agent-runtime.md)
> **Related specifications:** [personal-agent-extension-runtime](./personal-agent-extension-runtime.md)

## Scenario: Managed Dove Pi Installation and Stable Updates

### 1. Scope / Trigger

- Trigger: changing `dove_pi.py`, `installer/**`, release packaging, the stable launcher, managed extension reconciliation, or the bundled Trellis dependency.
- Scope: Windows V2 installs under `%LOCALAPPDATA%\DovePi`; Pi user state, project `.trellis/`, global Trellis, and development checkouts remain external.

### 2. Signatures

```text
dove-pi update [--check] [--verify quick|full|none] [--json] [--no-extensions]
dove-pi repair [--verify quick|full|none] [--json]
dove-pi rollback [--json]
dove-pi uninstall --yes [--json]
dove-pi --version
DOVE_PI_HOME=<absolute test root>
```

```python
ComponentReconciler = Callable[[InstallState], Sequence[ManagedExtensionState]]

ManagedInstaller.install_source(
    source: Path,
    profile: str | None,
    verify: str,
    reconcile_components: ComponentReconciler | None,
    source_asset: tuple[Path, Path, str] | None,
) -> MaintenanceResult
ManagedInstaller.update(
    check: bool,
    verify: str,
    reconcile_components: ComponentReconciler | None,
) -> MaintenanceResult
ManagedInstaller.repair(
    verify: str,
    reconcile_components: ComponentReconciler | None,
) -> MaintenanceResult
ManagedInstaller.rollback() -> MaintenanceResult
ManagedInstaller.uninstall(confirmed: bool) -> MaintenanceResult
```

### 3. Contracts

- The launcher reads `state/install.json` schema 2 and may execute only a path strictly below `app/versions` containing `dove_pi.py`, `release.json`, and `node_modules`.
- The stable Python launcher is the public command router as well as the Pi entry point. Every documented local Dove command family (including `capability`, `rpc`, and `mcp`) must be classified explicitly and forwarded to the bundled TypeScript CLI; unknown/interactive arguments alone may fall through to Pi. Adding a CLI command without updating and testing this router is an incomplete cross-layer change.
- Exact `version` and `--version` requests are handled before Pi launch and read both release-locked identities from the packaged `package.json`, producing `Dove Pi <dove-version> (Pi <pi-version>)`.
- Pi is an exact Release component, not an independently mutable global runtime. Managed launches suppress Pi's direct version/self-update path; `dove-pi update` installs the manifest/lockfile Pi version in staging, reads the actual installed Pi/TUI/Trellis package versions back from `node_modules`, and activates only when all three match. Check/update results project current, previous, and latest Pi versions and report whether Pi changes.
- Install into a staging sibling, run locked dependency installation and verification, move to an immutable version, then activate with atomic state replacement. Retain current and previous.
- Install, update, and repair hold the same cross-process maintenance lock through application activation, managed-component reconciliation, final state persistence, launcher rewrite, and pruning. The component reconciler is an injected callback so the Python installer does not duplicate the TypeScript extension catalog; never release the maintenance lock and reacquire a separate component lock between these steps.
- A healthy current release with the same stable version is an application no-op: no archive download and no `npm ci`. Launcher repair and Dove-managed extension reconciliation may still run.
- The public Windows bootstrap owns prerequisite setup. It preserves compatible Python `>=3.10` and Node `>=22.19.0`; missing, incomplete, or older runtimes use only the exact reviewed winget package IDs `Python.Python.3.12` and `OpenJS.NodeJS.LTS`, refresh process PATH, and are revalidated before any archive activation. When winget is unavailable or the runtime remains unusable, fail with the exact package command and bootstrap retry instruction.
- `repair --verify none` checks the local manifest and required runtime files. `quick` additionally runs typecheck and Pi smoke against each candidate; `full` also runs the complete test suite. A candidate that fails the requested level is not healthy and repair proceeds to previous, verified cache, or stable release.
- A source checkout without complete `release.json` component/profile metadata is hydrated only after `npm ci` by the existing TypeScript `release:manifest` generator. The generated manifest preserves the source release ID/commit and becomes the installed manifest. A formal release manifest must instead match the lockfile and TypeScript extension catalog exactly; mismatch aborts before activation.
- GitHub stable releases, not a checkout branch, are the update authority. Bootstrap and managed update read `releases/latest/download/release.json` first and derive the fixed archive/checksum URLs from that response; the normal path never requires GitHub's unauthenticated REST API. A resolved tag, manifest version/release ID, archive manifest, and checksum must identify the same immutable release. Managed update never fetches, merges, or resets a checkout and never updates global Trellis.
- `@mindfoldhq/trellis` is an exact application dependency. Project init/update invokes its absolute bundled entry; application updates never rewrite existing project `.trellis/`.
- Reconcile only selected-profile extension identities through `pi install npm:<name>@<exact-version>`. Untargeted `pi update --extensions` is forbidden.
- Optional component failures do not roll back an already verified application release; the reconciler records each failure as `degraded`, final state is written under the same maintenance lock, and offline doctor exposes the degraded ledger.
- `--json` reserves stdout for exactly one JSON document on both success and failure. During managed extension reconciliation, TypeScript redirects both Pi/npm child streams to stderr; Python captures only the TypeScript result stdout and inherits stderr live. Human diagnostics and subprocess progress must not corrupt stdout, and captured failure excerpts must be bounded. Mutating maintenance writes a bounded local success/failure log; `update --check` may read remote metadata but must not acquire the mutation lock, write state, or create a maintenance log.
- A bootstrap-provided archive/checksum/tag is SHA-verified again and copied into the managed release cache before activation so `repair` can rebuild offline. Release tag, advertised version, and archive manifest version must match.
- Confirmed uninstall removes only Dove-owned managed children and the exact Dove `bin` entry from persisted user PATH. It never removes Pi credentials/sessions/settings/extensions, project `.trellis`, development checkouts, Python, Node.js, fonts, or unrelated PATH entries. JSON mode reports `pathRemoved` without adding human output to stdout.
- Release publication is tag-only and fail-closed. Before the GitHub publish action, readiness validation requires a clean source checkout, `v<package-version>`, exact package/lock/manifest components, one valid archive root, matching embedded and external manifests, a matching checksum, parseable PowerShell bootstrap, and exactly the four documented assets.
- Tests and development E2E set a temporary `DOVE_PI_HOME`; they never modify real `%LOCALAPPDATA%\DovePi`, `~/.pi/agent`, global npm, or project state.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| SHA mismatch, unsafe zip entry, `npm ci`, or verification failure | Abort before activation; current remains unchanged |
| Current exists but required files are missing | Validate and run previous with a repair warning |
| Install path escapes `app/versions` | Reject it; never execute or delete it |
| Live maintenance lock exists | Exit with owner PID/command; do not overwrite it |
| Dead maintenance lock exists | Rotate it to a stale diagnostic before retrying |
| Maintenance lock metadata is malformed or unreadable | Fail closed with an actionable diagnostic; never guess that the owner is stale |
| `repair --verify quick/full` candidate fails its requested commands | Reject that candidate and continue the documented recovery order |
| Packaged manifest differs from generated lock/catalog metadata | Abort before activation; do not silently rewrite a formal release |
| GitHub tag/version differs from archive manifest | Reject the asset and preserve current |
| GitHub REST API is rate-limited | Continue through direct stable Release assets; do not fall back to a mutable branch |
| Python/Node is absent or too old during bootstrap | Install the reviewed exact winget package, refresh PATH, and revalidate before downloading/activating Dove |
| winget is absent or the installed runtime remains unavailable | Stop before activation and print one exact install-and-retry action |
| Optional managed extension fails | Activate app and record `degraded` |
| Latest Dove manifest declares a different Pi version | Report it during check; install/verify it in staging and switch it atomically with Dove |
| Installed Pi/TUI/Trellis package version differs from the manifest | Reject staging before activation and preserve the current release |
| Pi reports a newer upstream version outside the Dove channel | Do not self-update; wait for a Dove Release that locks and verifies that Pi version |
| Confirmed uninstall | Remove Dove-managed files and exact launcher PATH entry; preserve all Pi/user/project/runtime data |
| A documented Dove command reaches the launcher | Route it to the bundled local CLI; never pass it through as a Pi prompt/argument |
| Managed extension child emits progress | Stream it on stderr while preserving exactly one TypeScript JSON document on stdout |
| JSON maintenance command fails | Emit one parseable error document on stdout and put human details in the local log/stderr |
| `update --force` is supplied | Reject with a repair instruction; never reset a checkout |
| Uninstall lacks `--yes` | Refuse and preserve all data |

### 5. Good / Base / Bad Cases

- Good: under one maintenance lock, verify a versioned release, prepare/activate a sibling, reconcile exact Dove extension specs, persist final state, rewrite launchers, and prune.
- Base: stable matches a healthy current; repair launcher/state and skip archive/dependency work.
- Bad: release the application lock before extension reconciliation, duplicate the TypeScript catalog in Python, point the launcher at a checkout, run `git pull`, update global Trellis, or broadly update every Pi extension.

### 6. Tests Required

- Test state schema/path filtering, activation failure, zip-slip, and checksum rejection.
- Use a separate process to prove only one maintenance command owns the lock.
- Execute the PowerShell launcher with incomplete current and complete previous; assert previous runs.
- Assert same-version update performs no download and invokes no npm runner.
- Assert another maintenance process cannot interleave between activation, component reconciliation, and final state persistence.
- Assert `repair` applies `none`, `quick`, and `full` verification to existing current/previous candidates and falls through on failure.
- Assert a source checkout with no generated metadata is hydrated after `npm ci`, while a mismatched formal release manifest is rejected.
- Assert malformed lock metadata fails closed and JSON success/failure paths each produce exactly one parseable stdout document.
- Assert bootstrap assets populate a verified cache usable by offline repair, and tag/archive version mismatch is rejected.
- Assert direct manifest-first discovery succeeds without any REST API request and rejects malformed manifest, redirect-tag/version, and release-ID mismatches.
- Dot-source bootstrap helpers under an explicit test-only switch and cover compatible, missing, outdated, winget-unavailable, and post-install-still-missing prerequisites without invoking real winget or changing machine/user PATH.
- Assert release readiness rejects dirty, mismatched, unsafe, checksum-invalid, or partial four-asset bundles before the publication action.
- Assert offline doctor reports current/previous managed state and degraded managed extensions without network access.
- Invoke each documented non-maintenance command family through `dove_pi.py` and assert it reaches the Dove CLI rather than Pi; keep this routing test isolated from the real user installation and Pi state.
- Assert `dove-pi --version` reports both packaged Dove and Pi versions without launching Pi, and exact-spec extension reconciliation remains serial with bounded progress on stderr and one JSON stdout result.
- Assert update/check reports manifest-owned Pi versions and a Release update moves current/previous Pi identities together with the atomic Dove activation.
- Assert an actual installed Pi package-version mismatch fails at the dependency gate before activation.
- Assert valid V1 profile migration and corrupt-manifest fallback leave the checkout unchanged.
- Assert uninstall removes only known managed children and the exact persisted launcher PATH entry while preserving Pi data, project `.trellis/`, checkouts, third-party extensions, runtimes, unrelated PATH entries, and unknown caller-owned files.
- Validate release metadata against exact `package.json` and `package-lock.json` Pi, TUI, and Trellis versions.

### 7. Wrong vs Correct

#### Wrong

```python
subprocess.run(["git", "reset", "--hard", "origin/master"], cwd=checkout)
subprocess.run(["npm", "update", "-g", "@mindfoldhq/trellis"])
```

#### Correct

```python
with MaintenanceLock(layout.lock_path, "update"):
    prepared = transaction.prepare_source(release_root, manifest, verify="quick")
    state = transaction.activate(prepared, state, command="update")
    state.managed_extensions = list(reconcile_components(state))
    write_state(layout, state, command="update")
    write_managed_launchers(layout)
```
