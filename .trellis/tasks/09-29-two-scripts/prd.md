# The two scripts nobody runs

## Goal

Run `benchmark:interop` and `release:manifest`, and record what each does and whether it works.

## Background: entries in package.json that this session has never invoked

A previous round read every script in `package.json` and found nine. **Four are the session own gates** - typecheck, test, the installer
suite and doctor - **one was found to be unrunnable** (`release:check`, whose Python tool needs five arguments the entry does not pass), and one
is a pair of commands already run by hand (`pi:smoke`).

**Two remain that nobody here has ever invoked**: `benchmark:interop` and `release:manifest`. **The last round found an entry that cannot work**,
so this one reads each script before running it, and reads the output rather than the exit code alone.

## Requirements

- **R1 - Read each script** before running it, and say what it appears to do.
- **R2 - Run each with a timeout**, and record the exit code *and* the output.
- **R3 - Say whether each works**, and if one cannot, why - with the arguments or inputs it lacks.
- **R4 - Do not invent inputs** to make a script appear to work.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Each script is read first, and what it does is stated.
- [x] **AC2** Each is run with an exit code and output recorded.
- [x] **AC3** Each is classified as working, unrunnable, or needing inputs.
- [x] **AC4** The gate passes.

## Out of scope

- **Inventing arguments**, which the last round refused for the same reason.
- **Changing the scripts.**
- **The first real turn**, which needs a Pi host.