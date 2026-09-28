# The capabilities, run rather than listed

## Goal

Run capabilities in a temporary project and read what they return, rather than reading what they declare.

## Background: a registry read twice and executed never

A round listed the fourteen capabilities and their declarations; the round after it held those declarations against the implementations. **No
capability has been executed in this environment**, so the pipeline - argument validation, approval, effect class, result envelope - has never
been observed from the outside.

**A read-only capability is the safe way to observe it**, and the declaration is what makes it safe: the round that read them found nine
declaring `read_only`, and running one turns that declaration into a measurement.

## Requirements

- **R1 - Create a temporary project** and run at least two capabilities there, one needing arguments and one not.
- **R2 - Record the exit code and the envelope of each**, not a summary.
- **R3 - Observe the declared side effect**: check that a `read_only` capability wrote nothing to the temporary project.
- **R4 - Try one refusal**: a capability run without its required argument, or with an argument it does not take.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Each run is recorded with its exit code and envelope.
- [x] **AC2** The temporary project is compared before and after, for a read_only capability.
- [x] **AC3** A refusal is provoked and recorded.
- [x] **AC4** The fixture is removed and this repository is untouched.
- [x] **AC5** The gate passes.

## Out of scope

- **Capabilities that change the machine**, which are not for this environment.
- **Approval flows**, beyond observing that `--approve` is what a write requires.
- **The first real turn**, which needs a Pi host.