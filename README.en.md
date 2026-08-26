# Dove Pi

Chinese documentation: [README.md](README.md)

Dove Pi is a Windows-first personal Agent runtime. It uses the official Pi host for interaction, Dove for execution, and Trellis as the project-management and context control plane.

## Architecture

```text
Pi: interactive host
 └─ Dove Pi adapter: commands, tools, shortcuts, status
     ├─ Dove core: capabilities, policy, approvals, dispatch, evidence, ledger
     ├─ Windows runtime: PowerShell and transactional workspace operations
     └─ Trellis provider: projects, tasks, specs, workflow, journals, memory
```

The core does not import Pi or Trellis internals. The current working directory is the project boundary. An existing `.trellis/` selects the Trellis provider automatically; a missing Trellis installation gets a guided initialization path and a lightweight fallback.

There is one project-data authority: Trellis owns project data and Dove owns execution data. Dove does not maintain a duplicate task/spec database and never edits `.trellis/` files directly.

## Requirements

- Windows 10/11
- Node.js `>=22.19.0`
- Windows PowerShell 5.1 or PowerShell 7 (PowerShell 7 recommended)
- Pi 0.84.x tested compatibility range
- Trellis 0.6.x or a compatible local provider

## Installation

From the repository directory:

```powershell
python .\dove_pi.py install
```

The default installation:

- installs locked Node dependencies;
- installs the complete `max` extension profile;
- attempts Nerd Font configuration;
- creates a user-level `dove-pi` launcher;
- runs a fast typecheck and Pi integration verification.

Useful options:

```powershell
python .\dove_pi.py install --profile dev
python .\dove_pi.py install --verify full
python .\dove_pi.py install --no-font
python .\dove_pi.py install --no-path
python .\dove_pi.py install --clean
```

`setup` is an alias for `install`. The legacy `--extensions` and `--skip-checks` flags remain compatible. Repeated installs reuse the lockfile and npm cache and do not silently update Pi or global extensions.

## Launch and project checks

Start from the target project directory:

```powershell
dove-pi
```

Or use the Python entry point directly:

```powershell
python .\dove_pi.py
```

Inspect the runtime and provider:

```powershell
dove-pi doctor
dove-pi project
dove-pi project init
dove-pi project update
```

`project update` runs Trellis migration/update logic only when explicitly requested. Preserve a snapshot before maintenance; Trellis handles modified templates and `.new` sidecars.

## Is Trellis automatic or manual?

Both, with different responsibilities: **reads and context assembly are automatic; initialization, updates, and task mutations are explicit.**

| Situation | Invocation | Actual behavior |
| --- | --- | --- |
| Dove startup | Automatic | Discovers the nearest `.trellis/` from the current directory and selects `TrellisProvider`. |
| Every Agent request | Automatic | Before the prompt reaches the model, reads tasks, the active task, specs, workflow, and memory, then compiles relevant context for Fast/Standard/Ultra. |
| `/project`, `dove-pi doctor` | Automatic read | Reports provider, Trellis version, task-lifecycle capability, and current task without modifying the project. |
| No `.trellis/` found | Not automatic | Uses the lightweight provider; it never silently creates Trellis. |
| `/project init` or `dove-pi project init` | Explicit | Runs the non-interactive `trellis init --yes --pi --no-monorepo` preset; use `/reload` in Pi afterwards. |
| `/project update` or `dove-pi project update` | Explicit | Runs `trellis update`; startup never updates Trellis implicitly. |
| `/task create|start|finish|archive` | Explicit | Runs the project-local `.trellis/scripts/task.py` lifecycle command and records the mutation in Dove's ledger. |
| `/memory [query]` | Explicit read | Searches normalized Trellis journal/memory documents; it does not promote conversation into permanent memory automatically. |
| `/project bind trellis|lightweight` | Explicit | Writes `.dove/project.json` to pin provider selection; it does not edit Trellis data. |

The underlying flow is:

```text
Pi startup
  → Dove discovers the current project
  → finds .trellis/
  → automatically reads and normalizes context
  → Agent request uses the relevant context

User runs /task or project init/update
  → Dove checks provider health and acquires the project lock
  → invokes Trellis task.py or the Trellis CLI
  → records success, failure, or an incomplete mutation
```

