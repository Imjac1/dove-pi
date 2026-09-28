# How two promises are implemented, if they are

## Goal

Find the implementation behind two rows of the refusal table, or establish that there is none.

## Background: a lead, not a finding

The last round held ten promises against what keeps them. Eight had holders worth reading. **Two did not turn up under the obvious names, and
it refused to call them unheld on the strength of searches that had already been wrong twice.** This round chases the lead.

**The rows are**: *Duplicate project authorities - preserve source labels and report a conflict; never silently merge*, and *Evidence reference
names credential/key material - exclude it at the shared execution boundary*. **Both are statements about behaviour**, so the question is what
code makes them true and whether anything checks it.

## Requirements

- **R1 - Read both rows in full**, before searching, so the search is for what they say rather than for a guessed name.
- **R2 - Find the implementation by what it does**, and say how it was found - the name, the call site or the test.
- **R3 - If there is no implementation, establish that** by a method that could have found one, not by a failed search.
- **R4 - Say what holds each**, or that nothing does, with the evidence for the conclusion.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Both rows are read in full and stated.
- [x] **AC2** Each implementation is found by what it does, or its absence established.
- [x] **AC3** What holds each is stated, or that nothing does.
- [x] **AC4** The method is stated, so a reader can judge the conclusion.
- [x] **AC5** The gate passes.

## Out of scope

- **Adding the missing behaviour**, which is a decision for whoever owns the specification.
- **Guessing a name and reporting what it finds.**
- **The first real turn**, which needs a Pi host.