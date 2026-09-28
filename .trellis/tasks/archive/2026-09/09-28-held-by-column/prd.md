# The promises and the tests that hold them, written down

## Goal

Write the promise-to-holder mapping into the specification, and add a check that every pointer resolves.

## Background: a count with no reader

Two rounds established that each of the ten promises in the refusal table has an implementation and a holder, by reading. **That result lives
in two archived tasks and is a count** - and this project own rule is that a count of what the code declares is a claim with no reader, while a
count a test holds is the good kind.

**The durable form is a pointer**: each row names the test that holds it, so someone changing the behaviour can see what will go red. **What
a check can hold is that the pointers resolve**, not that the tests truly hold the promises - that judgement needs a reader, and the check must
say so rather than implying otherwise.

## Requirements

- **R1 - Add the holder to each row** of the refusal table, naming the test file and the case.
- **R2 - Add a check that every test path named in that specification resolves**, with a negative control.
- **R3 - The check says what it does not claim** - that a pointer resolving is not a promise being held.
- **R4 - Any row whose holder is genuinely absent** is left unheld and marked as such, rather than given a plausible neighbour.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Each row names its holder.
- [x] **AC2** A check holds every named path, and its negative control was run.
- [x] **AC3** The check says what it does not claim.
- [x] **AC4** Rows without a holder are marked, not guessed.
- [x] **AC5** The gate passes.

## Out of scope

- **Judging whether a test truly holds a promise**, which no check can do.
- **Rows of other tables**, unless the same work is needed there.
- **The first real turn**, which needs a Pi host.