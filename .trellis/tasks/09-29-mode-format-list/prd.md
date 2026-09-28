# The mode format list, with the checkability question

## Goal

Hold the remaining `mode-format` items, and say for each whether it can be checked at all.

## Background: the question the last round added

The last round found an item that could not be satisfied as written, and the lesson was sharper than the finding: **a check that passes without
proving anything is worse than an admission that nothing can check it**, because the check is read as a guarantee.

**So this round carries two questions per item**: is it held, and could it be? The second one is the new one, and the answers should be
*checkable*, *checkable-in-part* or *not checkable*, with the reason.

## Requirements

- **R1 - Ask the file list first**, and name the candidate owners before reading them.
- **R2 - Hold each item against a case or an assertion**, or name it unheld.
- **R3 - Answer the checkability question for each**, in those three terms.
- **R4 - Name the items not reached**, rather than implying the list is done.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Candidate owners are named before their contents are read.
- [x] **AC2** Each item is held or named unheld.
- [x] **AC3** Each item is classified as checkable, partly, or not.
- [x] **AC4** Unreached items are named.
- [x] **AC5** The gate passes.

## Out of scope

- **Adding checks for items that cannot be checked.**
- **The request-runtime lists**, which stay named.
- **The first real turn**, which needs a Pi host.