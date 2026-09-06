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

For networks that require a proxy, pass an HTTP/HTTPS proxy explicitly. Without `-Proxy`, the
installer checks `HTTPS_PROXY`, `HTTP_PROXY`, then `ALL_PROXY`:

```powershell
.\install.ps1 -Proxy http://127.0.0.1:10808
```

To inspect the script first:

```powershell
Invoke-WebRequest https://github.com/Imjac1/dove-pi/releases/latest/download/install.ps1 -OutFile .\install-dove-pi.ps1
Get-Content .\install-dove-pi.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-dove-pi.ps1
```

If the URL returns `404`, check the network, repository address, and whether that Release asset is
still available. You can also use the source installation above; do not treat a `master` branch
archive as a release package.

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

### Subagent (experimental, read-only)

Dove Pi exposes an explicit `agent_subagent` tool and `/subagent` status command. It starts one
isolated Pi child for reading, searching, and understanding the current project. The child gets
only `read`, `grep`, `find`, and `ls`; it cannot write files, run shell commands, use the network,
or delegate recursively. Ordinary requests never create a child automatically.

Enable it only with an explicit child entrypoint (prefer the managed Node executable and Pi CLI):

```powershell
$env:DOVE_PI_SUBAGENT_EXECUTABLE = (Get-Command node).Source
$env:DOVE_PI_SUBAGENT_PREFIX_ARGS = '["C:\\path\\to\\pi-cli.js"]'
```

When configuration is absent, the executable is unavailable, or the child fails, `/subagent`
returns a diagnostic. It never fabricates success and never silently changes an explicit
subagent request into ordinary inline work. Automatic dispatch integration is still under
verification; the stable contract does not include writable children, worktree merging, nested
orchestration, or hard token/time ceilings.

`pi-background-tasks` remains available through Pi's explicit `bg_run`, `bg_delegate`, and related
tools. Pi's extension API does not let Dove call another extension's private executor, so Dove does
not claim that those tools are already transparently controlled by the Core subagent provider.

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

## Full workflow and a real-user smoke check

Every invocation follows one boundary: the launcher handles `--version`, maintenance commands,
and local CLI families first; only unmatched arguments start Pi. The CLI runs in the current
working directory, Native state lives in project `.dove/`, and Pi credentials/sessions remain in
the Pi user directory. For stdio `rpc`/`mcp`, stdout is reserved for protocol frames and diagnostics
go to stderr.

Interactive launches go directly to the release-locked Pi Node runtime and skip the Python
installer layer. Install, update, repair, and diagnostic commands still use Python. This removes
one process hop and avoids installer dependency loading without changing Pi tools, context, or
request policy.

Run this black-box check in a temporary project, never against production source:

```powershell
$env:DOVE_PI_HOME = Join-Path $env:TEMP "dove-pi-audit-home"
$env:PI_CODING_AGENT_DIR = Join-Path $env:TEMP "dove-pi-audit-pi"
New-Item -ItemType Directory $env:PI_CODING_AGENT_DIR -Force | Out-Null
mkdir (Join-Path $env:TEMP "dove-pi-audit-project") -Force | Out-Null
cd (Join-Path $env:TEMP "dove-pi-audit-project")
dove-pi --version
dove-pi --offline doctor
dove-pi project init
dove-pi task create "Smoke task"
dove-pi task status
dove-pi session record --title "Smoke" --test "not run"
dove-pi capability list
dove-pi web status
```

`--offline` and `--skip-version-check` may prefix a known local CLI command; they never turn the
CLI words into a Pi prompt. `task verify` checks artifact structure and planning fields only: it
does not run tests or claim acceptance. Formal work freezes acceptance criteria, records evidence,
and is finished/archived explicitly.

An explicit task selector that is missing or ambiguous returns a non-zero error, and unknown
task/session options are rejected instead of being ignored. After finishing the current task,
Dove promotes the only remaining active task to `current`; when several remain, choose one
explicitly.

If a session appears stuck at `pending` or looks as if the model stopped by itself, run
`dove-pi doctor` and `/status full`: doctor shows the managed release actually executing and
whether it differs from the checkout (`sourceDrift=drifted`); full status breaks down mode,
thinking, provider rounds, read-only budget, and policy termination reason. After a source fix,
run `dove-pi update` or `python .\\dove_pi.py install` before expecting the global launcher to use
it; Dove never rewrites the managed installation automatically.

For failures, run `dove-pi doctor`, then let `dove-pi repair` try current, previous, the exact-identity
cache, and the stable Release in that order. A failed update leaves current untouched. `rollback`
switches only to previous; `uninstall --yes` removes only Dove-managed files and its exact PATH entry.

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

### How strategy takes effect

The controls have separate roles: `/mode` changes execution intensity, `/dove-mode` changes
project-context organization, `/dove-thinking` changes thinking policy, and `/dove-tools` changes
only an explicit compatibility profile. In Auto mode, Pi and installed extensions still own tool
authority. Use `/status full` or `agent_doctor` to inspect one effective snapshot containing intent/
lane, policy sources, active tool count, provider/read-only budgets, context and cache observations,
and the latest terminal cause. The snapshot is diagnostic evidence; it does not add permissions or
change existing ceilings. The `hardStop` field in the read-only budget is retained for compatibility
and telemetry as a historical request-count advisory; it cannot terminate a read that produces a
new observation. Only semantic no-progress guards, such as unchanged observations, repeated
failures, or confirmation loops, terminate tool calls.

