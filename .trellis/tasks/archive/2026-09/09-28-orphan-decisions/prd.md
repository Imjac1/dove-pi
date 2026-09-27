# A decision the record no longer carries still happened

## Goal

Make the turn reading report decisions that exist in the ledger and name no change in the record, because the design guarantees
they can exist and the current output is silent about them.

## Background: the probe and what it showed

A ledger holding `change.decided` for `chg-9`, beside a snapshot carrying only `chg-1`, produces:

```text
  chg-1   surface tool-implementation
    decision:   (none yet) - the next round has not been observed
```

and **no line anywhere about `chg-9`**. The reading loads the ledger decisions, then prints each one only against the change it
names - so a decision whose change is not in the record **disappears from a reading whose whole subject is what the loop decided**.

**And this is not corruption.** The record is bounded and drops a change whose verdict is still pending, while the ledger is
append-only and keeps it: the two are supposed to disagree, and the record module says so in its own words ("a verdict exists in one
place today... a change whose verdict is still pending falls out of the record"). So the orphan is a **designed** state that nothing
reports.

**Why it matters to a person**: a decision is the loop output. Losing one silently in the reading means an operator can look at a
settled turn and see "none yet", with the evidence of what happened sitting in the file they were told to read.

## Requirements

- **R1 - The reading reports the decisions the record does not carry**, by change id, in its own line - the same rule as the
  unreadable record of a previous round: report what you cannot place rather than folding it into nothing.
- **R2 - The line says which fact it is.** A decision the record dropped is **not** the same as a turn never recorded, and the
  reading must not let the two look alike.
- **R3 - The change own line keeps its meaning.** For a change in the record with no decision, "the next round has not been
  observed" stays true and stays printed.
- **R4 - A test covers it**, with the orphan fixture, asserting both the orphan line and the unchanged line for the change.
- **R5 - The contract records the rule** where the record bounding is already documented.

## Acceptance Criteria

- [ ] **AC1** The reading prints the orphan decisions by id, with a sentence saying what an orphan is.
- [ ] **AC2** The test asserts the orphan line and that `chg-1` still reads as pending.
- [ ] **AC3** Exit 0, and nothing else in the output changes for a ledger with no orphans.
- [ ] **AC4** The contract states that the ledger may hold decisions the record no longer carries, and that the reading says so.
- [ ] **AC5** The gate passes: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Out of scope

- **Reattaching an orphan to a change.** Nothing in the record says which change it belonged to; the id is all there is.
- **Refusing a ledger with orphans.** The state is designed, not corrupt.
- **The other three probes**, whose results are recorded here: the decoder refusing negative resource counts and the reading saying
  so is correct behaviour, and the other two are outside the readings subjects (an unknown acceptance in an observation, and a
  negative count in a resource record nothing reads).
