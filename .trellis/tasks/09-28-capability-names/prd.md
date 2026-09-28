# The capability names the documents tell a user to run

## Goal

Hold every capability name the documents use against the registry that `capability list` prints.

## Background: a fourth surface, measured the same way

| Round | Surface | How it was held |
|---|---|---|
| 58-59 | commands | the READMEs against the help, the help against the router |
| 60 | switches | the documents against the parsers |
| 63 | subcommands | the usage strings against the dispatch |
| **this** | **capability names** | **the documents against the registry the CLI prints** |

**A capability name is a string a user types**, so a name a document uses and the registry does not hold is a command that fails - and this
session has already seen one of those (`shell`, documented and undiscoverable).

**The registry side is a reading, not a guess**: `dove-pi capability list` prints it, which is the same kind of evidence as asking a
command for its own help.

## Requirements

- **R1 - Read the registry** by running `capability list`, not by grepping for string literals - this session has four examples of a
  pattern lying about a claim.
- **R2 - Extract every capability name the documents use**, from both READMEs and the help.
- **R3 - Report both directions**: a documented name the registry does not hold, and a registered name no document names.
- **R4 - Anything broken is fixed at the side that is wrong.**
- **R5 - A check is added only if it is not a weaker duplicate** of the four that already hold the surface above this one.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** The registry is read by running the command, and its contents are stated.
- [ ] **AC2** The documented names are listed with their sources.
- [ ] **AC3** The comparison is reported in both directions.
- [ ] **AC4** Anything broken is fixed and verified by running it.
- [ ] **AC5** The gate passes.

## Out of scope

- **The capability protocol**, which the list output already describes.
- **Capabilities no document mentions**, beyond recording them.
- **The first real turn**, which needs a Pi host.
