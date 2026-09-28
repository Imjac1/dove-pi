# The novice project, and what runtime initialization means

## Goal

Place the native-absence item and hold it, or say precisely which half is unheld.

## Background: a neighbour that covers health, and the question of the other half

The item is *native state absence does not prevent runtime initialization or tool execution*. A clean-project case was read that says
*immediately healthy in a clean project without creating metadata*, and another that reports readiness *without requiring skills*. **Both are
about a project with no state, and neither is obviously about *tool execution*.**

**So the round has two jobs**: decide whether the clean-project case *is* the item or a neighbour, and find what holds the *execution* half if
anything does. **The owning file is read before anything is written**, which is the lesson of three type errors two rounds ago.

## Requirements

- **R1 - Read the clean-project cases and decide**: the item, or a neighbour, with the reason.
- **R2 - Find what holds the execution half**, if anything.
- **R3 - Add a holder where the half is testable and unheld.**
- **R4 - Say what any new case holds and what it does not.**
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The clean-project cases are placed, with the reason.
- [x] **AC2** The execution half is held or named unheld.
- [ ] **AC3** A holder is added if warranted, with its scope stated.
- [ ] **AC4** The gate passes.

## Out of scope

- **Changing the provider.**
- **The other request-runtime items.**
- **The first real turn**, which needs a Pi host.