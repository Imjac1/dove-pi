# The switches the documents name, against the ones the parser accepts

## Goal

Complete the command-line audit: hold every switch the documents name against what the parser accepts.

## Background

Two rounds audited the commands: the READMEs against the help, and the help against the router set. **The switches have not been audited**,
and they are the same shape of claim - a document names a flag, and a reader will type it.

| Source | Examples |
|---|---|
| the help | `--json`, `--no-extensions`, `--verify`, `--no-font`, `--no-path`, `--clean`, `--offline`, `--workspace-mode`, `--profile` |
| both READMEs | `--scope`, `--args`, `--approve`, `--yes`, `--skip-version-check` |

**The parsers are in two places**, which is what makes this worth measuring rather than assuming: argparse definitions for the maintenance
commands, and manual handling for the prefix flags and the local CLI arguments. **A flag the documents name and neither accepts is a
command that fails when a reader copies it.**

**And the direction is not symmetric here either.** A parser may accept a flag no document names - that is a hidden switch, worth
recording but not necessarily a defect - while a document naming a flag nothing accepts is a broken instruction. So the finding this
round is the second direction, and the first is recorded.

## Requirements

- **R1 - Extract every `--flag` the help names**, and every one both READMEs name.
- **R2 - Establish what the parser accepts**, from both places: the argparse definitions and the manual prefix handling.
- **R3 - Report the first direction as a finding**: a documented flag nothing accepts.
- **R4 - Record the second direction**: a flag the parser accepts that no document names, and decide per flag whether that is a defect.
- **R5 - Anything fixed is verified by running the command with the flag**, not by reading the diff.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** Both lists exist, with their sources named.
- [ ] **AC2** The comparison is reported in both directions.
- [ ] **AC3** A documented-but-unaccepted flag is fixed at the side that is wrong.
- [ ] **AC4** A hidden switch is either documented or recorded with the reason it is not.
- [ ] **AC5** The gate passes.

## Out of scope

- **The command surface**, which the two previous rounds settled.
- **Pi own flags**, which Dove passes through and does not own.
- **The first real turn**, which needs a Pi host.
