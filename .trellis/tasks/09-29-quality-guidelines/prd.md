# The two quality guidelines

## Goal

Read the two `Testing Requirements` sections, and say for each requirement whether it can be checked.

## Background: the last two unread blocks on the map

A round mapped the behaviour tables and the required-test sections across the specifications, and found two headed *Testing Requirements*: one
in `backend/quality-guidelines.md` and one in `frontend/quality-guidelines.md`. **Every other list has since been read; these two have not.**

**The frontend is the smaller half of this repository**, so its requirements may be the ones with no suite behind them - which is worth
knowing either way.

## Requirements

- **R1 - Read both sections** and restate their requirements.
- **R2 - Ask the checkability question of each**, as the last several rounds have.
- **R3 - Find what holds each**, by asking the file list rather than by searching for a word.
- **R4 - Add a holder only where a requirement is testable, unheld, and worth it**, and mind the 24 KiB specification budget if a note is to be written.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Both sections are read and their requirements restated.
- [x] **AC2** Each is classified as checkable, partly, or not, with the reason.
- [x] **AC3** Each is held or named unheld.
- [x] **AC4** The gate passes.

## Out of scope

- **A case that proves nothing.**
- **Rewriting the guidelines.**
- **The first real turn**, which needs a Pi host.