# The novice project and the exact resolution

## Goal

Hold two request-runtime items that have known neighbours: native state absence, and exact capability resolution with argument validation.

## Background: two items the audit is already standing next to

The first request-runtime list has eight items and three are held or partly held. **Two of the rest have neighbours already read**:

- *Native state absence does not prevent runtime initialization or tool execution* - and a clean-project case was read three rounds ago that
  says *immediately healthy in a clean project without creating metadata*. **That is close, and it may or may not be the same claim.**
- *Exact capability resolution and required-argument validation* - and the argument half was read in the protocol suite, which enforces each
  advertised parameter schema before execution. **The resolution half is the one to find.**

## Requirements

- **R1 - Ask the file list first**, and name the candidate owners before reading them.
- **R2 - Decide whether the clean-project case is the native-absence item or a neighbour of it**, and say which.
- **R3 - Hold both halves of the resolution item**, or name the half that is unheld.
- **R4 - Name the items not reached**, rather than implying the list is done.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Candidate owners are named before their contents are read.
- [x] **AC2** The clean-project case is placed: the item, or a neighbour.
- [x] **AC3** Both halves of the resolution item are held or named.
- [x] **AC4** Unreached items are named.
- [x] **AC5** The gate passes.

## Out of scope

- **The other request-runtime items**, which stay named.
- **Changing any behaviour.**
- **The first real turn**, which needs a Pi host.