# Dove Pi

[中文](./README.md)

Dove Pi is a Windows-focused personal coding agent built on
[Pi](https://github.com/badlogic/pi-mono). It keeps Pi's open model and extension ecosystem
while adding practical defaults, request-scoped tools, project context, Trellis integration,
diagnostics, and recoverable updates.

In short: run `dove-pi` from your own project directory, then describe the work as you would to
a developer on your team.

## Who it is for

- You want to choose your own model, provider, and Pi extensions.
- You work on long-running Windows projects that need tasks, specs, and context continuity.
- You do not want to assemble and configure a large plugin stack by hand.
- You want repair and rollback paths when an update fails.

## Installation

### Option 1: install from source (available now)

Requirements:

- Windows 10 or 11;
- PowerShell 5.1 or newer;
- Python 3.10 or newer;
- Node.js 22.19 or newer;
- Git.

```powershell
git clone https://github.com/Imjac1/dove-pi.git
cd dove-pi
python .\dove_pi.py install
```

The installer installs dependencies, runs quick verification, selects the full `max` extension
profile by default, and creates a managed application under:

```text
$env:LOCALAPPDATA\DovePi
```

Open a new terminal after installation, then verify it:

```powershell
dove-pi --version
dove-pi doctor
```

To skip optional extensions:

```powershell
python .\dove_pi.py install --no-extensions
```

### Option 2: one-line GitHub Release install

After the first GitHub Release is published, install with:

```powershell
irm https://github.com/Imjac1/dove-pi/releases/latest/download/install.ps1 | iex
```

To inspect the script first:

```powershell
Invoke-WebRequest https://github.com/Imjac1/dove-pi/releases/latest/download/install.ps1 -OutFile .\install-dove-pi.ps1
Get-Content .\install-dove-pi.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-dove-pi.ps1
```

If the URL returns `404`, the repository has not published its first Release yet. Use the source
installation above; do not treat a `master` branch archive as a release package.

The Release installer reuses compatible Python and Node.js runtimes. If either is missing or too
old, it installs the runtime through `winget` (which requires Microsoft App Installer). It also
verifies the download SHA-256 and activates a release only after validation succeeds.

When installation finishes, open a new terminal and run `dove-pi --version` and `dove-pi doctor`.
Then continue with the three steps below in your own project.

## Start in three steps

### 1. Enter your project

```powershell
cd C:\path\to\your-project
dove-pi
```

Dove treats the directory where you launch it as the target project. Your code does not need to
live inside the Dove installation directory.

If this is your first run and no model is configured, enter these commands inside Dove Pi:

```text
/login    choose a provider and sign in or enter an API key
/model    choose the model to use
```

These are native Pi commands. Credentials stay in Pi's user directory and are not written to the
current project.

### 2. Describe the work

```text
Explain this project's entry point and main modules.
Fix the failing tests and verify the result.
Continue the current project task.
```

Dove selects tools for each request:

- Conversation: no tools.
- Inspection and analysis: read/search tools only.
- Project planning: read-only project context.
- Explicit execution: shell and editing tools, plus browser, MCP, or background tools when the
  request specifically calls for them.

You normally do not choose tools first, and execution authority does not leak into the next
ordinary conversation.

### 3. Choose a mode when needed

Inside Dove Pi:

```text
/mode fast
/mode standard
/mode ultra
```

- `fast`: small, clear work with low overhead.
- `standard`: the everyday default.
- `ultra`: complex projects, long analysis, and intensive execution.

`Ultra` is a runtime policy. `max` is an installed extension profile; they are unrelated names.

## Trellis: optional project management

Ordinary chat and coding do not require Trellis. For long-running tasks, PRDs, project specs,
journals, or cross-session continuation, run this at the project root:

```powershell
dove-pi project init
dove-pi project doctor
```

This creates `.trellis/` in the current project. You normally do not install Trellis globally or
run `trellis init` first.

You can then say:

```text
Continue the current project task.
```

Dove resolves the current task or the only continuable candidate through the public Project
Provider state. It does not scan Trellis private runtime directories, and a continuation request
does not silently create, complete, or archive a task.

To invoke a workflow skill explicitly:

- Pi: `/skill:trellis-start`, `/skill:trellis-continue`, `/skill:trellis-check`.
- Codex: `$trellis-start`, `$trellis-continue`, `$trellis-check`.

Updating Trellis templates in the current project is always explicit:

```powershell
dove-pi project update
```

Updating Dove itself never silently rewrites a project's `.trellis/` directory.

## Pi, Dove, and Trellis

| Component | Responsibility |
| --- | --- |
| Pi | Models, sessions, TUI, and native tool hosting |
| Dove | Request policy, tool loading, capabilities, approvals, diagnostics, and execution records |
| Project Provider | Normalizes external project managers into one context boundary |
| Trellis | Tasks, specs, workflow, memory, and journals under `.trellis/` |

Trellis owns project data; Dove owns execution data. Dove does not copy Trellis into a second task
database or embed Trellis source in its core. They integrate through public interfaces and can be
updated independently.

## Command reference

### Inside Dove Pi

```text
/status                 show compact status
/status full            show full diagnostics
/project                show project status
/project init           initialize Trellis
/project update         update Trellis templates for this project
/memory [query]         search project memory
/capabilities           list Dove capabilities
/dove-tools auto        restore per-request automatic tools
/dove-tools full        temporarily enable every installed tool
/dove-thinking status   inspect thinking policy
```

`/thinking` remains Pi's native command. Dove uses `/dove-thinking` and does not shadow it.

### Maintain the installation

```powershell
dove-pi update --check   # check and report current/latest Pi versions
dove-pi update           # atomically update Dove and its locked Pi runtime
dove-pi repair           # repair current or recover previous
dove-pi rollback         # switch to the previous app release
dove-pi uninstall --yes  # remove Dove, preserve user/project data
```

Pi is a release-locked Dove component, not a globally self-updated dependency. When a new Dove
Release declares a newer Pi version, `dove-pi update` installs and verifies that exact version in
staging and switches Dove and Pi together only after success. The update output reports the old and
new Pi versions. Uninstall also removes Dove's persisted launcher PATH entry; new terminals see the
change.

Before the first Release, update a source installation with:

```powershell
git pull
python .\dove_pi.py install
```

### Startup network controls

```powershell
dove-pi --offline             # skip Pi startup network/package checks for this launch
```

Managed launches suppress Pi's own update prompt because an independent Pi update would break Dove
Release identity and rollback. Use `dove-pi update`; the compatibility flag `--skip-version-check`
remains accepted. `--offline` does not disable a later explicit install or update command.

## Extension profiles

The default profile is `max`. Other profiles are `minimal`, `dev`, `research`, and `security`.

```powershell
python .\dove_pi.py install --profile minimal
python .\dove_pi.py install --profile dev
python .\dove_pi.py install --no-extension-updates
```

Dove reconciles only extension identities and exact versions it owns. It never runs an untargeted
`pi update --extensions`, so user-installed Pi extensions are not upgraded as a side effect.
Optional failures are reported as `degraded` rather than being presented as healthy.

## Where data lives

Managed application files:

```text
$env:LOCALAPPDATA\DovePi\
  bin\
  app\versions\
  cache\releases\
  state\install.json
  logs\
```

Install, update, rollback, and uninstall preserve:

- credentials, models, sessions, settings, and user extensions under `~/.pi/agent`;
- workspace-scoped Dove state under `~/.pi/agent/dove/workspaces/<hash>`;
- project `.trellis/` directories;
- source code, Git branches, and uncommitted changes.
- Python, Node.js, fonts, and Pi extensions installed by the user.

Ordinary sessions do not create `.agent-data/execution.jsonl` inside source repositories.

## Advanced interfaces

Dove Capability Protocol lets CLI, JSON-RPC, MCP, and Pi share one capability and approval
boundary:

```powershell
dove-pi capability list
dove-pi capability run workspace.inspect --args='{"path":"package.json"}'
dove-pi capability run dev.project_test --approve
dove-pi rpc
dove-pi mcp
```

MCP stdio configuration:

```json
{"command":"dove-pi","args":["mcp"]}
```

Side effects fail closed: Pi uses native confirmation, CLI requires local `--approve`, and RPC/MCP
requests cannot grant themselves permission.

## Development and verification

```powershell
npm ci
npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
```

A formal Release is triggered only by a `v*` tag matching `package.json`. An ordinary push does not
publish an installer.

## Troubleshooting

### `dove-pi` is not found

Open a new terminal, or run:

```powershell
& "$env:LOCALAPPDATA\DovePi\bin\dove-pi.cmd"
```

### The one-line installer returns 404

The repository has not published its first GitHub Release. Use the source installation for now.

### Python, Node.js, or npm is too old

For source installs, install Python 3.10+ and Node.js 22.19+ first. The Release bootstrap can install
missing runtimes through winget when available.

### An extension is degraded

Close Pi/Node processes that may lock a native binary, then run:

```powershell
dove-pi repair
```

### The project has no Trellis state

```powershell
dove-pi project init
```
