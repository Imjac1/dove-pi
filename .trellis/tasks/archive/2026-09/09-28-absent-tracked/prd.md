# The tracked files that are not there

## Goal

Classify every tracked file that is absent from the tree, and check whether anything points at one.

## Background: the remainder of two measurements

A round measured 181 tracked files, 74 of them absent. The round after it found that 52 of those are the whole `.claude` platform, which is
not installed here. **Twenty-two are unaccounted for**, and the reason they matter is the reason the last round existed: a config that names
a script that is not there is a hook that fails silently, with nothing to say so.

**Both halves are measurable**: which files are absent, and whether any config or document names one.

## Requirements

- **R1 - List every tracked file that is absent**, grouped by platform or directory.
- **R2 - Classify each group**: a platform that is not installed, a file removed on purpose, or something unaccounted for.
- **R3 - Search the configurations and the documents** for a reference to any absent path.
- **R4 - Anything pointed at and missing is a finding**, fixed at the side that is wrong; anything absent and unreferenced is recorded as
  such.
- **R5 - A check is added only if it is not a weaker duplicate** of the ones holding the paths above.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Every absent tracked file is listed and grouped.
- [x] **AC2** Each group is classified with its reason.
- [x] **AC3** The configurations and documents are searched for references to absent paths.
- [x] **AC4** Anything pointed at and missing is fixed or recorded with its reason.
- [x] **AC5** The gate passes.

## Out of scope

- **Restoring an absent platform**, which is not what a missing file asks for.
- **The 52 .claude files**, beyond confirming they are one group.
- **The first real turn**, which needs a Pi host.