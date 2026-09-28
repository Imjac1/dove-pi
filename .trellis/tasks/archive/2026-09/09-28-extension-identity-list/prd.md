# The list that packs safety claims

## Goal

Hold the second `extension-runtime` required-test list against tests, item by item and claim by claim.

## Background: two lists, and the one with a fail-closed claim

`extension-runtime.md` carries two lists and both pack several claims into one line. **The second is the safety-shaped one**: a managed
`-e` that is unconditional, an explicit override that must **fail closed**, and unrelated plugins that must remain **untouched** - plus path
canonicalization, version and digest drift, selection precedence, stale-claim replacement, and legacy `unknown` behaviour.

**A line that packs four claims cannot be checked by finding one holder for the line.** Each claim is held or not held on its own, and this
round reports at that granularity.

## Requirements

- **R1 - Read the list and split it into its individual claims.**
- **R2 - Ask the file list first**, and name the candidate owners before reading them.
- **R3 - Hold each claim separately**, and say which are unheld.
- **R4 - Name the first list as deferred**, rather than leaving the impression both were done.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The list is split into its individual claims.
- [x] **AC2** Candidate owners are named before they are read.
- [x] **AC3** Each claim is held or named as unheld, separately.
- [x] **AC4** The first list is named as deferred.
- [x] **AC5** The gate passes.

## Out of scope

- **The first `extension-runtime` list**, which is deferred and named.
- **Changing the behaviour any claim describes.**
- **The first real turn**, which needs a Pi host.