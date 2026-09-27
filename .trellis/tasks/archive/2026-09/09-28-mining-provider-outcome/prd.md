# The mining half reads the provider outcome

## Goal

Close a **measured** blind spot in the mining half: the mechanism of the most common real failure does not reach the
record the mining reads. The suite already measures it; this makes the reading look in the second place.

## Background: the measurement, and where it led

The black-box suite asserts, of a run against an unauthenticated provider:

```
rpcFailure.terminal.code      = "provider-authorization-denied"
ledgerTerminal.terminal.code  = "host-shutdown-preflight"
terminalConsistency           = "mismatch"
diagnosticGap                 = "rpc-error-not-preserved-in-ledger"
```

So the client learned the cause and the ledger did not. Chasing it further changed the answer twice:

1. **The path is honest.** `request-lifecycle.ts:287-294` closes an initial input that never reached
   `before_agent_start` with `startup-failed` / `host-shutdown-preflight`, because that is what Dove observed: Pi
   rejected the request in preflight and the host then shut down. Two boundaries, two true statements.
2. **The mechanism is in the ledger after all, under a different record kind.** `provider.request.completed` carries
   `stopReason` and `usage.httpStatus` (`execution-ledger.ts:296`) and `provider.request.rejected` carries a
   diagnostic (`:300`), both correlated by request id. The mining half reads only the terminal envelope, so it names
   `host-shutdown-preflight` for a failure whose cause the ledger knows.

**And the corpus cannot show either of these.** Every ledger that contains a failure is discarded: the black-box suite
creates its state with `mkdtemp` and removes it in `finally`, while the runs the corpus keeps are the ones that did not
fail. That is the preservation gap the corpus reading reports (`scripts/harness-corpus.mts`), and it is why this task is
planned from the suite assertion rather than from a mined failure.

## Requirements

- **R1 - The failure record carries the provider outcome as well.** `FailureRecord` gains an optional `provider`: the
  last provider record for that request - its `stopReason`, its HTTP status, its diagnostic if it was rejected.
- **R2 - Two vocabularies are kept apart, not merged.** The terminal code is Dove own; the provider outcome is the
  provider own. The record reports both and **does not invent a third name** for them, because a merged code would
  claim a translation nobody performs - and the honest statement is that the ledger holds two facts about one failure.
- **R3 - It is additive and it never invents.** A request with no provider record gets no `provider`; a provider record
  without a status keeps its stop reason; the reading still emits a record for a failure it can only classify from the
  terminal.
- **R4 - The reading prints it.** `scripts/harness-failures.mts` shows the provider outcome beside the mechanism, and
  the corpus reading shows it for each failure it aggregates.
- **R5 - The boundary is recorded, not worked around.** The manifest observables (criterion status, verification state,
  refusal counts) cannot express "this failure is now named correctly", so this class of edit cannot be judged by the
  loop verdict machinery yet. That is a finding about the instruments, and it is written down where the loop is
  specified rather than left implicit.

## Acceptance Criteria

- [ ] **AC1** A request whose terminal says `host-shutdown-preflight` and whose provider record says an error with an
      HTTP status produces a failure record carrying **both**, with no third code invented.
- [ ] **AC2** A failure with no provider record carries no `provider` field, and the record is otherwise unchanged.
- [ ] **AC3** A `provider.request.rejected` diagnostic is carried as well as a completed-with-error status.
- [ ] **AC4** The provider outcome is matched by request id, never by ledger position.
- [ ] **AC5** The failure script and the corpus reading print it.
- [ ] **AC6** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.
- [ ] **AC7** The loop specification records the second place the mechanism lives, and the observable boundary that
      keeps this class of edit unjudgeable for now.

## Out of scope

- **Changing the ledger terminal.** `startup-failed` / `host-shutdown-preflight` is what Dove observed, and rewriting
   it would be claiming someone else observation.
- **Preserving the failing runs.** The preservation gap is measured by the corpus reading; which runner should keep its
   state is its own decision.
- **Widening the manifest observables** so this class of edit becomes judgeable. That is the next question, and it
   needs the finding recorded first.
