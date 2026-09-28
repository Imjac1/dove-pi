# What the tools object actually carries

## Goal

List what the `tools` object carries, and find out whether a way to report a blocker exists.

## Background: a boundary drawn without listing the box

Every round prompt says to follow the configured goal-tool policy before reporting a blocker, and **151 rounds have used six members of the
`tools` object without ever listing it**. The previous round concluded that a confirmation cannot be obtained inside this loop - which may be
right, and was not checked against what the loop actually carries.

**This is the same shape as the last four rounds**: a conclusion about a thing that was not inspected.

## Requirements

- **R1 - List the members of the tools object**, by reading it rather than guessing.
- **R2 - Say which have been used** across this session, from the record.
- **R3 - Say whether anything resembling a blocker report exists.**
- **R4 - If one exists, use it for the standing blocker; if not, say so.**
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The members are listed from the object.
- [x] **AC2** The used ones are identified.
- [x] **AC3** The blocker question is answered.
- [x] **AC4** The gate passes.

## Out of scope

- **Calling an undeclared tool**, which cannot be done.
- **Running the install**, which needs authorisation.