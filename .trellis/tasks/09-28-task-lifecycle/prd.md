# The task lifecycle, moved through rather than read

## Goal

Run the commands that move a task through its lifecycle, in a temporary project, and read what each one changes.

## Background: the reads were run, the mutations were not

One round ran `task create`, `status` and `list`; another ran `task convergence status`. **The commands that move a task - `start`,
`finish`, `archive`, and `verify` - have never been executed here**, and they are the ones the model is built on: every phase the state file
carries is written by one of them.

**A read that works says nothing about a write that works**, and this is the same distinction the last two rounds kept drawing.

## Requirements

- **R1 - Create a temporary project** and run the lifecycle there, never in this repository.
- **R2 - Record the exit code and output of every step**, and read the state after each mutation.
- **R3 - Observe the transitions**: the status and phase the state carries before and after each command.
- **R4 - Try one refusal**: a lifecycle command on a task that does not exist, or in the wrong order.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Each step is run with its exit code recorded.
- [x] **AC2** The state is read after each mutation, and the transitions are stated.
- [x] **AC3** A refusal is provoked and recorded.
- [x] **AC4** The fixture is removed and this repository is untouched.
- [x] **AC5** The gate passes.

## Out of scope

- **Commands needing a Pi host.**
- **Running any of this in this repository.**
- **The first real turn**, which needs the host.