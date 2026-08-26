# Implementation Plan

## Slice 1: foundation

1. Inspect the installed Pi extension/tool APIs and select the supported package/runtime shape.
2. Scaffold the repository with `core`, `pi-adapter`, `trellis-adapter`, `windows-runtime`, `schemas`, and `tests` boundaries.
3. Add versioned schemas and typed interfaces for Task, Capability, Execution, Context, Policy, Result, Evidence, Workspace, and Host Adapter.
4. Implement mode controller and event semantics; add configurable shortcut/command integration in the Pi adapter.
5. Implement the Windows structured process executor and transactional workspace primitives.
6. Implement capability registration, exact-match Fast Path resolution, parameter validation, and structured result normalization.
7. Implement minimal execution ledger and artifact references; defer replay behavior.
8. Implement the Trellis-first project integration boundary: discover the current project root, select `TrellisProvider`, and expose a limited lightweight fallback without creating a duplicate task/spec database.
9. Add Trellis lifecycle, context, and memory operations through the provider and correlate the active Trellis task ID with Dove execution records.
10. Add project health, Trellis version/capability negotiation, guided first-run initialization, and safe update/migration diagnostics.
11. Add an adaptive dispatch policy with hard rules, a cost score, explicit join-point checks, and optional sub-agent/channel dispatch for independent, long-running, or isolated work; include predicted and actual cost plus the decision reason in the ledger.
12. Add the relevance-ranked context compiler and structured Trellis task/spec/memory loading; keep Fast minimal, Standard focused, and Ultra adaptive without a fixed application token cap.
13. Track the latest stable Pi through semver, Dependabot, and locked/latest compatibility CI.
14. Add the Dove project integration manifest, distinct session/task/execution identity mapping, mutation intent/completion recovery, and deterministic task-creation policy.
15. Add source-boundary labeling for project context, secret-path exclusions, monorepo scope resolution, and explicit Git/Trellis maintenance confirmation.
16. Simplify the user-facing flow: add consented single-step project bootstrap, refresh provider/skills after bootstrap,
    and keep Trellis-specific commands as advanced compatibility interfaces.
17. Add deterministic workflow-intent suggestions and an approval-protected `agent_project_task` tool; reuse the same
    mutation/ledger path from `/task` so natural language and compatibility commands cannot diverge.
18. Reconcile the README with the actual CLI surface and simplify installer progress output/options without reducing the
    default complete extension installation; fix no-argument launcher dispatch and avoid noisy repeated extension logs.

## Validation

- Type-check and lint all packages.
- Run contract/schema validation.
- Run Windows PowerShell 5.1/7 executor tests where available.
- Verify mode changes affect only not-yet-started steps.
- Execute a deterministic sample workspace capability without model-generated shell text.
- Verify Fast Path avoids planner invocation for an exact capability match.
- Verify Trellis-backed startup, guided initialization, and lightweight/degraded startup behavior.
- Verify provider task IDs and revisions correlate with Dove execution records and stale/conflicting external changes fail safely.
- Verify Trellis update checks, user-modified template preservation, backup/rollback, and unsupported-version diagnostics.
- Verify provider selection remains stable with both `.dove/` and `.trellis/`, concurrent sessions correlate correctly, and interrupted provider mutations reconcile safely.
- Verify simple read-only turns do not create tasks automatically, while multi-step or explicitly tracked work does.
- Verify project content cannot override system policy through injected instructions, and secret-bearing paths are excluded by default.
- Run adapter smoke tests against the installed Pi version.
- Verify dispatch policy keeps small/tightly coupled tasks inline and only parallelizes tasks with an explicit expected benefit.
- Test hard thresholds (under 60 seconds inline, isolated over 120 seconds dispatch, independent branches over 60 seconds dispatch when concurrency exists) and the 25% wall-time / 20% total-cost decision threshold.
- Verify Fast/Standard/Ultra context selection and Pi locked/latest compatibility smoke tests.
- Verify a new interactive project can bootstrap from one confirmation, an explicitly lightweight-bound project does not
  prompt or read Trellis, and the existing low-level commands remain backward compatible.
- Verify task-tool mutations require confirmation, are blocked in non-interactive contexts, and preserve the same
  provider-qualified task IDs and ledger records as `/task`; verify skill suggestions are advisory only.
- Verify `python dove_pi.py` with no arguments launches Pi, install output has stable step counts with optional stages,
  repeated setup skips already configured extensions quietly, and the README examples match `src/cli.ts` exactly.

## Review gates

- No Pi-specific imports in core.
- No plaintext secrets in artifacts or logs.
- No target-specific security script in the reusable capability layer.
- No duplicate full end-to-end gate added for each capability.
- Public defaults remain local-only and safe to inspect.

## Rollback points

- Revert Pi adapter independently if the host API changes.
- Disable a capability package without changing core contracts.
- Disable Trellis adapter and use lightweight state provider.
- Disable a newly promoted capability by lifecycle status without deleting evidence.
