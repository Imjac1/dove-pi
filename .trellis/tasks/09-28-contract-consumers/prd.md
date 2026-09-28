# Who else reads the contract I changed

## Goal

Find every consumer of the `authorize` contract the last round widened, and check that none of them reads a reason as success.

## Background: a contract change is a change to everyone who reads it

The last round let `authorize` return a reason string as well as a boolean, so a refusal can name its gate. **A truthiness check on that
return value now treats a refusal as success**, and one such check turned up in the same grep that found the contract.

**So the question is not whether the change was right - it was, and the messages prove it - but whether it reached further than the call site
it was made for.** Every reader of the contract is a place where the widened type has to be handled.

## Requirements

- **R1 - Find every consumer of the widened contract**, from the type to its call sites to anything that checks the result.
- **R2 - Classify each**: a caller that handles the string, one that cannot receive it, or one that would read it as success.
- **R3 - Fix anything in the third class**, at the smallest size, and keep the messages working.
- **R4 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Every consumer is listed with its line.
- [x] **AC2** Each is classified, with the evidence.
- [x] **AC3** Anything that would read a reason as success is fixed.
- [x] **AC4** The gate passes.

## Out of scope

- **Widening the contract further.**
- **Approval flows through a Pi host.**
- **The first real turn**, which needs the host.