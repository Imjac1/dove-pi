# A refusal that says which gate refused

## Goal

Make the approval refusal say whether approval was not granted or no approver is configured.

## Background: a boolean that loses the reason

The last round named the second gate: the invocation service asks an `authorize` callback, and when none is registered it falls through to
false. **The caller sees one bit either way**, so both refusals arrive as the same status and the same sentence - *Capability approval was not
granted* - which is true of one gate and misleading about the other.

**So the work is not the message; it is making the reason survive the trip.** The callback returns a boolean today, and whatever carries the
denial upward has to carry which condition failed with it.

## Requirements

- **R1 - Read how a denial travels** from the callback to the response, before changing anything.
- **R2 - Make the reason travel**, at the smallest size that does so.
- **R3 - The message names the gate**: no approver configured, or approval not granted.
- **R4 - The status vocabulary is unchanged**, which the previous round put out of scope.
- **R5 - A test holds both messages**, because a distinction nothing asserts is a distinction that drifts.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The path a denial takes is read and stated.
- [x] **AC2** The reason travels, and both messages are observed in a run.
- [x] **AC3** The status is unchanged.
- [x] **AC4** A test holds both.
- [x] **AC5** The gate passes.

## Out of scope

- **The status vocabulary**, which would be a larger change.
- **Approval flows through a Pi host.**
- **The first real turn**, which needs the host.