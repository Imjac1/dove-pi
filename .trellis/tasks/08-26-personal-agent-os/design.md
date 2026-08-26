# Technical Design

## Architecture

```text
Pi host
  └─ pi-adapter
      └─ agent-core
          ├─ intent / mode controller
          ├─ context compiler
          ├─ planner + verifier
          ├─ policy / scope engine
          ├─ capability registry
          └─ execution ledger
              └─ tool-runtime (Windows-first)

Trellis adapter ── tasks / specs / memory / journals
Evidence store ── raw / normalized / summary / evidence artifacts
```

## Final project-management architecture

Use a **Trellis-first control plane with a Dove execution plane and a provider firewall**.

```text
Pi host
  └─ Dove Pi adapter
      ├─ Agent Core
      │   ├─ capability / policy / dispatch
      │   ├─ Windows runtime
      │   ├─ execution ledger / evidence
      │   └─ normalized ProjectContext interface
      │
      └─ Trellis integration layer
          ├─ project-root discovery
          ├─ Trellis init / doctor / update
          ├─ task lifecycle commands
          ├─ specs / workflow / memory retrieval
          └─ version and capability negotiation
```

Trellis is the project-management authority for initialized projects: project identity, tasks, task lifecycle, specs,
workflow state, journals, and long-term memory. Dove is the execution authority: capabilities, policies, approvals,
PowerShell/workspace operations, evidence, execution records, mode events, and Pi-facing UX.

The Core imports neither Trellis packages nor Trellis file details. It consumes a small normalized interface such as
`getProjectContext`, `getCurrentTask`, `mutateTask`, `readMemory`, and `getProviderHealth`. The first provider is
`TrellisProvider`; a full native project-management provider is intentionally deferred. If Trellis is unavailable, Dove
may start in a limited read-only/lightweight mode, but must not silently create a second project database.

## User-facing control surface

Keep a single Dove-facing entry point. On an interactive session start, an unbound lightweight project may receive one
consent prompt to initialize Trellis. Initialization uses the existing provider operation, then refreshes the provider
and host resources when the Pi command context exposes `reload()`. Explicitly bound lightweight projects never prompt.
The existing low-level commands remain available for diagnostics, scripts, and compatibility, but the primary workflow
should not require users to know Trellis CLI flags or individual skill names.

Provider selection is deterministic: an explicit project setting wins; otherwise an existing `.trellis/` selects
`TrellisProvider`. In a directory without Trellis, the first-run flow offers guided `trellis init`; declining leaves
project-management features unavailable but does not prevent basic Dove execution.

Synchronization is pull-before-read and provider-mediated mutation, not file mirroring. The provider refreshes state at
session start and before context-sensitive operations, normalizes it into Core read models, and invalidates stale caches
using version/mtime/hash metadata. Project mutations go through the provider, never through Core direct file writes.
Dove ledger/evidence records retain the provider task ID and a provider revision so execution remains traceable.

Conflicts are fail-safe: preserve both sides, emit a reconcile diagnostic, and require explicit user action. Automatic
last-write-wins, continuous bidirectional sync, and semantic merging of arbitrary Markdown are outside the first release.

## Update and migration design

- Track the Trellis runtime version, project `.trellis/.version`, and adapter contract version independently.
- Prefer an explicit, compatibility-tested Trellis CLI/SDK dependency; do not rely only on a user's global executable.
- Delegate generated-template refresh to Trellis `update` semantics, including template hashes, user-modified-file
  conflicts, and `.new` sidecars.
- Before a migration, create a recoverable project snapshot and emit a file-level change/conflict report.
- Treat unsupported major versions as a visible degraded provider, not as a silent fallback that could misread task data.
- Keep provider contract tests with fixtures for supported Trellis versions and the documented lightweight/degraded path.

## Invariants and overlooked boundaries

- Project-root discovery must stop at an explicit marker and must not accidentally bind a nested workspace to a parent
  `.trellis/`.
- Provider mutations need file locking / atomic writes because Pi, Trellis CLI, hooks, and other agents may run together.
- Task IDs, provider revision IDs, and Dove execution IDs are distinct but correlated; IDs must survive migration.
- Secrets and sensitive target data never enter specs, journals, context caches, or public artifacts by default.
- Large or duplicated memory/spec content is summarized and source-referenced before entering model context.
- A missing or partially broken Trellis installation should allow read-only/degraded startup with an actionable doctor
  report; mutations must be blocked until the provider is healthy.
- Crash recovery must make provider mutations and Dove ledger writes idempotent or visibly incomplete rather than
  reporting a task as complete after only one side was persisted.

## Additional implementation guardrails

- Persist a small `.dove/project.json` integration manifest containing the selected provider, canonical project root,
  adapter contract version, and last-known Trellis version. This prevents provider flapping when both `.dove/` and
  `.trellis/` are present.
- Keep three identities separate: Pi session identity, Trellis task/session identity, and Dove execution/dispatch
  identity. A correlation record may link them, but no layer may substitute one for another.
