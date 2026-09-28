# Chasing the flake, with the output kept this time

## Goal

Establish whether the transient failure reproduces, and if it does, which test it is.

## Background: a failure with no attribution, and a procedure that failed alongside it

A previous round ran the gate and saw *754 pass, 1 fail*. The re-run saw *755 pass, 0 fail*. **Which test flaked is unknown, because the saved
output was overwritten by the re-run before it was read** - so the round recorded an unexplained transient, and its own procedure was at fault
twice: it committed on a red gate, and it destroyed the evidence.

**A flake is a real defect class and this environment can chase it**: run the suite repeatedly, save every output *before* the next run, and see
whether it reproduces.

## Requirements

- **R1 - Run the full suite repeatedly**, saving each output before the next run starts.
- **R2 - Record every run own totals**, and whether any failed.
- **R3 - If one fails, name the test and read its failure** before doing anything else.
- **R4 - Say whether the flake reproduced**, and if not, how many runs were clean.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Each run own output is saved before the next begins.
- [x] **AC2** Every run totals are recorded.
- [x] **AC3** A failure, if any, is attributed to a named test.
- [x] **AC4** The round says whether it reproduced.
- [x] **AC5** The gate passes.

## Out of scope

- **Fixing a test that has not been shown to fail.**
- **Changing anything to make the flake go away.**
- **The first real turn**, which needs a Pi host.