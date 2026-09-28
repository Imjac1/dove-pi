# The request ledger and the client account

## Goal

Hold the four items of the second request-runtime list, and locate the client-account item by asking about the ledger.

## Background: a concrete list, and one lead that needs a different question

The second request-runtime list has four items and none is held: the pipeline from input through `agent_settled` producing one plan and one
terminal record, active redelivery handled before Pi persistence, steer and follow-up keeping the active request id, and provider, capability,
recipe and tool ledger records sharing one request chain with distinct execution ids.

**The client-account item has resisted a word-search twice, and the word that matched was a homonym.** So the question changes: the item is
about a *ledger*, and the right question is whether the **record-kind vocabulary has a client concept** - which is a question about an enum,
not about prose.

## Requirements

- **R1 - Ask the file list first**, and name the candidate owners before reading them.
- **R2 - Hold the four request-runtime items**, each against a case or an assertion.
- **R3 - Ask the record-kind vocabulary about a client concept**, rather than searching for the word.
- **R4 - Name whatever is not held or not located**, with the search recorded.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Candidate owners are named before their contents are read.
- [x] **AC2** Each of the four items is held or named.
- [x] **AC3** The record-kind vocabulary is asked about a client concept.
- [x] **AC4** Anything unlocated is named, with what was asked.
- [x] **AC5** The gate passes.

## Out of scope

- **The rest of the first request-runtime list**, which stays as named.
- **Changing any behaviour.**
- **The first real turn**, which needs a Pi host.