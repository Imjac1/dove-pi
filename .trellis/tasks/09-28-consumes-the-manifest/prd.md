# Who consumes the source manifest

## Goal

Hold the claim that a source install does not read as drift because its extension identity is absent.

## Background: a lead that survived one correction

An earlier round read the branch at `manager.py` wrongly, as a state rather than a comment. **The corrected reading is**: when the manifest
generator is absent - which is what a source checkout before its first build looks like - the extension identity is left empty *rather than
invented*, so that it cannot report drift against a value nobody produced.

**The claim is therefore about a consumer**: something must read that empty identity and classify it as *not drift*. The caller of
`source_release_manifest` is at `manager.py:264`, and the method that has worked four times is to read the caller and then ask the tests for
its name.

## Requirements

- **R1 - Read the caller** of `source_release_manifest` and name the function.
- **R2 - Read what it does with an empty identity**, rather than assuming it is inert.
- **R3 - Ask the tests for that name**, not for the word drift.
- **R4 - Hold the claim or name it unheld**, saying what was searched.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The calling function is named.
- [x] **AC2** What it does with an empty identity is read.
- [x] **AC3** The tests are searched for its name.
- [x] **AC4** The claim is held or named as unheld.
- [x] **AC5** The gate passes.

## Out of scope

- **Word-searches for drift**, which would be the ninth failure.
- **Changing any behaviour.**
- **The first real turn**, which needs a Pi host.