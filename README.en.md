# Dove Pi

Dove Pi is a Windows-first personal agent runtime built on [Pi](https://github.com/badlogic/pi-mono). It keeps Pi's open extension model while adding sensible defaults, project context, Trellis project management, curated extensions, diagnostics, and recoverable updates.

## Shortest path

### 1. Install

Requires Windows and PowerShell 5.1+. End users do not need Git or a source checkout. The installer preserves compatible Python 3.10+ and Node.js 22.19+ runtimes; when either is missing or too old, it installs `Python.Python.3.12` or `OpenJS.NodeJS.LTS` through winget, refreshes the current process PATH, and continues.

```powershell
irm https://github.com/Imjac1/dove-pi/releases/latest/download/install.ps1 | iex
```

To inspect the bootstrap first:

```powershell
Invoke-WebRequest https://github.com/Imjac1/dove-pi/releases/latest/download/install.ps1 -OutFile .\install-dove-pi.ps1
Get-Content .\install-dove-pi.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-dove-pi.ps1
```

The installer selects the full `max` extension profile and installs the application under `%LOCALAPPDATA%\DovePi`. It reads the stable Release `release.json` directly without depending on GitHub REST API quota, verifies the zip SHA-256 and manifest identity, runs `npm ci` plus quick verification, and activates only after those checks pass. If winget is unavailable, installation stops before Dove activation and prints the exact runtime install command and retry instruction.

After installation, verify the Dove and underlying Pi versions plus overall health:

```powershell
dove-pi --version
dove-pi doctor
```

Before the first stable Release is published, the `releases/latest` URL returns 404; do not substitute a `master` branch archive. The same command above becomes the supported entry point after publication.

### 2. Enter your project

```powershell
cd C:\path\to\your-project
dove-pi
```

Dove Pi treats the directory where you run the command as the target project. Your project never needs to live inside Dove Pi's installation directory.

### 3. Ask for the work

Conversation, lookup, project work, and execution requests automatically select suitable context and tools. Common modes are:

```text
/mode fast
/mode standard
/mode ultra
```

`Ultra` is an execution/reasoning policy. `max` is an installed extension profile; the two are independent.

## How Trellis works

Dove Pi bundles a tested, release-locked Trellis CLI. It does not depend on a global `trellis` installation and does not silently update Trellis during ordinary startup.

Run these commands inside a project:

```powershell
dove-pi project init
dove-pi project doctor
dove-pi project update
```

- `project init` creates `.trellis/` in the current directory and installs the shared skills for that project.
- `project update` refreshes that project's Trellis templates only when explicitly requested.
- Updating Dove Pi never rewrites existing project `.trellis/` directories.
- After initialization, Pi can invoke `/skill:trellis-start`, `/skill:trellis-brainstorm`, `/skill:trellis-continue`, and `/skill:trellis-check`; Codex uses the corresponding `$trellis-start` syntax. The host may also select a skill automatically when its trigger applies.
- You can also say “continue the current project task.” Dove reads the structured Project Provider status once: it returns the current task, selects the only in-progress candidate, asks you to choose among multiple candidates, or reports that none exists. It does not guess Trellis private runtime paths.

You normally do not run `trellis init` yourself or install Trellis globally.

## Agent, Pi, Dove, and Trellis

| Layer | Ownership |
| --- | --- |
| Pi | Model, TUI, sessions, and native tool host |
| Dove | Request policy, capabilities, approvals, tool loading, evidence, and execution records |
| Project Provider | Project discovery and normalized context boundary |
| Trellis | Tasks, specs, workflow, memory, and journals under `.trellis/` |

Trellis is authoritative for project data. Dove does not maintain a second task/spec database or mutate `.trellis/` directly from core. Dove execution records may correlate with Trellis task IDs, but the two are not collapsed into one state store. Future Trellis updates remain owned by its explicit `project update`; Dove adapts through the public Project Provider contract and does not fork or patch Trellis.

Useful Pi commands:

```text
/status
/status full
/project
/project doctor
/project init
/project update
/memory [query]
/capabilities
/mode fast|standard|ultra
/dove-thinking auto|lock <level>|off|status
/dove-tools auto|core|full|reset
```

`/thinking` remains Pi's native command. Dove's automatic/locked policy uses `/dove-thinking` and does not shadow the host. Task creation, completion, and archival require explicit intent and confirmation; ordinary chat does not create a Trellis task.

`/dove-tools auto` opens tools in intent-owned tiers from the same request plan: ordinary Chat has zero tools, Lookup gets read/search and read-only web retrieval, Project Work adds read-only code diagnostics and planning, and only Execution receives shell, edit, task, workspace mutation, browser automation, generic MCP, and background tools. At each user-request boundary, Auto switches to exactly that request's set and keeps it stable through its tool-call continuations; the next request narrows it again, so Execution authority never remains on a later Chat/Lookup. Changing tiers changes the tool prefix and can sacrifice some provider-cache reuse, but preserves per-request least authority and lowers schema tokens. Consecutive same-tier requests stay stable, and temporary third-party activations are never absorbed.

## Interoperability interfaces

Dove Capability Protocol `1.0.0` defines a host-neutral contract for capability versions, parameter schemas, platforms, side effects, idempotency, lifecycle, correlation IDs, and evidence references. Pi, CLI/JSON-RPC, and MCP share the same Core registry, invocation service, and ledger:

```powershell
dove-pi capability list
dove-pi capability run workspace.inspect --args='{"path":"package.json"}'
# Side-effecting capabilities require explicit local authorization:
dove-pi capability run dev.project_test --approve
```

Local JSON-RPC is bounded JSONL over stdio and exposes only `capabilities/list` and `capabilities/invoke`:

```powershell
'{"jsonrpc":"2.0","id":1,"method":"capabilities/list"}' | dove-pi rpc
'{"jsonrpc":"2.0","id":2,"method":"capabilities/invoke","params":{"protocolVersion":"1.0.0","capability":{"name":"workspace.inspect"},"arguments":{"path":"package.json"},"context":{"cwd":"C:\\path\\to\\project","mode":"standard","taskId":"rpc-session","stepId":"inspect"},"correlation":{"requestId":"rpc-1"},"approval":"not_required"}}' | dove-pi rpc
```

An MCP client can configure the stdio server as `{"command":"dove-pi","args":["mcp"]}` and call `dove_capabilities`, `dove_context`, and `dove_invoke`. `dove_context` projects Trellis, `AGENTS.md`, `CLAUDE.md`, Agent Skills, and MCP resources index-first; conflicting authorities stay separately labeled instead of being silently merged.

Authorization is fail-closed: Pi uses its native confirmation UI, CLI trusts only a local `--approve`, and RPC/MCP callers cannot self-authorize through request payloads. Pi-specific TUI, browser, planning, diagnostics, and background-work features reuse reviewed plugins first; Dove projects their availability and does not duplicate them as Core executors.

## Daily maintenance

```powershell
dove-pi update
dove-pi repair
dove-pi rollback
dove-pi cache audit --min-requests=2
dove-pi token audit --since=1h
```

- `update` checks the direct stable GitHub Release manifest without relying on the GitHub REST API. When the version is unchanged and the current release is healthy, it does not download the zip or run `npm ci`; it only repairs the launcher and reconciles Dove-managed extensions.
- `repair` checks the current release and launcher. If current is damaged, it first recovers a runnable previous release, then rebuilds from stable when needed.
- `rollback` atomically switches the application to previous. Pi extensions live in user state, so Dove does not pretend they roll back atomically with the app.
- `cache audit` and `token audit` are finite local diagnostics; they do not accidentally start an interactive Pi session.

Read-only update checks:

```powershell
dove-pi update --check
dove-pi update --check --json
```

With `--json`, stdout is one JSON document and diagnostics go to stderr. Dove itself does not query GitHub, npm, or winget during startup, `doctor`, or ordinary chat, but Pi may run its own version/package checks. Disable them explicitly for one launch when needed:

```powershell
dove-pi --skip-version-check  # skip only Pi's version check
dove-pi --offline             # skip all Pi startup network/package checks
```

Both controls are off by default, preserve normal online update notices, and do not disable a later explicit `dove-pi update`.

## Managed boundary and recovery

Managed layout:

```text
%LOCALAPPDATA%\DovePi\
  bin\
  app\versions\<release-id>\
  cache\releases\
  staging\
  state\install.json
  logs\
```

The stable launcher only runs path-validated releases under `app\versions`. If current is damaged while previous is complete, it falls back to previous and asks you to run `dove-pi repair`.

The following data is outside the managed application and is preserved by install, update, rollback, and the default uninstall:

- credentials, models, sessions, settings, and user extensions under `~/.pi/agent`;
- workspace-isolated Dove runtime state and execution ledgers under `~/.pi/agent/dove/workspaces/<hash>`; `DOVE_PI_STATE_DIR` remains an explicit override;
- every project's `.trellis/` directory;
- source checkouts and uncommitted changes;
- user-installed third-party Pi extensions and global Trellis installations.

Ordinary sessions no longer create `.agent-data/execution.jsonl` inside source repositories. Known legacy Dove state files are copied once to the new location without deleting the source or continuing dual writes. Transactional workspace snapshots remain explicit capability artifacts rather than ordinary session state.

Remove the managed application:

```powershell
dove-pi uninstall --yes
```

## Extension management

The default profile is `max`. Available profiles are `minimal`, `dev`, `research`, `security`, and `max`.

```powershell
python .\dove_pi.py install --profile dev
python .\dove_pi.py install --no-extensions
python .\dove_pi.py install --no-extension-updates
```

Dove reconciles only package identities it owns in the selected profile, using Pi's official exact-spec installation:

```text
pi install npm:<package>@<exact-version>
```

It never runs an untargeted `pi update --extensions`, so user-installed packages are not upgraded or rewritten as a side effect. Optional extension failures are recorded as degraded and the remaining components continue; required application verification failures prevent activation.

## Migrating from the checkout-backed installer

Run once from the old source checkout:

```powershell
python .\dove_pi.py install
```

This compatibility command now copies and verifies the source into an independent managed version. It no longer points the global launcher at the checkout. A valid profile from the old `.dove/manifest.json` is imported, while the checkout's files, branch, commits, and uncommitted changes remain untouched.

## Advanced options

```powershell
dove-pi update --verify quick
dove-pi update --verify full
dove-pi update --no-extensions
dove-pi repair --verify full --json
```

- `quick`: typecheck plus Pi smoke; the default.
- `full`: quick checks plus the full test suite.
- `none`: intended only for controlled diagnostics or development.
- V2 does not support `update --force`. Use `repair` for a damaged install; Dove never runs `git reset --hard` against your checkout.

For isolated tests or development, set a temporary managed root:

```powershell
$env:DOVE_PI_HOME = Join-Path $env:TEMP 'DovePi-test'
python .\dove_pi.py install --verify none --no-extensions --no-font --no-path
```

## Development and verification

```powershell
npm ci
npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
npm run release:check -- --help
```

Publishing is triggered only by a `v*` tag that exactly matches `package.json`. Before the publish action, CI verifies a clean checkout, manifest, archive shape, SHA-256, bootstrap syntax, and exactly four assets: `dove-pi-windows.zip`, its checksum, `install.ps1`, and `release.json`. Ordinary pushes do not publish or modify user installations; publisher code signing is not yet included.

## Troubleshooting

- `dove-pi` is not found: open a new terminal or run `%LOCALAPPDATA%\DovePi\bin\dove-pi.cmd` directly.
- Python, Node.js, or npm is missing/old: rerun the public bootstrap at the top; it preserves compatible runtimes and installs only missing prerequisites.
- Current is damaged: run `dove-pi repair`; the launcher can fall back when previous is complete.
- An extension is degraded: close Pi/Node processes that may lock native binaries, then run `dove-pi repair`.
- The project has no Trellis state: run `dove-pi project init` at its root.
- You need every extension tool: use `/dove-tools full` inside Pi. Normal turns load tools by intent to reduce prompt tokens.
