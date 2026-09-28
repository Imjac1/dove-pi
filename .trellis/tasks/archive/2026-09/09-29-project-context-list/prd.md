# The project context list, five items left

## Goal

Hold the five remaining items of the project context required-test list.

## Background: two of these behaviours have been run by hand here

The list has six items and one is held. **Two of the others were exercised by this session in earlier rounds** - the CLI task lifecycle in a
temporary project, and session records through the same interface - **so the holders should be findable, and what this session ran by hand is
what the tests should already cover.**

**Method: ask the file list first**, then read the owner. Word-searches have failed nine times.

## Requirements

- **R1 - Ask the file list first**, and name the candidate owners before reading them.
- **R2 - Hold each of the five items** against a case, read from a name or an assertion.
- **R3 - Say where this session own runs agree with the holders**, since two items describe behaviour run by hand here.
- **R4 - Name any item that is not held**, and what was searched.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Candidate owners are named before their contents are read.
- [x] **AC2** Each of the five items is held or named.
- [x] **AC3** The two hand-run behaviours are matched to their holders.
- [x] **AC4** No item is called unheld on a single failed pattern.
- [x] **AC5** The gate passes.

## Out of scope

- **The other lists**, which stay as named.
- **Changing any behaviour.**
- **The first real turn**, which needs a Pi host.