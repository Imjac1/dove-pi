# Personal Agent OS for Pi

## Goal

Build a Windows-first personal Agent distribution that uses Pi as the interactive host, while providing a replaceable Agent Core and custom tool runtime. The Agent should prefer verified reusable scripts and capability workflows over regenerating commands with the model, and should remain compatible with future Pi updates.

## User value

- Perform software development, Windows/PowerShell system work, and authorized black-box security work from one consistent interface.
- Reuse deterministic automation instead of spending model context on repeated work.
- Switch execution behavior quickly with Fast, Standard, and Ultra modes.
- Preserve task state, rules, evidence, and verified personal knowledge through Trellis as the default project-management substrate, while allowing a lightweight path for simple requests.
- Publish the reusable core on GitHub without exposing personal machines, targets, credentials, or private workflows.

## Requirements

### Runtime and integration

- Pi is the primary interactive host; the Agent Core must not depend directly on unstable Pi APIs.
- Provide a Pi adapter boundary for session events, hotkeys/commands, tool registration, approval prompts, streaming output, cancellation, and host-version checks.
- Integrate Trellis as the default project-management and context substrate: the current working directory is the project boundary, `.trellis/` is the default state location, and tasks, specs, memory, journals, and workflow state are available to the Agent through a stable adapter boundary.
- Keep the Agent Core independent from Trellis implementation details. The adapter may delegate to the installed Trellis CLI/SDK or a compatible local provider, and must expose a lightweight fallback when Trellis is unavailable or explicitly bypassed.
- Make project discovery and Trellis readiness observable from Pi: detect the current project root, report whether Trellis is initialized, and provide a guided initialization/repair path rather than silently losing context.
- Treat Windows and PowerShell 5.1/7 as first-class; normalize paths, encoding, CRLF, permissions, process control, timeouts, cancellation, and structured command results.

### Modes and interaction

- Support public `Fast`, `Standard`, and `Ultra` modes. Dove has no `max` execution-policy value; Pi's thinking level and extension profile settings remain separate.
- Modes are switchable through one cycle shortcut (`Ctrl+Alt+M`) or the `/mode fast|standard|ultra` command with visible status. Model selection uses Pi's native model picker/cycle.
- A mode change affects only steps that have not started; a running step keeps its original policy and execution behavior.
- `Ultra` has no artificial fixed context-token budget; it uses adaptive retrieval, deduplication, compaction, and model-limit protection.
- Support explain, preview, and execute interaction levels; high-impact actions require policy-driven approval.
- Keep mode switching discoverable through `Ctrl+Alt+M` (cycle) and `/mode fast|standard|ultra` (exact); use Pi's native `Ctrl+P` model picker/cycle instead of duplicating model shortcuts in Dove.
- Provide a dsh-like compact status surface showing mode, context usage, cumulative token totals, cache/cost when available, active operation, and token throughput.
- Status telemetry must distinguish exact provider-reported values from live estimates and must remain usable with keyboard-only terminal interaction.
- The default status surface delegates context, cumulative tokens, cache, model, provider, TPS, TTFT, duration, stalls, cost, Git, and extension-status rendering to a compatible Pi TUI extension such as `pi-open-tui`; Dove only publishes its existing mode/operation status through Pi's extension-status API.
- The segment uses priority-based compaction: wide terminals show mode/state/operation/throughput/elapsed time, medium terminals omit elapsed time, and narrow terminals retain only mode/state/throughput.

### Reusable automation

- Define versioned contracts for Task, Capability, Execution, Context, Policy/Scope, Result, Evidence, Workspace, and Host Adapter.
- Implement a capability registry with schemas, platform requirements, preconditions, side effects, idempotency, version, verification status, and evidence format.
- Resolve work through a Fast Path: exact capability/recipe match, parameter validation, direct execution, structured summary; invoke the model only when matching fails or results are ambiguous.
- Support reusable atomic capabilities, composed workflow recipes, and platform/target adapters. Avoid target-specific scripts when a parameterized capability is appropriate.
- Support capability lifecycle `draft → tested → verified → stable → deprecated`; do not silently promote one-off scripts into stable shared capabilities.

### Execution, state, and context

