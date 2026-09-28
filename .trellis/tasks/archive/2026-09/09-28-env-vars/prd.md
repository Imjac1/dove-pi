# The environment variables, as documented and as read

## Goal

Hold every environment variable the documents name against the ones the code actually reads.

## Background: a seventh kind of name

| Round | Names held against reality |
|---|---|
| 58-64 | commands, switches, subcommands, capabilities, fields |
| 66 | a minimum version |
| **this** | **environment variables** |

**A variable is a knob**, and its failure mode is quiet: a user sets it, the setting is accepted by the shell, and nothing happens. There is
no error and no output - the tool behaves exactly as if the variable were absent, because for the tool it is.

**The reading side is checkable by looking for the read**, and this session has learned to prefer evidence over pattern: the honest way to
find what the code reads is to search for the reads, not to infer from the names.

## Requirements

- **R1 - Find every environment variable the documents name**, from both READMEs and the help, with the line.
- **R2 - Find every variable the code reads**, from both languages, with the line.
- **R3 - Report both directions**: a documented variable nothing reads, and a read variable no document names.
- **R4 - Anything broken is fixed at the side that is wrong.** A variable a document promises and nothing reads is either wired or
  removed from the document; a variable that is read but undocumented is documented or recorded with the reason it is internal.
- **R5 - A check is added only if it is not a weaker duplicate** of the ones holding the surfaces above.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** Both lists exist, with their sources named.
- [ ] **AC2** The comparison is reported in both directions.
- [ ] **AC3** Anything broken is fixed at the side that is wrong, and verified by reading the read.
- [ ] **AC4** Any check added is justified against the ones that exist.
- [ ] **AC5** The gate passes.

## Out of scope

- **Variables Pi owns**, which Dove passes through and does not read.
- **Proxy variables**, which are a standard and already documented as a fallback order.
- **The first real turn**, which needs a Pi host.
