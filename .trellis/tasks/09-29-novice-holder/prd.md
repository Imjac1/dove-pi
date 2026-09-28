# The holder, with the shape read first

## Goal

Add a named holder for the novice-runtime item, using the invocation shape read from the suite that owns it.

## Background: two failures from guessing an API one file away

A previous round placed the item - the runtime is a composition root, `createDoveRuntime` takes no arguments, and the repository has no
`.dove/` at all - and then failed twice to add a holder. **The first attempt used an `invoke` the runtime does not have; the second read
`protocolVersion` off a capability definition when it is a field of the request.** The shape was in `capability-protocol.test.ts` all along,
in a `request(name, overrides)` helper.

**So the action order this round is fixed and written down before anything else**: read the head of that suite, then write the case against
what it says.

## Requirements

- **R1 - Read the protocol suite head and its request helper** before writing anything.
- **R2 - Add one case** that creates the runtime in a root with no state and runs a capability from it.
- **R3 - Assert the root really has no state**, in the same case, as the control.
- **R4 - Say in the case what it holds and what it does not.**
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The shape is read first, and the round says what it read.
- [x] **AC2** The case passes, and so does its control.
- [x] **AC3** The case states its own scope.
- [x] **AC4** The gate passes.

## Out of scope

- **Guessing any API.**
- **The other request-runtime items.**
- **The first real turn**, which needs a Pi host.