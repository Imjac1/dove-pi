# The task command chain in a temporary project

## Goal

Run the CLI chain that writes state, in a temporary directory, and see whether it works end to end.

## Background: the one functional test this environment allows

A previous round ran the read-only commands and they answered. **The commands that write state have never been run here**: `project init`
creates the native state, `task create` adds a record, `task status` reports one, `task list` lists them. Everything the project has measured
about these is documentary - the paths they name, the statuses they set, the switches they accept - and none of it is a run.

**In a temporary directory the chain is safe to run**, and it exercises the provider, the state files and the CLI together. That is as close
to an end-to-end as this environment gets, and it has not been done.

## Requirements

- **R1 - Create a temporary project** and run the chain there, never in this repository.
- **R2 - Record the exit code and the output of each step**, not a summary of it.
- **R3 - Read the state the chain writes**, and hold it against what the commands said they did.
- **R4 - Anything wrong is a finding**, and the fixture is removed afterwards whether it passed or failed.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Each step is run with its exit code and output recorded.
- [x] **AC2** The written state is read and checked against the reports.
- [x] **AC3** Anything wrong is reported as a finding.
- [x] **AC4** The temporary project is removed, and this repository is untouched.
- [x] **AC5** The gate passes.

## Out of scope

- **Running the chain in this repository**, which would move its state.
- **The commands that need a Pi host**, which this environment does not have.
- **The first real turn**, which needs one.