- Record a minimal execution ledger with task/step IDs, capability, tool, parameter hash, timestamps, status, and artifact references.
- Make execution steps cancellable, timeout-aware, retry-aware, idempotent where possible, and checkpoint-friendly.
- Separate raw output, normalized output, summaries, and evidence; send only relevant structured context to the model by default.
- Keep context adaptive and relevance-based, with current task and constraints prioritized over unrelated history.
- Keep long-term memory opt-in/verified; transient conversation must not automatically become a permanent rule.
- Use adaptive agent dispatch: keep simple or tightly coupled work inline, and dispatch only when parallelism, isolation, long-running execution, or independent review has a measurable benefit.
- Select inline versus sub-agent execution using deterministic hard rules plus an auditable cost score based on task complexity, expected latency, context duplication, failure/recovery cost, and available concurrency; never dispatch merely because a workflow step exists.

### Safety and publication

- Authorized black-box security testing may use unrestricted techniques within an explicit target scope and configured impact policy.
- Scope, credentials, sensitive data, destructive actions, persistence, and data handling are policy-controlled and auditable.
- Default public distribution is local-first, no telemetry, no embedded secrets, and no personal environment data.
- Separate public core/capabilities from private user/project profiles and target data.

## Out of scope for the first implementation slice

- Task replay UI and re-execution engine (retain compatible ledger fields only).
- Full marketplace or remote control plane.
- Pi core fork.
- Complete development, operations, and security capability catalog.
- Automatic self-modification of Agent Core, policy engine, or memory promotion rules.

## Acceptance criteria

- [x] Repository contains a working core/adapters/tools package boundary with versioned contract definitions.
- [x] Fast, Standard, and Ultra mode state can be switched from Pi integration points and is applied only at the next not-yet-started step.
- [x] A Windows/PowerShell structured executor and transactional workspace tool can run a deterministic sample capability without model-generated shell composition.
- [x] Workspace snapshot, verify, patch, and restore operations are structured, path-bounded, and exposed through Pi tools with automatic rollback on patch failure.
- [x] A first reusable development capability package provides fixed Git, Node, Python, npm install/build/typecheck, and project-test workflows without arbitrary shell regeneration.
- [x] The Windows source installer provisions locked dependencies, validates the runtime, and exposes the renamed `dove-pi` launcher while keeping official Pi behind the adapter boundary.
- [x] Capability registry can discover, validate, execute, and summarize a verified reusable capability and a composed recipe.
- [x] Trellis is the default project-management substrate for the current working directory: an initialized project exposes task/spec/memory/journal/workflow context to the Agent without manual context assembly.
- [x] A project without `.trellis/` has a clear first-run path to initialize a minimal Trellis project, while the Agent remains usable in lightweight mode when initialization is declined or unavailable.
- [x] The adapter preserves Trellis task identity across context compilation and execution records, and exposes explicit operations for current task, task creation/start/finish/archive, context lookup, and memory lookup.
- [x] Execution records retain enough identifiers and artifact references for future replay without implementing replay now.
- [x] `agent doctor` (or equivalent) reports Pi, PowerShell, runtime, tool, permission, and Trellis compatibility issues.
- [x] Tests cover contracts, Windows executor behavior, mode-boundary semantics, capability resolution, and adapter compatibility without duplicating full end-to-end gates.
- [x] Dispatch policy tests demonstrate that trivial work stays inline while independent expensive work can be parallelized and long-running work can be isolated.
- [x] Dispatch decisions are persisted with predicted versus actual cost for later calibration; completion records include wall time, optional token metrics, retries, and human interventions.
- [x] Context compiler selects active task/runtime context by relevance, keeps Fast minimal, and allows Ultra to load relevant context without a fixed application token cap.
- [x] Pi dependency follows the latest stable tested range and CI exercises both the lockfile version and `@latest`.
- [x] Optional Pi extension profiles provide offline-first compatibility and load-order diagnostics without installing packages or rewriting user settings.
- [x] A keyboard-accessible status surface uses `pi-open-tui` as the preferred all-in-one renderer when enabled, keeps Pi/provider usage as the source of truth, exposes Dove's existing mode/operation status through `setStatus`, and falls back to Pi's native footer/status when the plugin is absent. Renderer refresh is limited to approximately 1 Hz unless a critical state transition requires an immediate update.

## Resolved implementation notes

- Latest stable Pi `@earendil-works/pi-coding-agent` version `0.84.3` exposes the required extension APIs (`registerTool`, `registerCommand`, `setStatus`, session entries, and lifecycle events); the adapter uses those public APIs and does not fork Pi. Dependency updates must test the latest stable version before release. Model selection and exit use Pi's native controls rather than duplicate Dove commands.
- TypeScript is used for the core and adapter; PowerShell is executed as a structured child runtime.

## Final architecture decision

Use a **Trellis-first control plane with a Dove execution plane and a provider firewall**.

## UX simplification decision

Dove is the single user-facing control surface. Trellis remains the default project backend, but its provider name,
CLI flags, skill filenames, and task lifecycle internals are advanced concepts rather than required daily vocabulary.

