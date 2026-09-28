# The authorisation table and what holds it

## Goal

Name the test that holds each row of the authorisation table, read rather than guessed.

## Background: the safety table, and rows that were run but never recorded

The refusal table gained a `Held by` column last round. **The authorisation table is the other one, and it is the safety one**: four entry
points, each with the trusted source that may authorise a side effect. **This session ran four of those rows** - the CLI flag, the adapter
callback, the rpc path with no approver, and the read-only switch - **and never recorded what keeps them true**.

**So the work is reading, not inventing**: find the test that goes red for each row, by looking, and leave a row unheld rather than give it a
plausible neighbour.

## Requirements

- **R1 - Read the holders**, by searching the tests for what the row says rather than for a name.
- **R2 - Write them into the table** the way the refusal table carries them.
- **R3 - Leave any row unheld and marked** rather than given a neighbour.
- **R4 - The existing pointer check must still pass**, and cover the new paths if it does not already.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Each row is held against a test, read not guessed.
- [x] **AC2** The holders are written into the table.
- [x] **AC3** Any unheld row is marked as such.
- [x] **AC4** The pointer check passes and covers the new paths.
- [x] **AC5** The gate passes.

## Out of scope

- **Judging whether a test truly holds a row**, which needs a reader.
- **Changing the behaviour the table describes.**
- **The first real turn**, which needs a Pi host.