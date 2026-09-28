# The mode id that must not appear in core

## Goal

Establish whether a vertical mode id appears in executable code under `src/core`, and what holds that claim.

## Background: a sibling claim that may be unheld the same way

`mode-format` claims that *a vertical mode id does not appear in executable code under `src/core`*. A previous round read the list it sits in
and reported it held; **this round searched for its wording and found nothing**, so the report was about the list rather than about a holder.

**The claim is the same shape as the one fixed last round** - structural, about `src/core`, and mechanically checkable - so the method is the
same: measure whether it is true, then ask who reads the directory.

## Requirements

- **R1 - Establish which ids are verticals**, from where modes are defined rather than from memory.
- **R2 - Measure whether any appears under `src/core`**, naming any that does.
- **R3 - Find whether anything holds the claim**, or name the absence.
- **R4 - Add a holder if the claim is true and unheld**, saying what it covers and what it does not.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The vertical ids are established from the modes themselves.
- [x] **AC2** The measurement is recorded, whatever it shows.
- [x] **AC3** The holder is found or the absence named.
- [x] **AC4** A holder is added if warranted, with its scope stated.
- [x] **AC5** The gate passes.

## Out of scope

- **Renaming anything to satisfy the claim.**
- **The other mode-format items**, which stay named.
- **The first real turn**, which needs a Pi host.