- Use an intent/completion pair for provider mutations. If the process exits between the Trellis mutation and the Dove
  ledger write, startup reconciliation marks the operation incomplete and re-reads provider state instead of claiming
  success.
- Apply task-creation policy before calling Trellis: ephemeral read-only requests do not create tasks automatically;
  multi-step changes, explicit tracking requests, and workflow-required work do.
- Mark all injected project content with source/type boundaries. Specs and task files are data, not instructions that can
  override system policy, authorization, or safety constraints.
- Prefer an in-process Trellis SDK with a tested version range. CLI invocation is a bounded fallback with structured
  parsing, timeout, environment isolation, and no silent installation/update.
- Respect Git/session auto-commit settings and expose mutations before applying them. `trellis update` is an explicit
  maintenance action, not a side effect of opening a project.
- Resolve monorepo package scope from Trellis config and explicit user intent; do not infer a single package from cwd
  when multiple package roots are configured.
- Exclude common secret files from snapshots, evidence, and context by default, with explicit opt-in for sensitive paths.
- Keep startup offline-first; cache compatibility metadata and perform network/update checks only through explicit or
  user-configured maintenance actions.

The core communicates through stable internal contracts. Pi and Trellis are adapters, not core dependencies. A lightweight
execution/context fallback remains available when Trellis is absent or deliberately bypassed; it is not a second full
project-management database in the first release.

## Execution model

1. Convert the user request into a task intent and selected mode.
2. Build a relevance-ranked context working set.
3. Resolve an exact capability or recipe before invoking open-ended planning.
4. Validate policy, target scope, preconditions, and permissions.
5. Execute deterministic steps through the runtime and write structured results/evidence.
6. Verify the acceptance condition; invoke model reasoning only for ambiguity, failure recovery, or missing capability.
7. Persist task state, a compact execution ledger, and verified learnings.

Agent dispatch is a cost-aware policy, not a fixed platform setting. It is implemented in three stages:

1. **Hard rules**. Stay inline for a deterministic Fast Path capability, a task with fewer than three coupled actions, shared mutable workspace state, or work whose estimated execution is under 60 seconds. Dispatch is required for an isolated long-running operation estimated over 120 seconds, or for two or more independent branches each estimated over 60 seconds when concurrency is available.
2. **Cost score for the middle band**. Estimate `inline_cost = model_turns + tool_time + recovery_risk` and `dispatch_cost = startup_overhead + injected_context_duplication + coordination/join + worker_time`. Dispatch only when predicted wall time improves by at least 25% or predicted total cost is at least 20% lower, with no increase in policy risk. Scores and estimates are recorded before execution.
3. **Calibration**. Record predicted and actual startup, context, wall time, retries, and human interventions. Repeated misses adjust heuristics, but never bypass the hard safety rules automatically.

Parallel dispatch is allowed only when the dependency graph has an explicit join point and branches do not write the same mutable resources. Independent review may dispatch even without speedup only when the task policy requires a second opinion. Ultra mode can choose a more aggressive route inside these rules; it does not override them.

Mode changes are events. The currently running step snapshots its mode/policy; queued steps read the latest mode at their execution boundary. A mode change cannot expand target scope automatically.

## Windows runtime

Use a structured process contract rather than raw shell strings. Detect `pwsh` and Windows PowerShell, preserve cwd/encoding/newlines, capture exit code/stdout/stderr/duration, support timeout/cancel/background handles, and expose explicit elevation state. Workspace operations use search/inspect/snapshot/patch/verify/restore semantics.

## Context and evidence

Raw tool output is stored outside the model prompt. Normalizers produce typed results, summaries carry source references, and evidence artifacts remain addressable. Ultra mode removes artificial application token caps but still applies relevance retrieval, deduplication, and model-context limit protection.

## Versioning and compatibility

Contracts use semantic versions and machine-readable schemas. The Pi adapter contains the only Pi-specific API assumptions and reports supported/tested host versions. The package tracks the latest stable Pi release through a compatible semver range, Dependabot, and a locked/latest CI matrix; dependency updates run type-check, adapter registration smoke tests, and the doctor command before acceptance. Capability packages declare runtime and platform compatibility. Migrations are explicit and non-destructive.

## Security boundary

Security capabilities require an explicit scope/policy document. Technique selection is not artificially whitelisted inside authorized scope, but destructive impact, persistence, secret access, and data handling remain policy-controlled. Public defaults are local-only, no-telemetry, and secret-free.

## Trade-offs

- A separate core/adapter boundary adds initial scaffolding but prevents Pi upgrades from forcing a core rewrite.
- Fast Path resolution adds registry metadata work but is the main defense against repeated token use.
- Trellis compatibility instead of hard dependency preserves lightweight UX and future backend choice.
- Adaptive dispatch adds scheduler complexity but avoids both token waste from unnecessary agents and latency from forcing all work through one session.
- The first slice favors a reliable Windows runtime and contracts over a broad capability catalog.