The first-run path should offer one consented project bootstrap from inside Pi. After approval, Dove initializes the
project, refreshes its provider, and makes project context available without requiring the user to manually chain
`trellis init`, `/reload`, and a Trellis session skill. Existing `/project`, `/task`, `/skills`, and `/skill:*` commands
remain supported as explicit advanced/compatibility interfaces.

### UX acceptance criteria

- [x] A new project can be initialized from a single Dove-facing flow with one user confirmation.
- [x] After initialization, the active provider and normalized context are available immediately; skill refresh is
  automatic when the host supports reload and otherwise produces one actionable notice.
- [ ] The primary documentation presents Dove commands and natural-language work first; Trellis CLI details are moved
  to an advanced section.
- [x] Explicit lightweight binding suppresses initialization prompts and all Trellis context reads.

- Trellis owns project management: project identity, tasks, task lifecycle, specs, workflow state, journals, and long-term memory.
- Dove owns execution: capabilities, policies, approvals, Windows runtime, evidence, execution ledger, mode events, and Pi UX.
- The Agent Core depends only on a small normalized project-context interface; it does not import Trellis or copy Trellis's CLI/templates/hooks.
- The current working directory is the project boundary. An existing `.trellis/` is automatically selected as the project backend; a missing Trellis installation gets a guided initialization path and a limited lightweight fallback.
- A single project has one project-data authority. There is no default duplicate NativeProvider task/spec store and no unrestricted bidirectional file sync in the first release.

## Synchronization and update contract

Synchronization is provider-mediated normalization, not blind file mirroring.

1. Discover the project root and load provider metadata.
2. Pull Trellis state before session/context-sensitive operations.
3. Normalize tasks, specs, memory, journals, and workflow state into Core read models.
4. Route project mutations through the Trellis CLI/SDK/provider; Core never writes Trellis files directly.
5. Keep Dove ledger/evidence/mode state separate and correlate it with the Trellis task ID.
6. Invalidate stale context projections using version/mtime/hash checks.
7. On conflict, preserve both sides and require explicit reconciliation; never use silent last-write-wins.

Trellis version, project `.trellis/.version`, and Dove adapter contract version are tracked separately. Trellis template
updates use the official `update`/migration behavior, including `.template-hashes.json`, user-modified-file detection,
`.new` sidecars, backups, and a file-level report. Unsupported major versions enter visible read-only/degraded mode.

## Scope boundaries

In scope:

- automatic Trellis project detection and guided first-run initialization;
- Trellis-backed task/spec/memory/workflow context in Pi;
- task lifecycle and memory lookup operations through an adapter;
- version/capability diagnostics, safe updates, and recoverable migrations;
- lightweight startup when Trellis is unavailable.

Deferred:

- a second full native task/spec/workflow backend;
- continuous bidirectional synchronization;
- semantic merging of arbitrary Markdown;
- automatic promotion of conversation into permanent memory/spec;
- copying Trellis's entire implementation into Dove.

## Final architecture review guardrails

The following constraints are required to keep the Trellis-first design small and safe:

- Store an explicit Dove project integration manifest (provider, project root, adapter contract, and last-known Trellis version) so provider selection is stable when both `.dove/` and `.trellis/` exist.
- Correlate Pi session IDs, Trellis session/task IDs, and Dove execution IDs without conflating them; support multiple concurrent Pi windows against one project.
- Treat project mutations as recoverable intents: record an intent before the provider call, record success/failure after it, and reconcile incomplete intents on startup because Trellis and Dove cannot share one atomic transaction.
- Do not create a Trellis task for every conversational turn. Use explicit intent/complexity rules: simple read-only requests may remain ephemeral; code changes, multi-step work, or user-requested tracking enter a task.
- Treat specs, task files, and journals as untrusted project content when placed in model context. Preserve source labels and boundaries, and never allow project text to override system safety or authorization policy.
- Prefer a direct, versioned Trellis SDK when available; use the CLI as a controlled fallback. Avoid spawning a global CLI on every prompt and never silently install or upgrade it.
- Respect Trellis and Git settings such as `session_auto_commit`; never auto-commit or run `trellis update` without an explicit policy/confirmation boundary.
- For monorepos, resolve the Trellis package/project scope explicitly instead of assuming the process cwd alone identifies the target package.
- Workspace snapshots and evidence must exclude secrets and credential-bearing files by default; sensitive paths require explicit opt-in.
- Startup remains offline-first. Version checks, update checks, and migrations are explicit or cached, not a hidden network dependency.
