# The schema versions Dove writes and the ones it accepts

## Goal

Hold every schema version Dove writes into its own state files against the versions it accepts when reading them.

## Background: an eighth kind of declaration, and the one with the worst failure mode

| Round | Declaration held against reality |
|---|---|
| 58-64 | command, switch, subcommand, capability, field names |
| 66-67 | a minimum version, environment variables |
| **this** | **a state file schema version** |

**Both sides of this contract live in this repository.** A writer that stamps version 2 and a reader that accepts only 1 is a break nobody
outside would notice - the code compiles, the tests pass if they write and read the same constant, and the user meets a file their own tool
cannot open.

**The measured surfaces** are the state files Dove owns: the workspace policy, the convergence record, the managed install state, and any
other file that carries a `schemaVersion`.

## Requirements

- **R1 - Find every place a schema version is written**, with the line and the value.
- **R2 - Find every place one is accepted**, and what happens on a mismatch.
- **R3 - Compare**, and report any pair that disagrees.
- **R4 - Anything broken is fixed at the side that is wrong**, and verified by a round trip: write a file, read it back.
- **R5 - A check is added only if it is not a weaker duplicate** of the ones holding the surfaces above.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** Every written version is listed with its source.
- [ ] **AC2** Every accepted version is listed, with the refusal it produces.
- [ ] **AC3** Any disagreement is reported and fixed, verified by a round trip.
- [ ] **AC4** Any check added is justified against the ones that exist.
- [ ] **AC5** The gate passes.

## Out of scope

- **Migration between versions**, which is a design decision.
- **Files Pi owns**, which Dove reads but does not stamp.
- **The first real turn**, which needs a Pi host.
