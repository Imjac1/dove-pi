# Implementation Plan: Dove Pi Multi-Turn Real-User Replay

## Phase 0: Baseline

- [x] Preserve the observed baseline: normal faux runs report `SIGTERM` and
      multiple output files share the same state/session roots.
- [x] Confirm the public RPC behavior for slash-command prompts, EOF shutdown,
      state/stats responses, and continuation requests.
- [x] Add a focused Trellis resolver regression for explicit-but-unmatched
      session identity before using multi-session replay as evidence.
- [x] Keep the current dirty parallel worktree unchanged and isolate all
      generated replay data outside the repository or under task research.

## Phase 1: Harness Lifecycle And Isolation

- [x] Add a unique scenario workspace allocator and ensure provider capture,
      session, state, and project paths all derive from it. Assign an explicit
      synthetic session/context key and keep it stable for all steps in one
      scenario, mirroring Trellis' per-session active-task model.
- [x] Refactor the child event loop around ordered steps while preserving the
      existing one-prompt CLI flags and redaction rules.
- [x] Replace post-settlement force-kill with final evidence requests followed
      by stdin EOF; retain a bounded kill only for timeout/unresponsive cases.
- [x] Make normal host exit and request terminal independent summary fields.

## Phase 2: Multi-Turn Evidence

- [x] Add built-in or JSON-descriptor scenarios for inventory, formal work,
      mode/thinking changes, tool profile changes, and continuation.
- [x] Capture per-step strategy, tool names/count, terminal, provider counters,
      event order, and artifact-isolation facts.
- [x] Record the scenario session key and assert that continuation keeps that
      key while logical request IDs change.
- [x] Add mismatch diagnostics for stale strategy/terminal correlation and
      leaked artifacts or ledger records.

## Phase 3: Evidence-Backed Product Review

- [x] Run the scenario matrix through `python dove_pi.py --offline --mode rpc`
      with the faux provider in isolated temporary projects.
- [x] If a semantic Dove defect is reproduced, patch only the owning boundary
      and add a focused regression; otherwise document intentional behavior.
- [x] Do not change resource ceilings or add new policy decisions in this task.

## Phase 4: Documentation And Quality Gate

- [x] Document the public replay command, descriptor shape, and normal/timeout
      interpretation in both README files.
- [x] Store a bounded redacted before/after evidence summary in task research.
- [x] Run focused black-box tests, full Node tests, typecheck, doctor, Pi smoke,
      and `git diff --check`.
- [x] Review overlapping files hunk-by-hunk so parallel task changes are not
      committed here.

Validation note: focused replay 8/8, resolver 4/4, installer 105/105,
typecheck, doctor, Pi smoke, and diff-check pass. The focused matrix proves
strategy sources, distinct continuation request IDs, isolated runtime roots,
and fast/formal artifact boundaries. Full Node is now 290/290; the earlier two
failures were the unrelated parallel `task-convergence-control` CLI tests and
were fixed by registering that shared `task.py` subcommand. This task only
consumes the resulting green quality gate; it does not own that CLI change.

The no-credential preflight replay still exposes a host-boundary diagnostic
gap: the RPC response is classified as `provider-authorization-denied`, while
Pi's shutdown path records `host-shutdown-preflight`. The harness preserves
both values and marks `terminalConsistency: mismatch`; no unverified Pi hook
was assumed, and no lifecycle policy change is included here.

A separate trusted-provider replay issued twenty successful reads against
different files. Calls 1-12 completed (with the warning at call 6), but call 13
was aborted by the fixed 12-call read-only hard stop despite new observations.
This confirms a productive-work UX defect in the current strategy policy. R5
keeps the ceiling unchanged here; the evidence and break-loop analysis define a
follow-up for a rolling/progress-aware guard and explicit recovery path.

## Validation Commands

```powershell
node --import tsx --test tests/real-dove-blackbox.test.ts
node scripts/real-dove-blackbox.mjs --launcher source --provider faux --scenario <file> --output <dir>
npm test
npm run typecheck
npm run doctor
npm run pi:smoke
git diff --check
```

## Risk And Rollback Points

- EOF behavior may differ across Pi versions; keep timeout fallback and report
  compatibility rather than hiding it.
- Slash-command prompts may be intercepted before `agent_start`; the evidence
  must distinguish command response from model-turn settlement.
- Existing script consumers may depend on summary paths and single-prompt
  flags; preserve those fields and normalize them through the new scenario
  model.
- If a product change is not directly demonstrated by the replay, revert the
  proposed change and retain the evidence as a follow-up finding.
