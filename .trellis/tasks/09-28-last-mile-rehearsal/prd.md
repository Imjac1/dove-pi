# The last mile of the guide, rehearsed on a real commit

## Goal

Exercise the chain the turn guide promises at its last step - a commit, its surface, the verifier answer, the decision - on a real
commit of this repository, because that chain has only ever been run by hand.

## Background: what is covered, and the one thing that is not

Each step of the guide, and what exercises it:

| Step | Exercised by |
|---|---|
| 1. Mine | `tests/harness-readings.test.ts` runs both scripts against a ledger on disk |
| 2. Choose a surface | the same suite runs the turn reading; `operation=status` needs the host |
| 3. Record the prediction | the mapper is called directly in `tests/document-drift.test.ts`; the tool needs the host |
| 4. Make the edit as one commit | git |
| 5. Record the application | `tests/pi-adapter.test.ts` drives the tool; the tool needs the host |
| 6. Let the round decide | the same, and the reading asserts a decision from a fixture |
| 7. Print the turn | **run against fixtures only - never against a commit of this repository** |

**And the missing piece is the interesting one.** `harness-rounds.mts` resolves a commit with `git show` in the harness root, so a
real commit of this repository can be handed to it. The guide promises three lines for it: whether the edit stayed inside its declared
surface, what the verifier answer is, and what the round decided. Nothing has asserted those lines against a real commit - only
against synthetic ones and by hand.

**The root commit is the right subject** because it is resolvable in any clone (`git rev-list --max-parents=0 HEAD`) and because it
touches `.agents/skills`, which the declaration maps to the `skill` component. So the same commit is **inside** a `skill` change and
**outside** a `tool-implementation` one - which is exactly the pair of answers the guide describes, and the second is the one a
previous round decided is information rather than a violation.

## Requirements

- **R1 - A test builds the fixture and runs the reading against the root commit**, resolved at runtime rather than hard-coded, so a
  shallow or fresh clone behaves the same way.
- **R2 - Both surfaces are asserted**: a `skill` change reads `inside`, and a `tool-implementation` change reads `outside` with the
  files that were outside.
- **R3 - The verifier and decision lines are asserted** as the guide describes them, including the open-ended forms - `none` for a
  file that holds no verifier code, and a decision line for a change the record carries.
- **R4 - The guide says what to bring back from a run.** It ends at "keep or revert"; nothing says to keep the ledger and the
  convergence record, which are what let a run be read here afterwards.
- **R5 - The gate passes**: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** The test resolves the root commit at runtime and fails clearly if it cannot.
- [ ] **AC2** `inside` and `outside` are both asserted, with the outside files named.
- [ ] **AC3** The verifier and decision lines are asserted.
- [ ] **AC4** The guide names the two artifacts a run should leave behind.
- [ ] **AC5** The gate passes.

## Out of scope

- **Committing inside a test**, which would make the suite write history.
- **The host steps**, which need a Pi host and are covered by the adapter suite.
- **The first real turn**, which needs the host and a formal native task.
