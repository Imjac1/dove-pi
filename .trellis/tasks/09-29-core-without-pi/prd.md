# The core that must not import Pi

## Goal

Establish whether `src/core` imports Pi anywhere, and whether anything holds that claim.

## Background: a structural claim of the same shape as one already held

The first request-runtime item is *assert core modules type-check without Pi imports*. **It is structural rather than behavioural**, like the
`mode-format` claim that a vertical mode id does not appear in executable code under `src/core` - which is held by a test. **And it is
mechanically checkable**, which means this round can answer it rather than searching for a holder.

**Both halves matter**: whether the claim *is* true, and whether a check would notice if it stopped being true.

## Requirements

- **R1 - Measure whether `src/core` imports Pi**, by listing its imports rather than by searching for a word.
- **R2 - Find whether anything holds the claim**, and name the holder or the absence.
- **R3 - If the claim is true and unheld, add a holder**, at the smallest size.
- **R4 - Say what the holder covers and what it does not** - a real import and a type-only import are different.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The imports are listed and the claim is answered.
- [x] **AC2** The holder is found or the absence named.
- [x] **AC3** A holder is added if the claim is true and unheld.
- [x] **AC4** The holder states its own scope.
- [x] **AC5** The gate passes.

## Out of scope

- **The other request-runtime items**, which stay named.
- **Changing any module to satisfy the claim.**
- **The first real turn**, which needs a Pi host.