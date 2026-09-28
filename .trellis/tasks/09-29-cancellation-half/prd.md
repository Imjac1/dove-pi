# The cancellation half of the shell boundary

## Goal

Hold the cancellation behaviour of `runPowerShell`, which is implemented and unheld.

## Background: the same shape as the CLI approval flag

`PowerShellOptions` carries an `AbortSignal` and `PowerShellResult` carries `interrupted`, and the suite passes a timeout but never a signal.
**So the cancellation path is implemented and nothing would go red if it stopped working** - which is the shape of the two promises this audit
already found unheld and closed.

**This one is easier than the client account**: the function and the field are both known, and what is missing is a case that passes a
signal. **Read the implementation first**, because whether a pre-aborted signal short-circuits determines whether the case can be
deterministic rather than timing-dependent.

## Requirements

- **R1 - Read how the implementation uses the signal**, and what sets `interrupted`.
- **R2 - Write a deterministic case** if one is possible, preferring it to a timing-dependent one.
- **R3 - Add a control** so the assertion is not vacuous.
- **R4 - Say in the case what it holds and what it does not.**
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The signal handling is read, not assumed.
- [x] **AC2** The case is deterministic, or the round says why it cannot be.
- [x] **AC3** The control was run.
- [x] **AC4** The case states its own scope.
- [x] **AC5** The gate passes.

## Out of scope

- **A timing-dependent cancellation test**, unless determinism is impossible.
- **Changing the shell module.**
- **The first real turn**, which needs a Pi host.