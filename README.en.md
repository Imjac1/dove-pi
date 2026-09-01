# Dove Pi

[中文](./README.md)

Dove Pi is a Windows-focused personal coding agent built on
[Pi](https://github.com/badlogic/pi-mono). It keeps Pi's open model and extension ecosystem
while adding goal continuity, compact project memory,
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

Install with:

```powershell
irm https://github.com/Imjac1/dove-pi/releases/latest/download/install.ps1 | iex
```

To avoid changing PATH/fonts or to skip optional extensions, download the script and pass advanced switches:

```powershell
irm https://github.com/Imjac1/dove-pi/releases/latest/download/install.ps1 -OutFile .\install.ps1
.\install.ps1 -NoPath -NoFont -NoExtensions
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

Dove does not prune tools per request in Auto mode. Pi and installed Pi extensions decide which
tools the model can use; Dove only observes the final schema for cache and conflict diagnostics.
Request classification affects context, goal continuation, and budgets, not
tool permission.

### 3. Choose a mode when needed

Inside Dove Pi:

```text
/mode fast
/mode standard
/mode ultra

/dove-mode auto       choose context mode automatically
/dove-mode chat       isolated conversation without project-task context
/dove-mode work       retain project context and formalize only complex work
/dove-mode status     show the current context mode
```

- `fast`: small, clear work with low overhead.
- `standard`: the everyday default.
- `ultra`: complex projects, long analysis, and intensive execution.

`Ultra` is a runtime policy. `max` is an installed extension profile; they are unrelated names.

## Dove Native Workflow

Ordinary chat and small coding requests execute directly. There is no project initialization, task
creation, or phase approval prerequisite. Explicit planning, architecture, cross-module, or
multi-file requests silently establish a formal Dove task. `.dove/state.json` keeps the compact
index, while durable artifacts live under `.dove/tasks/<task-id>/`.

You may explicitly initialize or inspect that state:

```powershell
dove-pi project init
dove-pi project doctor
```

Initialization creates only Dove's compact index and installs no dependency or Trellis script.
Formal tasks generate PRD, design, implementation, and acceptance artifacts on demand. They support
context recovery and verification; they are not a gate before coding.

You can then say:

```text
Continue the current project task.
```

Dove reads the native current goal directly. Existing `.trellis` projects remain available as
read-only compatibility data for unfinished tasks, specs, and journals. Dove never executes
`.trellis/scripts/task.py`, requires no Trellis npm package, and never modifies or deletes the
legacy directory. Continuing a legacy task imports only the useful goal metadata into `.dove`.

## Pi and Dove

| Component | Responsibility |
| --- | --- |
| Pi | Models, sessions, TUI, and native tool hosting |
| Dove | Request context, goal continuation, loop control, diagnostics, and execution records |
| Dove Native Workflow | Compact state plus formal PRD, design, implementation, acceptance, and evidence artifacts under `.dove/` |
| Legacy reader | Read-only projection of existing `.trellis` tasks, specs, and journals |

Pi is the only tool and execution authority. Dove adds no permission layer; it manages context,
goal continuity, no-progress loops, and efficiency diagnostics.

## Command reference

### Inside Dove Pi

```text
/status                 show compact status
/status full            show full diagnostics
/project                show project status
/project init           explicitly create native project state (normally unnecessary)
/task ...               optionally record, finish, or archive a Dove goal
/memory [query]         search project memory
/capabilities           list Dove capabilities
/dove-tools auto        return tool management to Pi
/dove-tools core        explicitly use the compact read-only compatibility set
/dove-tools full        explicitly enable every installed tool
/dove-thinking status   inspect thinking policy
/dove-mode status       show the context mode
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
- project `.dove/` and legacy `.trellis/` directories;
- source code, Git branches, and uncommitted changes.
- Python, Node.js, fonts, and Pi extensions installed by the user.

Ordinary sessions do not create `.agent-data/execution.jsonl` inside source repositories.

## Advanced interfaces

Dove Capability Protocol lets CLI, JSON-RPC, MCP, and Pi share one capability format and
execution ledger:

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

Inside a Pi session, the Pi tool call is the host execution decision and Dove adds no second
confirmation. Local CLI calls still require `--approve`, and RPC/MCP requests cannot grant
themselves permission.

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

### The project has no Dove state

Nothing is required. Ordinary work executes directly and creates compact state silently when
needed. Run `dove-pi project init` only to create an empty state in advance.
