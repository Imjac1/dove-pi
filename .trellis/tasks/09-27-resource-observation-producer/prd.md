# Make the resource observation real: the host records what a request cost, where the record says it does

## Goal

Wire an inert path end to end. The convergence record has a resource-observation kind, the ledger has a writer for
it, and the spec describes it as working - and **none of the three is connected**:

- `toConvergenceEvent` (`src/project-provider/native-provider.ts:293-321`) has **no case** for `request.observed`,
  and no operation produces it. The event kind exists in the union (`src/core/task-convergence.ts:100`), in the
  decoder and in the reducer, and nothing emits it.
- `appendTaskResourceObservation` (`src/core/execution-ledger.ts:374`) has **no callers**.
- `execution-ledger.ts:58-70` reads `task.convergence.observed` records for diagnostics, so that read is always
  empty.
- Therefore `TaskConvergenceSnapshot.observedResources` is zero in every live run, and the spec line that says
  "`request.observed` records tool/provider/time/token observations only" describes a pipeline that does not run.

**Why this is worth a task rather than a note.** It was found while building the change manifest, whose round
boundary first depended on this event; the manifest now takes its boundary from the read itself, so nothing is
blocked. What is left is worse than a missing feature: **a record and a specification both claim an observation
exists, and the numbers a harness would need to improve itself are the ones being dropped.** The four-piece scaffold
needs a real "what did that round cost" to mine failures from, and D6 needs it to score a variant.

## Background: the numbers are already here

Nothing has to be measured for this. The host keeps, per request, exactly what `TaskResourceObservation` names
(`src/pi-adapter/extension.ts:836-839`):

```
currentRequestProviderRounds, currentRequestToolCalls, currentRequestStartedAt,
currentRequestStopReasons, currentRequestToolDurationMs, currentRequestResources
```

and one place already assembles them into the shape this task needs (`:1041-1051`, inside `currentStrategySnapshot`):
`{ toolCalls, toolDurationMs, elapsedMs, inputTokens, cacheReadTokens, cacheWriteTokens, outputTokens,
reasoningTokens, stopReasons }`. The token fields accumulate at `:2772` (`accumulateRequestUsage`), and the counters
reset at `:2396`, `:2442` and `:2986`.

The natural producer is `appendRequestTerminal` (`:962`), which runs **once per request terminal**, already writes
the ledger `request.terminal` record, and has every one of those variables in scope.

## Requirements

- **R1 - The host records the observation once per request terminal.** In `appendRequestTerminal`, for a **formal
  native task only**, write the ledger `appendTaskResourceObservation` and record `request.observed` on the
  convergence record. Both, from the same read, so the ledger and the snapshot cannot disagree about a round.
- **R2 - The observation is bound to the active criterion, and is skipped when there is none.** The record
  invariant is that every event carries an **existing** `acceptanceId` (`reduceTaskConvergence` calls
  `requireKnownAcceptance` before the branch). An observation is not product work, but the invariant is what makes
  an event attributable, so the observation attaches to the criterion that is `in_progress` and **is skipped when
  no criterion is active** rather than inventing one. The skip is counted and visible, not silent.
- **R3 - The observation never changes semantic state.** It adds resources and a revision, and touches no criterion,
  finding, completed step, state or checkpoint - which is what the spec already promises and what
  `observationOnly: true` in the ledger record means.
- **R4 - The ledger record and the snapshot read the same numbers.** One assembly of the observation object, used
  twice, so a future field cannot be added to one and forgotten in the other.
- **R5 - The spec stops calling the path inert, and states the skip rule.** The annotation added on
  `2026-09-27` is replaced by the contract: what is recorded, when, bound to what, and what happens when no
  criterion is active.

## Acceptance Criteria

- [ ] **AC1** After a request terminal in a formal task, the convergence snapshot `observedResources` has grown
      by the tool calls, provider rounds and elapsed time that request took, and the revision has advanced.
- [ ] **AC2** The same terminal writes one `task.convergence.observed` ledger record, and the diagnostics reader
      (`execution-ledger.ts:58-70`) returns it.
- [ ] **AC3** No criterion, finding, completed step, run state or checkpoint changes: a snapshot diff before and
      after shows only `observedResources` and `revision`.
- [ ] **AC4** A terminal with no `in_progress` criterion records nothing on the convergence record, still writes the
      ledger observation, and the skip is visible (a typed reason in the ledger record), not silent.
- [ ] **AC5** A non-formal task (or no task) writes no convergence record, and behaviour is otherwise unchanged.
- [ ] **AC6** The observation object is assembled once and consumed twice (a test asserts the ledger record and the
      snapshot agree on the same terminal).
- [ ] **AC7** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.
- [ ] **AC8** The spec describes the live contract, including the skip rule, and no longer calls the path inert.

## Out of scope

- **Re-pointing the change manifest round boundary at this event.** It takes its boundary from the read revision
  and that works; a narrower boundary is now *possible* and that is a separate decision with its own evidence.
- **Using the resources to decide anything.** The spec is explicit: observations never decide convergence, and no
  threshold is added here.
- **Per-criterion or per-tool attribution of the resources.** The observation is per request, as the record defines
  it. Splitting it further needs its own design.
- **A CLI surface for the observation.** `dove-pi task convergence` authors operations; an operator-authored
  observation is not needed by any criterion here.
