# The third module, measured

## Goal

Decide, with numbers, whether the refactor the previous round named as the way forward is worth doing - and close the
thread either way.

## Background: the measurement

Use sites in `task-convergence.ts` (the record) and `harness-verifier.ts` (the verifier), counted per name:

| Name | record | verifier |
|---|---|---|
| `invalid` | **74** | 0 |
| `GENERIC_ID_PATTERN` | 10 | 0 |
| `CHANGE_OBSERVABLES` | 5 | 0 |
| `ACCEPTANCE_STATUSES` | 5 | 0 |
| `ACCEPTANCE_ID_PATTERN`, `SHA256_PATTERN`, `TaskConvergenceValidationError` | 4 each | 0 |
| `VERIFICATION_STATES`, `GATE_LABELS`, `MAX_CHANGES`, `movementFromParts` | 3 each | 0 |
| `movementKey` | 2 | 2 |

**Three things follow, and the third is the one that decides it.**

1. The vocabulary is shared in name but not in weight: the record uses the refusal constructor **74 times**, so pulling it
   anywhere is a change to the record, not a move of a helper.
2. The movement vocabulary cannot be lifted cleanly either: `movementFromParts` validates against `CHANGE_OBSERVABLES` and
   the movement types, so a module holding it would import the record while the record imports it - a cycle, tolerable for
   **types** and not for **values**.
3. **The payoff is tidiness.** The declaration already states the limit, with the measured reason, and the reading answers
   `possible` with the symbols named. Extracting the tail would empty `verifier.embedded` - a tidier list - at the cost of
   editing a 1,100-line module vocabulary that 74 call sites depend on, with no behaviour change and no new answer.

## Requirements

- **R1 - The decision is written with the numbers, where the next attempt reads it**: the boundary contract and the
  declaration comment, so a third attempt starts from the measurement rather than from the plan.
- **R2 - The thread is closed, not parked.** The contract says what would reopen it - splitting the record module for a
  reason of its own, at which point the vocabulary comes apart as part of that - rather than "revisit later".
- **R3 - Nothing about the code changes.** A decision that a refactor is not worth doing costs nothing to act on, and the
  suite and the readings are unchanged - which is what makes it verifiable.
- **R4 - The measurement is reproducible.** The script that counted the sites is not kept, so the numbers are recorded with
  the method that produced them: a count of non-comment lines matching the name, per module.

## Acceptance Criteria

- [ ] **AC1** The boundary contract carries the decision, the numbers, and what would reopen it.
- [ ] **AC2** The declaration comment says the same in one sentence, because that is where a reader looking at the map
      arrives.
- [ ] **AC3** No source file changes: the diff is specifications and comments, and the suite plus the three readings still
      pass.
- [ ] **AC4** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.

## Out of scope

- **Doing the refactor.** That is the decision this task refuses, with reasons.
- **A cheaper variant** - exporting the vocabulary and importing it one way - which the numbers also argue against: 74 call
  sites do not become cheaper by changing who imports the constructor.
- **The Pi-hosted turn.**
