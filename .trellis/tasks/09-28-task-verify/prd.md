# The three subcommands left unrun

## Goal

Run `task current`, `task continue` and `task verify` in a temporary project, and read what each does.

## Background: the tail of a scope the last round set

The last round ran `create`, `start`, `finish`, `status` and `archive`, and its requirements named `verify` without running it. **Seven of
the ten task subcommands have now been executed here; three have not**, and one of them is the command that connects a task to the
convergence record - the machinery this session has read most about and run least.

**Reading a command is not running it**, which is the distinction the last three rounds kept drawing, and it applies to this one just the
same.

## Requirements

- **R1 - Create a temporary project** and run all three there, never in this repository.
- **R2 - Record the exit code and output of each.**
- **R3 - Observe what each changes**, by reading the state before and after.
- **R4 - Try a refusal** if one of the three offers a way to provoke it.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Each of the three is run with its exit code recorded.
- [x] **AC2** What each changes is stated from the state, not from the output.
- [x] **AC3** A refusal is provoked and recorded, or the round says why none could be.
- [x] **AC4** The fixture is removed and this repository is untouched.
- [x] **AC5** The gate passes.

## Out of scope

- **Commands needing a Pi host.**
- **Running any of this in this repository.**
- **The first real turn**, which needs the host.