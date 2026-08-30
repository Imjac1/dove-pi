# Personal Agent Extension Runtime

> **Scope:** Optional Pi extension profiles, doctor behavior, and Dove extension identity and authority.
>
> **Canonical router:** [Personal Agent Runtime Contract](./personal-agent-runtime.md)
> **Related specifications:** [personal-agent-managed-install](./personal-agent-managed-install.md), [personal-agent-request-runtime](./personal-agent-request-runtime.md)

## Scenario: Extension Profiles and Doctor

### 1. Scope / Trigger

- Trigger: reviewing or composing optional third-party Pi extensions for a Dove Pi installation.
- Scope: `src/extensions/catalog.ts` owns the package/profile manifest; `src/extensions/doctor.ts` owns offline-first compatibility checks; `src/cli.ts` and `dove_pi.py` expose the CLI boundary.
- The catalog remains the single source of truth for extension package/profile metadata. Explicit `extensions install <profile>` and the source installer may install the selected profile by delegating each package to Pi's official `pi install` command; they must not implement package resolution or settings mutation themselves. Dove Pi core, dispatch, workspace recovery, and scope policy remain authoritative.
- Profile installation is failure-tolerant by default: a failed optional package is recorded in a structured `failed` list, reported with an actionable warning, and does not prevent remaining profile entries or the Dove core from being installed. The Pi child process preserves npm optional dependencies so packages with platform-native helpers (for example `pi-lens`/`@ast-grep/cli`) can resolve their binaries. If a stale `pi-lens` install still fails, the installer removes the managed `@ast-grep/cli` and matching Windows `@ast-grep/cli-*` directories, force-reifies the native package and JS wrapper, and retries once. Callers that require all entries may opt into fail-fast behavior through the installer API.

### 2. Signatures

```typescript
inspectExtensionProfile(profile, options): Promise<ExtensionDoctorReport>;
getProfilePackages(profile): ExtensionPackageDefinition[];

type ExtensionUpdateStatus = "updated" | "unchanged" | "skipped-empty" | "skipped-disabled" | "failed";

type ExtensionInstallResult = {
  profile: ExtensionProfile;
  updated: boolean;
  updateStatus: ExtensionUpdateStatus;
  updateError?: string;
  installed: readonly string[];
  skipped: readonly string[];
  failed: readonly ExtensionInstallFailure[];
};
```

```powershell
dove-pi extensions list
dove-pi extensions show dev
dove-pi extensions doctor security
dove-pi extensions install max
```

### 3. Contracts

- Profiles are `minimal`, `dev`, `research`, `security`, and `max`; package definitions include install spec, tested version, minimum Pi/Node versions, platform, risk, conflicts, and load-order requirements.
- The combined Python installer defaults to installing the complete recommended `max` profile. `--extensions <profile>` selects another profile and `--no-extensions` skips third-party packages. Installation is explicit at the package-operation boundary and is never performed by doctor.
- `dove-pi icons setup|status|install` detects/configures the `pi-open-tui` icon mode, reports the current font state, or installs the default `DEVCOM.JetBrainsMonoNerdFont` package through winget. The installer sets `nerd` mode after a successful font install and otherwise uses `ascii`.
- `pi-open-tui` is the preferred single TUI/status authority. Profiles load `extension-settings` before `pi-open-tui`; `pi-powerbar`, `pi-powerline-footer`, and `pi-tps-status` are mutually exclusive fallback renderers and must not share a profile with `pi-open-tui`.
- `installExtensionProfile` reconciles Dove-owned identities one at a time through Pi's exact-spec `install` command. Pi 0.84.3 exposes only a single-source persistent install operation; its multi-source resolver does not persist settings, and concurrent npm mutations against the shared Pi root are unsafe. The installer therefore remains serial, reports bounded start, `[current/total]`, and completion progress on stderr, and keeps stdout for one machine-readable JSON result. `updateStatus` is `updated` when an existing Dove package was reconciled, `unchanged` when configured entries were already exact, `skipped-empty` on first install, `skipped-disabled` for `--no-extension-updates`, and `failed` when any optional entry fails; failure details remain structured and fail-open.
- Context, cumulative tokens, cache, model/provider, TPS, TTFT, duration, stalls, cost, Git, and extension-status rendering belong to the selected TUI extension. Dove publishes only compact mode/operation text (`Dove · Fast|◆ Standard|✦ Ultra · Ready|Running`) plus the current Pi thinking level through `ctx.ui.setStatus`; it must not implement a duplicate telemetry collector or footer renderer. Dove accepts only `fast`, `standard`, and `ultra`; Pi's native thinking level `max` and the extension installation profile `max` remain separate concepts. Changing Dove mode does not silently change Pi thinking; `/status` and `agent_doctor` show both values.
- Cache diagnostics are a read-only projection of Pi session entries, not a second accounting system. `/status full` and `agent_doctor` may show both the latest-request cache hit rate and the cumulative session rate, plus cache read/write totals and a best-effort miss reason (`warmup`, `model-change`, `idle`, or `prefix-change`). For custom OpenRouter provider IDs, the adapter may add `x-session-affinity` from the current Pi session unless `DOVE_PI_DISABLE_SESSION_AFFINITY=1` is set; existing provider headers take precedence.
- The last effective Pi thinking level is persisted through Pi's official `defaultThinkingLevel` setting when `thinking_level_select` fires, so a new session restores the user's previous level without a parallel configuration format.
- The preferred renderer refreshes telemetry at approximately 1 Hz; critical Dove state transitions may update immediately. Keyboard interaction remains available through Dove's single execution-policy cycle shortcut (`Ctrl+Alt+M`), Pi's native model picker (`Ctrl+P`), native exit controls (`Ctrl+D`/`/quit`), and Dove's `/status` command.
- Missing packages are warnings; Pi/Node incompatibility, invalid load order, and conflicting authority packages are errors.
- Doctor checks local settings and executables without requiring npm/network access. It must not rewrite `~/.pi/agent/settings.json` or silently install software.
- Third-party sub-agent, background-task, plan, workspace, or security packages must remain optional when they overlap a Dove Pi authority contract.
- The Dove `auto` tool profile may use the active normalized Trellis task (status and bounded file-path preview) as an intent hint in addition to the current prompt. It must not use task titles alone as a broad trigger, and Ultra must not force all tools or unsafe parallel dispatch.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Pi settings missing or malformed | Report a warning and continue offline checks |
| Extension is not configured | Report `not-configured` warning |
| Minimum Pi/Node version not met | Report an error |
| Required load order is wrong | Report a `load-order` error |
| Profile contains conflicting authorities | Report a `profile-conflict` error |
| Optional executable is missing | Report a warning; never install it implicitly |

