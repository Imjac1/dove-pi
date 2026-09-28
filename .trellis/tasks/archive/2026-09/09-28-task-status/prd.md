# The status a task records and the place it sits

## Goal

Hold the status each `task.json` records against the directory the task sits in.

## Background: two records of one fact

A task says where it is twice: the directory says active or archived, and `task.json` says a status. **The two can disagree**, and a task
that was archived while its status was never updated is a record that contradicts its own location - which a reader trusts, because both
halves look authoritative.

**This is the same shape as the last two rounds**, one layer further in: not a document, not a curated pointer, but the state file the tool
itself writes.

## Requirements

- **R1 - Read every `task.json`** across the active tasks and the archive, and record the status each declares.
- **R2 - Compare each status with the directory**, and report every disagreement.
- **R3 - Read what the disagreement means** before deciding what to do: a status the tool sets at a point in the lifecycle may be a stage
  rather than a contradiction.
- **R4 - Anything wrong is fixed at the side that is wrong**, and a disagreement that is by design is recorded as such.
- **R5 - A check is added only if it is not a weaker duplicate** of the ones holding the surfaces above.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Every task is read, and the statuses are counted.
- [x] **AC2** Every disagreement is reported with the task and its status.
- [x] **AC3** Each disagreement is classified by reading, not by the status name alone.
- [x] **AC4** Anything wrong is fixed, or recorded with its reason.
- [x] **AC5** The gate passes.

## Out of scope

- **The status vocabulary**, which the tool defines.
- **Other fields in the same file**, which say when and where rather than whether.
- **The first real turn**, which needs a Pi host.