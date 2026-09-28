# The seven lists left

## Goal

Read the seven remaining required-test lists and hold their items against tests.

## Background: the last five specifications with lists

The map counted them: `extension-runtime.md` two, `request-runtime.md` two, and one each in `harness-loop.md`, `mode-format.md` and
`project-context.md`. **Named in a previous round, unread until now.**

**The method starts with the file list**, which the last round showed costs one command and names the owner - where two rounds of searching
had been wrong for reasons the file list would have shown.

## Requirements

- **R1 - Read all seven lists** and restate their items.
- **R2 - Ask the file list first**, and say which files look like owners before reading their contents.
- **R3 - Hold each item against a case**, read from a case name or an assertion.
- **R4 - Name any item with no holder**, and say which file was searched first.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** All seven lists are read and their items restated.
- [x] **AC2** The owning files are named before their contents are read.
- [x] **AC3** Each item is held or named as unmatched.
- [x] **AC4** No item is called unheld on a single failed pattern.
- [x] **AC5** The gate passes.

## Out of scope

- **The two convergence items that point at the Pi tool boundary**, which need their own round.
- **Changing the behaviour any item describes.**
- **The first real turn**, which needs a Pi host.