# The last two project subcommands

## Goal

Run `project bind native` and `project update` in a temporary project, and read what each does.

## Background: the last family with an unrun member

`project` has four subcommands. `init` has been run twice, `doctor` once, and **`bind native` and `update` never**. The task family was
closed in the two previous rounds; this closes the other one, and then no subcommand of any command will be unrun.

**Both of these write**, which is why they are worth running rather than reading: a binding and an update each move state, and neither has
been observed doing it.

## Requirements

- **R1 - Create a temporary project** and run both there, never in this repository.
- **R2 - Record the exit code and output of each.**
- **R3 - Read the state before and after**, and say what each changed.
- **R4 - Try a refusal** where one is available, and record it.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Both are run with their exit codes recorded.
- [x] **AC2** What each changes is stated from the state.
- [x] **AC3** A refusal is provoked and recorded, or the round says why none could be.
- [x] **AC4** The fixture is removed and this repository is untouched.
- [x] **AC5** The gate passes.

## Out of scope

- **Commands needing a Pi host.**
- **Running any of this in this repository.**
- **The first real turn**, which needs the host.