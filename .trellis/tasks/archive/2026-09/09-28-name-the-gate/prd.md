# Naming the gate that refuses a write

## Goal

Name the gate that refuses a writing capability which arrives with approval granted.

## Background: the step the last round named and did not finish

The last round measured both sides of the approval boundary and found that `granted` opens it for a read-only capability and not for a
writing one, with `approval_denied` as the status either way. **It said the next step was to name the second gate**, and this is that step.

**Two sources, and they check each other**: every place in the code that produces `approval_denied`, and the refusal envelope from a run,
which the last round intended to read and did not reach.

## Requirements

- **R1 - Find every place `approval_denied` is produced** in the code, with its line.
- **R2 - Read the run refusal** through the rpc interface, with the error field intact.
- **R3 - Name the gate**, and say whether the two sources agree.
- **R4 - If they do not name one gate, say what they name instead** rather than forcing an answer.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Every producer of the status is listed.
- [x] **AC2** The run refusal is read with its error field.
- [x] **AC3** The gate is named, or the round says why it cannot be.
- [x] **AC4** The two sources are compared.
- [x] **AC5** The gate passes.

## Out of scope

- **Changing the status vocabulary**, which would be the fix if the two gates are indistinguishable.
- **Approval flows through a Pi host.**
- **The first real turn**, which needs the host.