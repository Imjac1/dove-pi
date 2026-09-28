# Reports drift without reverting it

## Goal

Hold the claim that the doctor reports schema drift without reverting it.

## Background: a safety claim that is a claim about not acting

The fourth claim of the continuation item is *doctor reports schema drift without reverting it*. **It is safety-shaped in the same way as two
cases already found this session** - the status suite reporting degradation *without mutating it*, and the source manifest leaving an absent
identity absent *rather than inventing a divergent one*. All three are claims that an inspector does not act.

**Method, proven three times**: find the function that implements the reporting, then ask the tests for its name. Word-searches have failed
seven times.

## Requirements

- **R1 - Find the function that reports drift**, in the doctor or wherever the schema is read.
- **R2 - Read what it does with the drift**, to confirm it reports and does not revert.
- **R3 - Search the tests for that name**, and hold the claim or name it unheld.
- **R4 - Say whether the claim is one of the report-without-acting family**, and what that family now holds.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The reporting function is found and named.
- [x] **AC2** What it does with the drift is read, not assumed.
- [x] **AC3** The tests are searched for its name.
- [x] **AC4** The claim is held or named as unheld.
- [x] **AC5** The gate passes.

## Out of scope

- **Word-searches for drift**, which would be the eighth failure.
- **Changing any behaviour.**
- **The first real turn**, which needs a Pi host.