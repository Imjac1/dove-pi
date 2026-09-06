# Dove Pi native subagent dispatch

## Goal

Make Dove Pi's existing dispatch abstraction execute real isolated Pi background work through a reviewed adapter, with bounded lifecycle, result recovery, fallback, and black-box verification.

## Requirements

- **R1 Provider contract:** Core exposes a host-neutral `SubagentProvider` contract for launching, observing, cancelling, and collecting one isolated child run. Core must not import Pi or a third-party extension.
- **R2 Pi adapter:** The Pi adapter launches a separate Pi child through a fixed argv runner with a read-only tool allowlist and inherited user-owned provider configuration. The adapter must not invoke another extension's private `execute` function. `pi-background-tasks` remains an explicit user-facing background capability until a public host bridge is available.
- **R3 Policy integration:** Existing `inline`, `subagent`, and `parallel` decisions remain deterministic. A `subagent` decision uses the provider only when isolation is declared and a provider is available; otherwise it records an explicit fallback to inline. No token, elapsed-time, or tool-call hard ceiling is introduced.
- **R4 Lifecycle:** Every dispatched run has one launch and exactly one terminal completion in the execution ledger. Results are deduplicated by dispatch id.
- **R5 Workspace safety:** The first provider capability is read-only investigation. It cannot mutate the parent workspace, delegate recursively, use network access, or inherit ambient extensions. Writable subagents are separate work.
- **R6 Recovery:** Cancellation, provider failure, malformed result, provider timeout, and host shutdown return typed failure details. A partially completed child is never silently replayed.
- **R7 User experience:** Add `/subagent` status/help diagnostics and a doctor projection showing provider availability, active runs, last terminal state, and fallback reason. Short requests do not create child sessions.
- **R8 Real-use verification:** Add a deterministic fake-provider matrix, a Pi host adapter test using registered tool stubs, and an opt-in managed black-box run. Tests do not require a live account.
- **R9 Documentation:** README files distinguish automatic dispatch from explicit delegation, document read-only scope and fallback semantics, and state that full write-capable orchestration is not stable yet.

## Acceptance Criteria

- [x] **AC-001 Core isolation:** Core remains usable without a provider and imports no Pi or `pi-background-tasks` module.
- [x] **AC-002 Real Pi delegation:** A healthy managed Pi CLI launches one read-only child with fixed argv and returns its verified result.
- [x] **AC-003 Safe fallback:** Missing/degraded tools run inline, record `provider_unavailable`/`fallback_inline`, and never report a false subagent success.
- [x] **AC-004 Terminal integrity:** Success, error, cancellation, malformed result, and duplicate terminal events each produce one settled correlated completion.
- [x] **AC-005 Read-only boundary:** Write, shell, network, and recursive-delegation capabilities are rejected before launch.
- [x] **AC-006 No artificial ceilings:** High observed resource metrics do not change dispatch route or convergence state.
- [x] **AC-007 UX and diagnostics:** Doctor/status expose bounded provider health and subagent state without prompts or secrets.
- [x] **AC-008 Real-user smoke:** Managed launcher proves one delegated investigation and one unavailable-provider inline fallback.
- [x] **AC-009 Release discipline:** Focused tests, full Node tests, typecheck, installer tests, doctor, Pi smoke, and Trellis validation pass.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
