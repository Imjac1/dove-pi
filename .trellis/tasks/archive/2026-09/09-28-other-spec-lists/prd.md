# The lists in the other specifications

## Goal

Read the required-test lists in the other specifications, and hold the safety-shaped ones against tests.

## Background: eleven lists and two sections, named and unread

A previous round counted them: `audit-vertical.md` two, `extension-runtime.md` two, `request-runtime.md` two, and one each in
`convergence-record.md`, `harness-loop.md`, `managed-install.md`, `mode-format.md` and `project-context.md`, plus both quality
guidelines headed Testing Requirements. **All named, none read.**

**One round cannot check thirteen lists with evidence**, so this round reads all of them and checks the three that are safety-shaped: the
audit vertical, the managed install, and the convergence record. The rest are named as unchecked rather than implied.

## Requirements

- **R1 - Read every list** and restate its items, so the surface is known before part of it is judged.
- **R2 - Hold the items of the three safety-shaped lists against tests**, by what they say rather than by a guessed name.
- **R3 - Find the file that owns a behaviour**, rather than the file named after it - the lesson of the previous round.
- **R4 - Name the lists not checked**, rather than implying they were.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Every list is read and its items restated.
- [x] **AC2** The three safety-shaped lists are held against tests.
- [x] **AC3** Holders are found by owning file, not by name resemblance.
- [x] **AC4** Unchecked lists are named as unchecked.
- [x] **AC5** The gate passes.

## Out of scope

- **Checking the other ten lists**, which stay named.
- **Changing the behaviour any list describes.**
- **The first real turn**, which needs a Pi host.