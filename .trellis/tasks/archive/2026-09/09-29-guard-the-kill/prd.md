# A guard for the kill that throws EINVAL

## Goal

Guard `child.kill()` in the abort path, and restore the case that found the defect as its test.

## Background: a reproduction waiting for its fix

A previous round wrote a case that passes a pre-aborted `AbortSignal` and expects `interrupted` to be true. **It failed with `kill EINVAL` and
*generated asynchronous activity after the test completed***, which means the run settles and an unhandled error escapes afterwards. The
abort path calls `child.kill()` unguarded, a pre-aborted signal reaches it immediately after `spawn`, **and the timeout shares the same path**
- so a short timeout can hit the same thing.

**The case was removed rather than left failing.** This round makes it pass.

## Requirements

- **R1 - Read the abort path as it is now**, before changing it.
- **R2 - Guard the kill**, at the smallest size, with a comment saying what the guard is for.
- **R3 - Restore the case**, and run it: it passed for no reason before, so it is now the regression test.
- **R4 - Add the control in the same case**, so the assertion is not vacuous.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The path is read before the change.
- [x] **AC2** The guard is applied, and says why.
- [x] **AC3** The restored case passes, and its control passes with it.
- [x] **AC4** The gate passes.

## Out of scope

- **Changing what interruption means**, which the case pins.
- **The timeout behaviour**, which shares the path and is not separately tested.
- **The first real turn**, which needs a Pi host.