Dove does not assign Fast, Standard, or Ultra a fixed total context budget, and it does not
reserve a fixed percentage of the model window. When Pi reports the active model window and
usage, Dove may derive the actual remaining capacity; the final complete payload is still
checked by the provider-window gate. Missing window or usage stays `unknown` instead of being
turned into a guessed small budget. Dove context is omitted only when that final check cannot
fit the payload.

### Terminal causes and recovery

Pi may still render the generic `Operation aborted`, but Dove preserves a specific terminal object:

| Cause | Meaning | Next action |
| --- | --- | --- |
| `provider-authorization-denied` | Provider authorization or API key failed | Check `/login` or provider credentials, then retry |
| `model-budget-rejected` | The request did not fit the model context | Reduce context or choose another model |
| `provider-round-budget` | Provider-round observation threshold reached | Inspect `/status full`; the threshold does not abort by itself |
| `progress-*` | A tool loop repeated or stalled | Use existing evidence and issue a narrower query |
| `user-cancelled` | The user cancelled the request | Submit a new request when ready |
| `startup-conflict` / `superseded` | Another runtime took over the session | Close the old runtime or continue in a new session |

Without a UI, run `dove-pi doctor` or query `diagnostics/status` for the same structured cause and
next action. Resource, token, and cache values are observation-only; reaching the historical
read-only request count and provider-round thresholds are advisory and do not abort by themselves. Repeated-read progress guards can still end a stalled loop as described above.

To replay an isolated real RPC path, run
`node scripts/real-dove-blackbox.mjs --launcher source --provider faux --cwd <temporary-project> --output <temporary-output>`.
The command uses only a temporary project and test provider and writes redacted evidence. A
`compacted` long-document observation describes per-document extraction; it is not a Dove-wide
context ceiling.

The black-box driver models one real Pi session. Each run gets a private project copy, Dove state,
Pi session, and provider-capture root, so concurrent cases cannot share ledgers even when they use
the same output parent. The legacy `--prompt` form remains a one-turn scenario; use
`--scenario <json>` for ordered user steps:

```json
{"steps":[
  {"kind":"prompt","message":"Read the project and audit only"},
  {"kind":"prompt","message":"/mode fast"},
  {"kind":"prompt","message":"/dove-thinking off"},
  {"kind":"prompt","message":"/dove-tools core"},
  {"kind":"prompt","message":"/dove-tools auto"},
  {"kind":"follow_up","message":"Continue the audit and give acceptance criteria"},
  {"kind":"state"},
  {"kind":"stats"}
]}
```

Steps are sent only after the preceding step settles. `prompt` can be a model request or a real
slash-command input; `follow_up` keeps the same session while starting a new logical turn. After
the final settle the driver requests state/stats and closes stdin, allowing Pi to exit normally.
`exitCode: 0` with `signal: null` is a clean run; only `harnessTimedOut: true` means the harness
had to force-kill an unresponsive host. JSONL evidence keeps only digests, event types, and
whitelisted counters, never raw prompts, tool arguments, credentials, or absolute paths. The
summary also records per-model-turn strategy values and sources, logical request IDs, active tool
counts, and relative `.dove/` artifact facts. Slash commands and `state`/`stats` are
`command-only` steps and do not invent ledger strategy records.

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
`repair` checks current, previous, the exact release-identity cache, then the stable Release. A
corrupt `install.json` is never treated as a fresh install: repair prefers a valid backup and then
scans verified managed releases. The launcher also resolves a compatible Python 3.10+ runtime on
each invocation instead of binding permanently to the installation-time path.

To update a source installation:

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

Unknown CLI subcommands return a non-zero exit and one JSON error object; do not parse Node stack
traces. Tool-call, elapsed-time, and token values are observation-only; their numeric size alone
has no fixed hard ceiling, while repeated or stalled loops remain subject to the progress guards
listed above.

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
  state\install.json.bak
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

For headless diagnostics, `dove-pi doctor` exposes the projection as `requestDiagnostics`, and the
read-only JSON-RPC `diagnostics/status` method projects the latest terminal and resource observation
from the project-scoped `execution.jsonl`. Both return the same `lastTerminal` /
`lastResourceObservation` fields exposed by Pi's `agent_doctor`; the terminal
contains `origin`, `code`, summary, retryability, and the next action, so a generic Pi
`Operation aborted` can still be attributed:

```powershell
'{"jsonrpc":"2.0","id":1,"method":"diagnostics/status"}' | dove-pi rpc
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

Check the network, repository address, and whether the Release asset is still available. You can
also use the source installation.

### Python, Node.js, or npm is too old

For source installs, install Python 3.10+ and Node.js 22.19+ first. The Release bootstrap can install
missing runtimes through winget when available.

### Installation state is corrupt or an update was interrupted

Run the downloaded Release bootstrap again, or use the remaining launcher:

```powershell
dove-pi repair
```

Repair modifies only Dove-managed directories and preserves Pi user data, project `.dove`/`.trellis`,
and source checkouts.

### An extension is degraded

Close Pi/Node processes that may lock a native binary, then run:

```powershell
dove-pi repair
```

### The project has no Dove state

Nothing is required. Ordinary work executes directly and creates compact state silently when
needed. Run `dove-pi project init` only to create an empty state in advance.
