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

## Pi commands

- `Ctrl+Alt+M`: cycle Fast → Standard → Ultra
- `/mode fast|standard|ultra`: select an exact execution mode
- `/mode fast|standard|ultra`: Dove accepts only these three execution modes
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
