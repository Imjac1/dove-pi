# The evidence and redaction contracts

## Goal

Do the remaining child task first plan item: define additive evidence and redaction contracts.

## Background: the project own work, one child, its first item

The remaining child of the P0 umbrella is `08-30-dove-audit-observability-regression`, and its own plan begins with *Define additive evidence and
redaction contracts*. **Its PRD states the constraints**: logs stay evidence rather than a second state store, legacy records are accepted with
unavailable fields labelled rather than guessed, and secrets are never emitted.

## Requirements

- **R1 - Read the child own design document** before writing anything.
- **R2 - Define the contracts additively**, naming what is new and what a legacy record lacks.
- **R3 - Define the redaction rule set**, by what it must cover from the child own list.
- **R4 - Write the contracts where the project keeps contracts**, not in the task directory.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The design document is read and what it fixes is stated.
- [x] **AC2** The evidence contract is defined additively.
- [x] **AC3** The redaction rules are defined against the named list.
- **AC4** The gate passes.

## Out of scope

- **Implementing the summary command**, which is a later item.
- **Writing outside this repository**, and running anything that changes the machine.