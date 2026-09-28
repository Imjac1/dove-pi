# Which table hides the next gap

## Goal

Map the behaviour tables in the specifications, and choose the next one by measurement rather than by guessing.

## Background: a technique worth aiming

Two rounds annotated one table each, and the second found a safety row that nothing held. **The technique works; what it needs is a target.**
There are around twenty specifications and none of them has been mapped for tables, so the next choice would otherwise be whichever file I
happen to open.

**A table is a candidate when it makes a promise about behaviour** - a refusal, a permission, a limit, a required order. **A security-shaped
table is the best candidate**, because a promise nobody holds there is worth the most.

## Requirements

- **R1 - Find the behaviour tables** across the specifications, with their file, line and row count.
- **R2 - Rank them**, by whether they are about permissions, gates or refusals, and by whether they name any test.
- **R3 - Choose the next one on that ranking**, and say why it and not the others.
- **R4 - If the ranking says none is worth a round, say so** rather than picking the least bad.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The behaviour tables are listed with file, line and rows.
- [x] **AC2** Each is marked as naming a test or not.
- [x] **AC3** The next target is chosen on the ranking, with the reason.
- [x] **AC4** Or the round says none is worth it.
- [x] **AC5** The gate passes.

## Out of scope

- **Annotating the chosen table**, which is the round after this one.
- **Specifications with no behaviour table.**
- **The first real turn**, which needs a Pi host.