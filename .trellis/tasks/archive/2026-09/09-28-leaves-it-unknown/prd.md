# The function that leaves it unknown

## Goal

Find the owner of the unknown-identity branch and hold it, and the doctor schema-drift claim.

## Background: a lead walked in the right direction

The last round found the identity lives on the Python side and that `manager.py` leaves an unknown digest unknown *rather than inventing a
divergent one*. **No test was found by searching for the word** - and six pattern misses this session say the word is the wrong instrument.

**So this round reads the function first.** Its name is the search term, and the tests are then asked who calls it, which is the direction that
found the installer, workspace and receipt holders when the word-searches did not.

## Requirements

- **R1 - Read the function that owns the unknown branch**, and name it.
- **R2 - Search the tests for that name**, not for the word unknown.
- **R3 - Hold the branch or name it unheld**, saying which callers were searched.
- **R4 - Check the doctor schema-drift claim** by the same method.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The owning function is named.
- [x] **AC2** The tests are searched for the name.
- [x] **AC3** The branch is held or named, with the search recorded.
- [x] **AC4** The doctor claim is checked by the same method.
- [x] **AC5** The gate passes.

## Out of scope

- **Word-searches for either subject**, which have failed repeatedly.
- **Changing any behaviour.**
- **The first real turn**, which needs a Pi host.