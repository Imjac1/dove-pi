# A holder for the branch that prevents a false drift report

## Goal

Give the `!managed` branch of `compareDoveExtensionIdentity` a holder, and a control.

## Background: the last link of a five-link chain, untested

A previous round read the chain that stops a source install reading as drift: an absent generator leaves the extension identity empty, the
serialiser **omits** the field, validation is **skipped** for it, and the classifier answers *project_newer* rather than *diverged* for an
absent managed identity. **The last branch is the one that decides there is no drift, and the suite that owns classification never passes
undefined.**

**So this is a testable, unheld, safety-shaped promise** - the third the audit has found - and the fix is a holder rather than a note.

## Requirements

- **R1 - Read the branch and the suite helper**, so the case is written against the real signature.
- **R2 - Add a case** that passes no managed identity and asserts the state is not *diverged*.
- **R3 - Add a control**: a managed identity present must still be able to report *diverged*, so the assertion is not vacuous.
- **R4 - The case says what it holds**, which this repository requires of its test files.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The case passes no managed identity and asserts the state.
- [x] **AC2** The control shows the assertion is not vacuous.
- [x] **AC3** The case states what it holds and what it does not.
- [x] **AC4** The gate passes.

## Out of scope

- **Changing the classifier**, which is correct as written.
- **The lists left unheld elsewhere.**
- **The first real turn**, which needs a Pi host.