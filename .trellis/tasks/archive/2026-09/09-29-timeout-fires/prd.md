# The timeout that fires

## Goal

Hold the timeout path of `runPowerShell`, which shares the abort path and is not separately tested.

## Background: a path with a margin big enough to be deterministic

The timeout and the cancellation signal both call the same `abort`. **The cancellation half now has a case; the timeout does not.** Whether it
can be deterministic was the question left open: the timeout is a caller-supplied number, so a one-millisecond timeout beside a script that
sleeps for seconds has a margin of thousands, and **the duration proves which of the two ended the run** - if the script finished, the
duration would be the sleep.

## Requirements

- **R1 - Read the timeout path**, and confirm what fires it and what it does.
- **R2 - Write the case** with a margin wide enough to be a test and not a race.
- **R3 - Assert the duration**, so the case proves the timeout fired and not merely that the run ended.
- **R4 - Add a control**, and say in the case what it does not hold.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The timeout path is read, not assumed.
- [x] **AC2** The case passes, with the margin stated.
- [x] **AC3** The duration assertion distinguishes a timeout from a completed sleep.
- [x] **AC4** The control was run.
- [x] **AC5** The gate passes.

## Out of scope

- **The cancellation half**, which is held.
- **Changing the shell module.**
- **The first real turn**, which needs a Pi host.