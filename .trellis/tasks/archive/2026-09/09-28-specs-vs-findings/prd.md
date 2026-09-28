# Whether my own measurements made a document stale

## Goal

Check the specifications against what this session measured, and correct anything the measurements refined.

## Background: a measurement can make a document wrong

Every finding this session reached is a statement about the product, and the specifications are where the product is described. **A
measurement that narrows, widens or contradicts a claim makes the claim stale**, and this project has treated stale claims as defects wherever
it found them.

**Four findings could touch a document**: the read-only switch being an adapter control rather than a runtime property, the two doctors
differing in what they report, the approval boundary having two gates with one status, and the rpc error codes collapsing before they were
fixed.

## Requirements

- **R1 - State the four findings** and what each one refines.
- **R2 - Search the specifications for claims each finding touches**, and read the claim rather than the search hit.
- **R3 - Correct anything that is now wrong or incomplete**, at the smallest size, and say what changed.
- **R4 - Say plainly if a finding touches no document**, rather than inventing a place to put it.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Each of the four findings is stated with what it refines.
- [x] **AC2** Each is held against the specifications and the result recorded.
- [x] **AC3** Anything stale is corrected, and the correction is stated.
- [x] **AC4** Anything that touches no document is recorded as touching none.
- [x] **AC5** The gate passes.

## Out of scope

- **Rewriting the specifications**, which is not what a stale claim asks for.
- **Adding documents for findings that have no home.**
- **The first real turn**, which needs a Pi host.