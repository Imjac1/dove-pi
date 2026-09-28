# The other chain that writes state

## Goal

Run the two remaining state-writing commands in a temporary project, and read what they write.

## Background: one writer measured, two left

The last round ran `project init` and the task commands end to end and read the state back. **Two writers were left**: `session record`,
which appends a session to the log that `.dove/sessions.jsonl` belongs to, and `task convergence`, which moves a task through the formal
phases its record describes.

**Both are safe in a temporary project and neither has been executed here.** The convergence chain is the one this session has read most
about - operations, phases, verdicts - and running it once is worth more than another reading.

## Requirements

- **R1 - Create a temporary project** and run the chain there, never in this repository.
- **R2 - Record the exit code and output of each step**, and read the state each one writes.
- **R3 - Hold what they write against what their records declare** - the session log shape, the convergence phase, the revision.
- **R4 - Anything wrong is a finding**, and the fixture is removed afterwards either way.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Each step is run with its exit code and output recorded.
- [x] **AC2** The written state is read back and checked against the declarations.
- [x] **AC3** Anything wrong is reported as a finding.
- [x] **AC4** The fixture is removed and this repository is untouched.
- [x] **AC5** The gate passes.

## Out of scope

- **Commands needing a Pi host**, which this environment does not have.
- **Running either chain in this repository**, which would move its state.
- **The first real turn**, which needs the host.