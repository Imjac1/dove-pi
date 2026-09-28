# The convergence operations, run rather than read

## Goal

Run the convergence operations in a temporary project and read what each one writes.

## Background: the most-read machinery and the least-run

Across this session the convergence record has been read, audited, declared about and tested - operations, phases, verdicts, the arm fields,
the orphan decisions. **The operations themselves have never been run here**, and only `status` has even been invoked.

**Reading a state machine is not running one.** The transitions are the thing, and the only way to see them is to make them happen.

## Requirements

- **R1 - Read the operations the command accepts**, before running any of them.
- **R2 - Run each operation** in a temporary project, and record the exit code and output.
- **R3 - Read the record after each**, and state the transition it made.
- **R4 - Try one operation out of order**, and record what it says.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The accepted operations are listed before any is run.
- [x] **AC2** Each is run with its exit code recorded.
- [x] **AC3** The record is read after each, and the transitions are stated.
- [x] **AC4** An out-of-order operation is tried and recorded.
- [x] **AC5** The gate passes.

## Out of scope

- **The verdict machinery**, which needs a change manifest and a run.
- **Operations needing a Pi host.**
- **The first real turn**, which needs the host.