# The per-round score the contract asks for

## Goal

Make the decision the contract leaves open - where a per-round score comes from - and then make the third axis computable with it.

## Background: the contract names the change and says it is a decision

`UNCOMPUTABLE_AXES` declares ITQ - slope, acceleration, stagnation escape rate - uncomputable, and its evidence is exact:

```text
reason:     it needs a per-round score, and no round score is persisted: the criterion vector exists only in a checkpoint, and a
            convergence decision records the operation and the state but not the criterion statuses.
evidence:   appendTaskConvergenceDecision records eventKind, state, snapshotRevision, acceptanceRevision and acceptanceId -
            so a progress decision reads the same whether it started, passed or failed a criterion.
wouldNeed:  the criterion vector carried on the observation the request terminal already writes, which would make each round a
            record. That is a decision of its own.
```

## The decision

**The vector belongs on the convergence decision record, not on the observation.**

| | Decision record | Observation record |
|---|---|---|
| written | at the round boundary, by the reducer read | per settled request, by the host |
| subject | the convergence contract, which owns goal state | resource measurements - tokens, rounds, elapsed time |
| already carries | `snapshotRevision`, `state`, `acceptanceId` | `toolCalls`, `providerRounds`, `elapsedMs` |

**Three reasons, in the order they decided it.** The decision record is *already* the round-boundary record, so a vector there makes
each round a record without adding a second one. It is owned by the *convergence contract*, which is where goal state lives, while the
observation is the *resource* record - and a previous round wrote the rule that resources are observation-only, which mixing goal
state into them would undermine. And the decision record is written by the code that has the snapshot in hand, so the vector it
carries is the reducer own read rather than a second interpretation of the same state.

**What this does not do**: it does not add an observable. The closed set a manifest predicts stays behaviour-shaped; a criterion
vector is a *record of what the criteria were*, not a fourth thing to predict.

## Requirements

- **R1 - The convergence decision record carries the criterion vector** and the no-progress count, so a round is a record.
- **R2 - The host passes them** from the snapshot it already reads - not from a second read of the record.
- **R3 - The axis computes ITQ from that sequence**: the passed-criterion count per round, the slope between the first and last, and
  the stagnation escape rate - an escape being a round where the no-progress count falls after a stagnation.
- **R4 - ITQ leaves `UNCOMPUTABLE_AXES`**, and the Pareto entry stays with its reason unchanged.
- **R5 - Tests**: the ledger record carries what was passed to it, the axis computes each of the three numbers on a constructed
  sequence, and the existing suites pass unchanged.
- **R6 - The contract records the decision** in the convergence record specification, where the decision record is documented.

## Acceptance Criteria

- [ ] **AC1** The appender takes the vector and the counter, and writes them.
- [ ] **AC2** The host passes them from the snapshot it read.
- [ ] **AC3** The axis returns the three numbers, with a test on a constructed sequence and a stated answer for an empty one.
- [ ] **AC4** `UNCOMPUTABLE_AXES` holds one entry, the Pareto one.
- [ ] **AC5** The decision and its three reasons are in the convergence record specification.
- [ ] **AC6** The gate passes: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Out of scope

- **A target or a floor for ITQ**, which is a threshold and belongs to whoever sets one.
- **The Pareto axis**, which needs a second objective and a decision about its frontier.
- **The first real turn**, which needs a Pi host.
