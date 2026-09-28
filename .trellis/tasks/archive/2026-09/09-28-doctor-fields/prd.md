# The fields the specification names in the doctor projection

## Goal

Hold the field names the extension-runtime contract lists against the fields `doctor` actually prints.

## Background: a fifth kind of declaration

| Round | Declaration held against reality |
|---|---|
| 58-59 | command names |
| 60 | switch names |
| 63 | subcommand names |
| 64 | capability names |
| **this** | **field names in a JSON projection** |

The contract says `agent_doctor` includes a bounded execution diagnostics projection and a bounded `subagent` projection, and it names
fields in both. **`doctor` prints JSON**, so the promise can be checked by running it rather than by reading the code that builds it - the
same evidence a previous round used for the capability registry.

**A field the contract names and the output does not carry is a promise a reader cannot use**, and a field the output carries that the
contract does not name is one nobody knows is public.

## Requirements

- **R1 - Run `doctor` and read its JSON**, rather than reading the code that assembles it.
- **R2 - Extract the field names the contract lists**, with the line each came from.
- **R3 - Compare in both directions**, and say for each difference which side is wrong.
- **R4 - Anything broken is fixed at the side that is wrong**, and verified by running doctor again.
- **R5 - A check is added only if it is not a weaker duplicate** of the ones holding the surfaces above.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** The projection is read from a run, and its field names are stated.
- [ ] **AC2** The contract field names are listed with their source lines.
- [ ] **AC3** The comparison is reported in both directions.
- [ ] **AC4** Anything broken is fixed and verified by running it.
- [ ] **AC5** The gate passes.

## Out of scope

- **The whole doctor output**, which is larger than the two projections the contract bounds.
- **Fields nested below the projections**, unless the contract names them.
- **The first real turn**, which needs a Pi host.
