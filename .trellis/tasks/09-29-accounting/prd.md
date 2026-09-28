# What this span actually changed, counted

## Goal

Count what this span changed in the source, the tests and the specifications, from git rather than from memory.

## Background: an accounting is what is left to do

Two rounds concluded that the reachable work is done, and one measured the last unresolved thing - a transient test failure that did not
reproduce. **So the honest use of a round is an account rather than a search**, and the account should come from the repository: what files the
span touched, and how much.

**The session own records name many changes; this round counts them.**

## Requirements

- **R1 - Find the span first commit**, and say how it was identified.
- **R2 - Count the changed files** in the source, the tests and the specifications, separately.
- **R3 - Count the additions and deletions**, and say what the largest single change was.
- **R4 - Say whether the count matches what the records claim**, including any claim it does not support.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The span boundary is identified and stated.
- [x] **AC2** The counts are recorded by area.
- [x] **AC3** The largest change is named.
- [x] **AC4** The count is held against the records claim.
- [x] **AC5** The gate passes.

## Out of scope

- **A change made to make a count look better.**
- **The first real turn**, which needs a Pi host.