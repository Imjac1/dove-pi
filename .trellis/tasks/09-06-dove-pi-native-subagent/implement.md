# Implementation Plan: Dove Pi Native Subagent Dispatch

## Slice 0: Freeze Contract

- [x] Add the PRD/design and routed backend specs in `implement.jsonl`.
- [x] Add a deterministic lifecycle fixture for success, fallback, failure,
  cancellation, malformed result, and duplicate terminal events.
- [x] Checkpoint before Pi adapter code.

## Slice 1: Core Provider And Dispatcher

- [x] Implement bounded `SubagentProvider` types and terminal normalization.
- [x] Extend `DispatchWork` with an optional provider while preserving
  `runSubagent` compatibility.
- [x] Make provider-unavailable/failure behavior explicit and ledger-correlated.
- [x] Add pure tests proving no-provider inline behavior and observation-only metrics.

Checkpoint: Core tests and typecheck pass without Pi or extension imports. Focused
evidence: `tests/core.test.ts` 21/21 and `npm run typecheck`.

## Slice 2: Isolated Pi Child Adapter

- [x] Resolve the managed Pi CLI contract in a testable fixed-argv runner.
- [x] Launch a child with only `read,grep,find,ls`; pass prompt/model/provider as
  separate validated argv values, never shell text.
- [x] Capture bounded stdout/stderr, cancellation, exit code, and terminal answer with
  a settled latch.
- [x] Test healthy, missing executable, CLI drift, failed, cancelled, malformed, and
  duplicate cases.

Checkpoint: fixed-argv runner tests pass with fake child processes. Evidence:
`tests/pi-subagent-provider.test.ts` 3/3 and `npm run typecheck`.

## Slice 3: Request Integration And UX

- [x] Add an explicit `agent_subagent` tool and `/subagent` status/help while leaving
  ordinary requests unchanged. Automatic formal dispatch remains deferred until a
  safe request lifecycle hook exists.
- [x] Add bounded doctor diagnostics for provider health.
- [ ] Record provider availability, fallback, launch, and terminal evidence in the
  automatic formal dispatch path.
- [x] Update both READMEs with automatic versus explicit delegation semantics.

Checkpoint: explicit Pi subagent tool and lifecycle tests pass. Automatic request
dispatch is intentionally deferred because Pi does not expose a safe hook for
replacing an in-flight model turn with another extension's child executor.

## Slice 4: Real-Use Verification

- [x] Extend the managed black-box harness with delegated investigation and
  unavailable-provider fallback.
- [x] Run the managed launcher and confirm no `Operation aborted` is misattributed.
- [x] Run focused tests, full Node tests, typecheck, installer tests, doctor,
  Pi smoke, Trellis validation, and `git diff --check`.

Checkpoint: every subagent acceptance criterion has evidence; no write-capable
behavior is advertised.

Evidence: the managed launcher was refreshed from this checkout as
`0.2.0+source.d3aea1c686b0`; a real RPC replay with `--subagent-case delegated`
exited cleanly (`exitCode=0`, `signal=null`) and captured the fixed read-only
argv (`--no-extensions`, `--tools read,grep,find,ls`). A second replay with an
unavailable child also exited cleanly, returned a structured unavailable tool
result, and captured no child launch. Neither path produced an `Operation
aborted` terminal.

## Slice 5: Release Decision

- [ ] Review `pi-background-tasks` version drift separately; do not upgrade it here
  without a dedicated compatibility run.
- [ ] Include completed subagent slices in the release batch only after a clean tree
  and passing `release:check`.
- [ ] Defer writable agents, worktree merge, nested orchestration, and hard budgets
  to separate tasks with fresh real-run evidence.
