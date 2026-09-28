# Read the item in full, and ask which module decodes

## Goal

Finish the continuation item by reading it in full, and place the identity-decoding cluster by asking which module exports a decoder.

## Background: a truncated item, and a question asked the wrong way round

**The continuation item has never been read to its end**: an earlier round read it and the line stopped at *doctor*. So the fourth claim has
been carried for three rounds without anyone having read what it says.

**And the identity cluster has resisted six searches.** Every one of them looked for a word in the *tests*, and six pattern misses this
session say that is the wrong direction. **The right direction is the one the earlier rounds learned: find the implementation, then see who
holds it.** So this round asks *which module exports a decoder* in `src`, and searches the tests for that name.

## Requirements

- **R1 - Read the continuation item in full**, and restate the fourth claim verbatim.
- **R2 - Find the decoder in `src`**, not by guessing a word but by listing what exports one.
- **R3 - Search the tests for that name**, and hold the cluster or name it.
- **R4 - Say whether reading the item in full changed what is known about it.**
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The item is read in full and the fourth claim restated.
- [x] **AC2** The decoder is found in src by what it exports.
- [x] **AC3** The tests are searched for that name, with the result recorded.
- [x] **AC4** The round says whether the full read changed anything.
- [x] **AC5** The gate passes.

## Out of scope

- **Further word-searches for the cluster**, which have failed six times.
- **Changing any behaviour.**
- **The first real turn**, which needs a Pi host.