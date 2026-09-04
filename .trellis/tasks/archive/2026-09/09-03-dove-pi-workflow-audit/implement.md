# Implementation plan: Dove Pi 全工作流审计与使用指南

## Ordered checklist

1. [x] Re-read the task artifacts and relevant specs; confirm the change boundary.
2. [x] Add launcher routing coverage for startup-prefix aliases and implement the smallest classifier change in `dove_pi.py`.
3. [x] Wrap `src/cli.ts` dispatch in a terminal error boundary and reject unknown `project` subcommands; add subprocess tests for JSON errors and exit codes.
4. [x] Prioritize Legacy `workflow.md` before bounded bulk document projection so large projects retain the lifecycle contract.
5. [x] Expand `README.md` and `README.en.md` with lifecycle flow, command routing table, state/data boundary, real-user smoke procedure, recovery order, and limitations.
6. [x] Run focused tests, then the complete typecheck/test/installer/doctor/Pi smoke gate.
7. [x] Run `git diff --check`, inspect the final diff for cross-layer drift, and record any follow-up finding without expanding scope.
8. [x] Add request-planning decision-table regressions, then fix lifecycle/inventory/formal classification in `src/core/request-plan.ts` without changing tool authority.
9. [x] Add user-visible policy termination diagnostics and a clear `/status full` strategy breakdown in `src/pi-adapter/extension.ts`; preserve all existing thresholds.
10. [x] Reproduce and fix context snapshot retry after empty/budget-omitted compilation, preserving provider prompt-cache ordering. **Done:** the runtime-spec filename matcher now includes both `personal-agent-runtime.md` and `personal-agent-request-runtime.md`; the stale-session settlement path is state-only and has a regression test.
11. [x] Surface actionable source-drift guidance from doctor and document the managed-release/source distinction in both READMEs.
12. [x] Re-run focused request-plan/Pi-adapter/doctor tests and the complete quality gate.
13. [x] Add request-level cumulative resource accounting first: aggregate every Pi
    assistant usage sample, tool duration, provider stop reason, and cache write in
    the adapter state; project those fields into the observation ledger and status.
14. [x] Add a shared `RequestTerminalEnvelope` plus a single adapter helper that owns terminal precedence, ledger persistence, user/RPC diagnostics, and idempotent host abort dispatch.
15. [x] Replace direct `ctx.abort()` sites in provider-round, model-budget, terminal provider failure, and agent-end paths with the helper; classify progress-guard and convergence termination through the same envelope without weakening their block behavior. Allow one synthesis grace round after a successful/progress-producing tool batch; retain the current hard stop for no-progress.
16. [x] Add a bounded `/status full` resource/last-terminal section and a read-only RPC/doctor projection so headless clients can retrieve the exact abort origin/code after Pi renders `Operation aborted`.
17. [x] Extend lifecycle and blackbox tests with a decision table for user cancellation, authentication failure, exhausted transient retry, non-idempotent retry refusal, provider-round, model-budget, progress guard, convergence, session replacement, multi-round cumulative usage, slow-tool warning, and progress grace; assert one terminal record and no stale-ctx access.
18. [x] Run the real-user RPC harness against the source launcher in temporary directories. Missing credentials/provider pending are recorded as environment evidence; fake/local scenarios are deterministic, and no threshold-increase task was started.

## Final verification evidence

- `node --import tsx --test tests/request-lifecycle-pi.test.ts tests/request-lifecycle.test.ts tests/pi-adapter.test.ts`: 47/47 passed.
- `npm run typecheck`: passed.
- `npm test`: 274/274 passed across 50 suites.
- `npm run test:installer`: 105/105 passed.
- `python -m unittest tests.interop_installer_routing_test tests.installer_test`: 22/22 passed.
- `npm run doctor`: passed; source drift remains diagnostic (`sourceDrift=drifted`) with an actionable update/source-install hint.
- `npm run pi:smoke`: passed.
- `git diff --check`: passed.
- Real source RPC black-box harness reached Pi RPC preflight in an isolated temporary project, returned `No API key found` without misclassifying it as a policy abort, and left the project unmodified.

## Validation commands

```powershell
python -m unittest tests.interop_installer_routing_test tests.installer_test
npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
git diff --check
```

The real-user check uses a fresh temporary project and temporary `DOVE_PI_HOME`/`PI_CODING_AGENT_DIR`; it must verify that local CLI prefixes do not start Pi and that task/state files change only when the corresponding command is run.

## Risky files and rollback points

- `dove_pi.py`: argument routing; rollback if ordinary Pi arguments stop passing through.
- `src/cli.ts`: async error boundary; rollback if JSON-RPC/MCP framing or exit codes change unexpectedly.
- `tests/*`: regression evidence only.
- `README.md`, `README.en.md`: documentation; must not claim behavior not covered by code/tests.
