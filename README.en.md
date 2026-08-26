# Dove Pi

中文文档：[README.md](README.md)

Dove Pi is a Windows-first personal Agent runtime. Users interact with Dove Pi as the single front door: Pi hosts the TUI and model, Dove executes verified work, and Trellis manages project context and tasks behind the scenes.

## Requirements

- Windows 10/11
- Python 3.10+
- Node.js `>=22.19.0`
- Windows PowerShell 5.1 or PowerShell 7 (7 recommended)

The installer selects the complete `max` extension profile by default. This `max` is only an extension collection name, not a Dove execution mode.

## The shortest path

```powershell
python .\dove_pi.py install
cd path\to\your\project
dove-pi
```

When a project has no `.trellis/`, interactive Pi asks once whether to initialize project context. Accepting creates Trellis, selects the provider, and loads context. Declining keeps the project in lightweight mode. You can also run `/project init` explicitly.

Initialization and update commands request a Pi resource reload when the host lifecycle allows it. If the current lifecycle cannot hot-reload, run `/reload` once.

## The architecture in one picture

```text
User → Dove Pi → Agent
               ├─ discovers the project
               ├─ reads normalized context
               ├─ suggests a workflow
               └─ calls Trellis for task changes when needed
```

| Component | Owns |
| --- | --- |
| Pi | Model, TUI, native shortcuts, and sessions |
| Dove | Capabilities, modes, approvals, dispatch, evidence, and execution ledger |
| Project Provider | Project discovery, context normalization, and task operations |
| Trellis | Projects, tasks, specs, workflow, memory, and journals |

Trellis is the single authority for project data. Dove is the authority for execution data. Dove does not maintain a second task/spec database and never edits `.trellis/` files directly.

Context has one path:

```text
Project Provider → ProjectContextSnapshot → Context Compiler → Agent
```

Binding a project to lightweight therefore changes status, task operations, and model context together.

## Daily work

After startup, describe the work naturally:

```text
Fix the login timeout and add tests.
```

Dove classifies the request, loads relevant project context, suggests a workflow skill, prefers verified capabilities/recipes, and records execution results. Ordinary conversation does not create a Trellis task. Explicit tracking requests and clear multi-step changes do.

## Task lifecycle

You can say:

```text
Start tracking this development task.
Finish the current task.
Archive this task.
```

The Agent can call Dove's `agent_project_task` tool for `create`, `start`, `finish`, or `archive`. The tool requires interactive confirmation and uses the same Provider and mutation ledger as the compatibility command.

Compatibility commands remain available:

```text
/task create <title>
/task start <task directory or name>
/task finish
/task archive <task directory or name>
```

## Skills

Skills are Agent workflow instructions, not Trellis CLI commands. Dove provides advisory suggestions based on intent:

- requirements and design → `trellis-brainstorm`
- implementation or bug fixing → `trellis-before-dev`
- tests and review → `trellis-check`
- resuming work → `trellis-continue`
- finishing and archiving → `trellis-finish-work`

Suggestions are advisory and do not mutate the project by themselves. Explicit invocation is always available:

```text
/skill:trellis-start
/skill:trellis-continue
/skill:trellis-brainstorm
/skill:trellis-before-dev
/skill:trellis-check
/skill:trellis-update-spec
/skill:trellis-finish-work
```

Inspect discovery with:

```text
/skills
/skills trellis
```

## Automatic versus explicit behavior

| Behavior | Default |
| --- | --- |
| Discover project/provider and read context | Automatic |
| Select context depth and dispatch route | Automatic |
| Suggest a workflow skill | Automatic advisory |
| Execute a skill | Explicit or workflow-confirmed |
| Create/finish/archive a task | Explicit intent + interactive confirmation |
| Initialize Trellis | One startup prompt or `/project init` |
| Update Trellis templates | Explicit `/project update` |
| Bind a provider | Advanced configuration only |

## Commands you may need

```text
/status
/status full
/project
/project doctor
/project init
/project update
/project bind trellis
/project bind lightweight
/memory [query]
/capabilities
/mode fast|standard|ultra
Ctrl+Alt+M
```

Most users do not need `/project bind`, `/task ...`, or `/skill:*`. They remain useful for diagnostics, scripting, and compatibility.

## Execution modes

Standard is the default. Modes affect context depth and dispatch aggressiveness, not permissions, approvals, target scope, or model limits.

| Mode | Best for |
| --- | --- |
| Fast | Small, deterministic work with exact capability matches |
| Standard | Normal development and multi-step work |
| Ultra | Complex work requiring more related specs and memory |

Dove has no `max` execution mode. Pi's `max` thinking level and the installer's `max` extension profile are separate concepts.

## Updating Trellis

Updates are explicit:

```text
/project update
```

or:

```powershell
dove-pi project update
```

Trellis handles template hashes, user modifications, conflicts, and `.new` files. Dove calls the Provider, refreshes status, and records the result.

## Troubleshooting

```powershell
dove-pi doctor
dove-pi project
dove-pi skills trellis
```

Inside Pi:

```text
/project doctor
/skills trellis
```

- No Trellis: accept the startup prompt or run `/project init`.
- Skills missing: run `/reload` and trust the project directory.
- Provider degraded: inspect `/project doctor`, repair `.trellis/`, then update.
- Temporarily bypass Trellis: `/project bind lightweight`.

## Installation options and verification

```powershell
python .\dove_pi.py install --verify full
python .\dove_pi.py install --no-font
python .\dove_pi.py install --no-path
python .\dove_pi.py install --clean

npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
```

`setup` aliases `install`. Repeated installs reuse the lockfile and npm cache and do not silently upgrade Pi or global extensions.

This is a runnable foundation MVP. Task replay, a full remote control plane, a second native project database, and automatic memory promotion are intentionally out of scope for the first release.

Project guidelines live in [.trellis/spec/](.trellis/spec/), and the active task is [.trellis/tasks/08-26-personal-agent-os/](.trellis/tasks/08-26-personal-agent-os/).