### 5. Tests Required

- Assert profile order places extension-settings before pi-open-tui and no default profile contains another footer/TUI authority.
- Assert missing package configuration produces warnings without network calls.
- Assert invalid load order and conflicting max authorities are detected.

## Scenario: Dove Extension Identity and Authority Synchronization

### 1. Scope / Trigger
- Trigger: launching Pi where managed and project-local `.pi/extensions/personal-agent.ts` entries may both be discovered, or publishing/inspecting a managed release.
- Scope: `src/core/extension-identity.ts`, `src/pi-adapter/extension.ts`, `dove_pi.py`, release manifest/installer/status projections.

### 2. Signatures
- `selectDoveExtension({ managed?, project?, explicitProject?, projectTrusted? }) -> DoveExtensionSelection`.
- `claimDoveRegistration(pi, identity) -> boolean` (one process-global registration claim).
- Release field `doveExtension: { extensionId, version, implementationDigest, entryPath, contractVersion }` is additive; legacy manifests omit it and decode as unknown.

### 3. Contracts
- Launcher always passes the managed extension with `-e` and sets `DOVE_PI_EXTENSION_GUARD=1`; ordinary Pi discovery remains enabled for unrelated extensions.
- `DOVE_PI_PROJECT_EXTENSION` is accepted only with `DOVE_PI_TRUST_PROJECT_EXTENSION=1`; startup selection is read-only and never writes a checkout.
- Precedence is trusted explicit project override > managed explicit > project auto-discovery. Duplicate same-identity wrappers are suppressed; divergent identities emit diagnostics and managed remains authoritative by default.

### 4. Validation & Error Matrix
- Missing/untrusted explicit project path -> launch error; managed checkout is not suppressed.
- Invalid release Dove identity (wrong id/version, missing digest/entry path) -> release validation error.
- Legacy manifest without `doveExtension` -> runnable with `unknown` identity state.
- Stale Pi owner after reload -> replace the process-global claim; live duplicate -> suppress only the duplicate Dove wrapper.

### 5. Good/Base/Bad Cases
- Good: managed `-e` loads first, a project wrapper is recognized as a duplicate, and third-party project plugins still load.
- Base: no project Dove entry; managed identity is selected and status reports `managed_only`.
- Bad: filename existence alone disables managed loading, or an untrusted project copy silently wins.

### 6. Tests Required
- Unit-test path canonicalization, version/digest drift, selection precedence, and stale-claim replacement.
- Installer/launcher tests assert managed `-e` is unconditional, explicit override fails closed, and unrelated plugins remain untouched.
- Release/readiness/status tests assert additive identity decoding, strict validation, and legacy `unknown` behavior.

### 7. Wrong vs Correct
#### Wrong
```python
if not (Path.cwd() / ".pi" / "extensions" / "personal-agent.ts").exists():
    pi_command += ["-e", str(EXTENSION)]
```
#### Correct
```python
pi_command += ["-e", str(EXTENSION)]
launch_env["DOVE_PI_EXTENSION_GUARD"] = "1"
```

The loader still discovers normal Pi extensions; the adapter claim resolves only the Dove authority conflict.

