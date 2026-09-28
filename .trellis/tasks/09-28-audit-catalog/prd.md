# The catalog the code-audit scanner reads

## Goal

Find out whether the shipped catalog is parsed, valid, and held by anything.

## Background: product input with no reader watching it

`modes/code-audit/catalog/typescript.json` is shipped - the mode directory is in the release digest - and the seed scanner reads it with
`parseCatalog`. **A malformed or stale catalog does not fail loudly**: it produces the findings its contents imply, and the audit proceeds as
if they were right.

**Three questions, all cheap**: is the shipped catalog parsed by a test, does it satisfy the parser, and is what it declares still true of the
repository it ships with.

## Requirements

- **R1 - Read the catalog** and the parser that consumes it, and say what shape it must have.
- **R2 - Establish whether any test parses the shipped catalog**, as opposed to a fixture.
- **R3 - Validate it**: parse it, and check what it claims against the tree where the claim is checkable.
- **R4 - Anything wrong is fixed at the side that is wrong**, and anything unheld is either held or recorded with the reason it is not.
- **R5 - A check is added only if it is not a weaker duplicate** of the ones holding the surfaces above.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The catalog shape and its parser are stated.
- [x] **AC2** Whether the shipped catalog is parsed by a test is answered with evidence.
- [x] **AC3** It is validated, and anything wrong is reported.
- [x] **AC4** Anything unheld is held or recorded with its reason.
- [x] **AC5** The gate passes.

## Out of scope

- **Adding patterns to the catalog**, which is a review decision.
- **The scanner algorithm**, which is not what a catalog asks about.
- **The first real turn**, which needs a Pi host.