# One writer for the resource observation

## Goal

Repair a defect the previous task introduced on a false premise, and remove the false premise from the record.

**The defect.** `09-27-resource-observation-producer` was planned on the claim that the ledger observation
(`task.convergence.observed`) had **no producer**. It had one: `extension.ts:2405-2429`, inside
`pi.on("agent_end")`, guarded by `currentRequestPlan && currentRequestTaskId`, writing `stepId: request:<id>` with
the same counters. So the task added a **second** writer (`:1037`, driven per terminal transition from
`appendRequestTerminal`, `stepId: observation:<id>`) instead of filling the actual gap. A real ledger shows both, for
one request:

```
{"kind":"task.convergence.observed","stepId":"request:req_584...","details":{"observationOnly":true,"providerRounds":1,...}}
{"kind":"task.convergence.observed","stepId":"observation:req_584...","details":{"observationOnly":true,"convergenceSkipReason":"no-formal-native-task",...}}
```

**What was actually missing, and is not being removed.** The convergence **event** `request.observed` had no
producer: `toConvergenceEvent` had no case for it, so `observedResources` stayed zero in every live run while the
ledger record was written. That gap was real, and the previous task closed it. Its `observe` operation, its mapping,
and the `convergenceSkipReason` field all stay.

**Why the mistake happened, recorded so the method changes and not just the outcome.** The search was for the
**ledger kind** (`task.convergence.observed`) and for two **guessed method names**
(`appendTaskConvergenceObserved`, `appendRequestObserved`), and neither matched. The real method name
`appendTaskResourceObservation` was never grepped. Searching for the thing one already believes is missing is not the
same as searching for its producer.

## Requirements

- **R1 - One writer, and it is the one that was already there.** Delete the producer added by the previous task:
  the `recordRequestObservation` function and its call in `appendRequestTerminal`, including the attribution guard
  that existed only because the hook fired once per terminal transition rather than once per request.
- **R2 - The convergence event moves beside the surviving writer.** In the `agent_end` block, after the ledger
  observation, record `request.observed` through the provider under the same two conditions the previous task
  established (the record accepts events in this state; a criterion is `in_progress`), and carry
  `convergenceSkipReason` when it does not - so exactly one ledger record states what happened and why.
- **R3 - The spec loses the false statement.** `personal-agent-project-context.md` currently says "nothing emits the
  event and `appendTaskResourceObservation` has no callers". The second clause is false. The corrected entry states
  what was true: the ledger observation was always written; what had no producer was the **event** that turns it into
  a round.
- **R4 - The ledger's duplicate is asserted gone.** The previous task is archived, so the repair is recorded here and
  in the spec; a future reader should see the repair rather than the claim.
- **R5 - The tests assert the single-writer shape.** The host assertions added for the previous task targeted its
  `observation:<id>` stepId and counted two records per request; they move to `request:<id>` and to exactly one.

## Acceptance Criteria

- [ ] **AC1** A request that ends produces **exactly one** `task.convergence.observed` record, with the surviving
      writer's `stepId` (`request:<id>`). **Corrected during the repair:** a request with **no task** (fast lane)
      produces none at all, because the surviving writer is guarded by a plan and a task id - its behaviour, which
      this task does not widen.
- [ ] **AC2** That record still carries the counters, the `acceptanceId` the surviving writer resolves, and a
      `convergenceSkipReason` when the convergence event was not recorded.
- [ ] **AC3** The convergence record's `observedResources` still grows by the request's numbers and the revision
      still advances by exactly one - the property the previous task added, which must survive the repair.
- [ ] **AC4** The surviving writer carries a comment naming it **the** one writer, and AC1's count is what asserts
      that. A source-text test for "exactly one call site" was considered and rejected: it is the class of gate this
      project already withdrew once (`scripts/mode-behaviour-map.mts`), because a text scan reports what it can match
      rather than what is true.
- [ ] **AC5** The spec states the corrected history, names `agent_end` as the only writer and why the terminal hook
      is the wrong site, and records the coverage gap rather than implying full coverage.
- [ ] **AC6** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.

## Out of scope

- **Re-opening the previous task.** It is archived, and its commit history is the record of what happened; this task
  is the record of what was wrong with it.
- **Changing the surviving writer's counters, guard or timing.** It works; the repair is about how many writers there
  are and what the spec says, not about what a request costs.
- **The blackbox script's `at(-1)` selection.** With one record it selects the right one again; if its evidence
  projection needs the `acceptanceId` explicitly, that is a separate observation about the script.