For normal development you do not need to type a `trellis` command manually. Open Dove Pi inside an initialized Trellis project and it will use Trellis automatically. If the project has no Trellis yet, run `/project init` inside Pi; you do not need to leave Pi.

## Invoking Trellis skills in Pi

Trellis skills are workflow instructions for the Agent, not Trellis CLI commands. Pi automatically discovers `.agents/skills/**/SKILL.md` from the current project and its parent directories. On first use, approve/trust the project when Pi asks to load project resources.

Common invocations:

```text
/skill:trellis-start
/skill:trellis-brainstorm
/skill:trellis-before-dev
/skill:trellis-check
/skill:trellis-continue
/skill:trellis-update-spec
/skill:trellis-finish-work
```

They respectively initialize/resume a session, explore requirements, load pre-development guidelines, run quality checks, continue an active task, capture a reusable spec rule, and wrap up/archive work. Skills can receive additional instructions:

```text
/skill:trellis-brainstorm design a new Windows capability
/skill:trellis-check verify the provider and context boundaries for this task
```

If you are unsure whether Pi discovered the project skills, run `/skills` to list them. The equivalent terminal diagnostic is:

```text
dove-pi skills
dove-pi skills trellis
```

Skills guide the Agent through the Trellis workflow; `/project init` and `/task ...` perform the actual project initialization and task lifecycle operations. Use `/reload` to refresh skills, extensions, and project context. If auto-discovery is disabled, start with `--skill .agents/skills`.

## Pi commands

- `Ctrl+Alt+M`: cycle Fast → Standard → Ultra
- `/mode fast|standard|ultra`: select an exact execution mode
- `/status`, `/status full`: inspect Dove status and telemetry sources
- `/project`: show root, provider, and Trellis health
- `/project bind trellis|lightweight`: explicitly bind a provider
- `/task create|start|finish|archive ...`: delegate task lifecycle to Trellis
- `/memory [query]`: search project journals and memory
- `/capabilities`: list reusable capabilities

Pi's native model picker and exit controls remain authoritative. Pi's thinking level `max` and the extension installation profile `max` remain available, but neither is a Dove execution mode.

## Execution modes

| Mode | Behavior |
| --- | --- |
| Fast | Loads the active task PRD and runtime spec, prefers exact capability matches, and minimizes dispatch/context overhead. |
| Standard | Uses relevance-ranked task/spec context and normal capability and dispatch rules. |
| Ultra | Expands relevant context and memory retrieval with deduplication and adaptive compaction, without an artificial Dove token cap. |

Modes never override policy, approval, target scope, or model limits. A running step keeps its original policy; a mode change affects only steps that have not started.

Dispatch keeps short, tightly coupled, or shared-state work inline. Independent expensive branches may run in parallel, and isolated long-running work may use a sub-agent. Decisions record predicted cost, actual timing, and the reason.

## Trellis synchronization

Synchronization is provider-mediated normalization, not file mirroring:

1. discover the project root and provider;
2. pull Trellis state at session start and before context-sensitive operations;
3. normalize it into Core read models;
4. route project mutations through the provider;
5. correlate Dove ledger/evidence with the Trellis task ID and provider revision;
6. preserve both sides on conflict and require explicit reconciliation.

Project documents are marked as untrusted data in model context and cannot override system safety policy. Snapshots, evidence, and logs exclude common credential-bearing paths by default.

## Development and verification

```powershell
npm install
npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
```

The current implementation is a runnable foundation MVP, not a complete development, operations, or security catalog. Task replay, a full remote control plane, a second native project database, and automatic memory promotion are intentionally out of scope for the first release.

## Next steps

The next phase focuses on clean-environment installation and real Trellis lifecycle validation, real Pi sub-agent/channel dispatch, cost calibration, Trellis update/conflict/rollback fixtures, and release CI/security-boundary checks.

Project guidelines live in [.trellis/spec/](.trellis/spec/), and the active task is [.trellis/tasks/08-26-personal-agent-os/](.trellis/tasks/08-26-personal-agent-os/).
