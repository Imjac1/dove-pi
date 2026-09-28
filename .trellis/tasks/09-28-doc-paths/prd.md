# The state paths the documents name

## Goal

Hold every state path the help and the READMEs name against the paths the code actually reads or writes.

## Background: a path is a claim about the filesystem

| Round | Declaration held against reality |
|---|---|
| 36 | the paths inside the specifications |
| **this** | **the paths in the help and the READMEs** |

The help names one explicitly - `--profile PROFILE ... (default: stored profile from .dove/manifest.json, else max)` - and the READMEs name
others. **A document that names a path the code never touches sends a reader somewhere that is not there**, and unlike a wrong name it is
hard to notice, because the reader has to go and look.

**The code side is a set of reads and writes**, and the honest way to get it is to look for the path construction rather than for the
string: this session has four examples of a pattern disagreeing with a claim.

## Requirements

- **R1 - Extract every path a document names**, from the help and both READMEs, with the line.
- **R2 - Find the paths the code builds**, from the layout constants and the file operations.
- **R3 - Compare in both directions**: a documented path nothing touches, and a path the code owns that no document names.
- **R4 - Anything wrong is fixed at the side that is wrong**, and verified by looking at what the code does with the path.
- **R5 - A check is added only if it is not a weaker duplicate** of the ones holding the surfaces above.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** Both lists exist, with their sources named.
- [ ] **AC2** The comparison is reported in both directions.
- [ ] **AC3** Anything wrong is fixed and verified.
- [ ] **AC4** Any check added is justified against the ones that exist.
- [ ] **AC5** The gate passes.

## Out of scope

- **Paths Pi owns**, under `~/.pi`.
- **Paths the specifications name**, which a previous round settled.
- **The first real turn**, which needs a Pi host.
