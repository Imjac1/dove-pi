# Whether the required-test sections exist elsewhere

## Goal

Establish whether any specification other than `framework-core.md` carries required-test sections, and say what that means for this method.

## Background: a method needs a source of claims

Four rounds read the six `Tests Required` lists in one file and held every item, finding two genuinely unheld safety promises along the way.
**That method needs claims to check**, and it has been drawing them from one file. If no other specification states which tests are required,
then this line of evidence is finished and the round should say so rather than look for somewhere to spend itself.

**The measurement is countable**: which files carry a section that names required tests, and in what words.

## Requirements

- **R1 - Find every section in the specifications that names required tests**, in whatever words each file uses.
- **R2 - Say which files have none**, so the negative is as visible as the positive.
- **R3 - State what this means for the method**: more to read, or finished.
- **R4 - If other sources exist, name the best next target** rather than starting on it.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Every required-test section is listed with its file and line.
- [x] **AC2** The files with none are named.
- [x] **AC3** What it means for the method is stated.
- [x] **AC4** A next target is named, or the method is declared finished.
- [x] **AC5** The gate passes.

## Out of scope

- **Reading any newly found lists**, which is the next round work if there is any.
- **Other kinds of claim in the specifications.**
- **The first real turn**, which needs a Pi host.