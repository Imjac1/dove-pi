# The four lists, and a claim about test sensitivity

## Goal

Hold the four `Tests Required` lists in `capability-runtime.md` against the tests, and test the one claim that is about test sensitivity.

## Background: a claim search cannot answer

Every list checked so far made claims about behaviour, which a search can confirm. **This one also claims that each of two checks is
load-bearing - removing either must fail a case** - which no search can confirm, because it is a claim about whether the tests would notice.

**That claim is testable by mutation**: remove a check, run the suite, and see whether something goes red. It is the same discipline this
session applies to its own new checks, turned on the framework instead.

## Requirements

- **R1 - Read all four lists** and restate their items.
- **R2 - Hold the behavioural items against tests**, by what they say rather than by a guessed name.
- **R3 - Test the load-bearing claim by mutation** - remove the check, run the suite, restore it - and record what went red.
- **R4 - Check the smoke matrix item**, which names four transports and countable rows.
- **R5 - Say what was not checked**, rather than implying all four lists were finished.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** All four lists are read and their items restated.
- [x] **AC2** Behavioural items are held against tests.
- [x] **AC3** The load-bearing claim is tested by mutation, with the result recorded.
- [x] **AC4** Unchecked items are named as unchecked.
- [x] **AC5** The gate passes.

## Out of scope

- **Leaving a mutation in place**, which would be changing the framework rather than testing it.
- **The other specifications lists**, which this audit has mapped and not yet read.
- **The first real turn**, which needs a Pi host.