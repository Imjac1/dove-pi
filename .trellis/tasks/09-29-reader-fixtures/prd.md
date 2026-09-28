# The fixtures that try to break the reader

## Goal

Do the child fifth plan item: add legacy, malformed, incomplete and secret-bearing fixtures.

## Background: the reader survives a bad line, and had one hole

`parseLedgerLines` was read before anything was written. It drops a line that does not parse, and it kept a
parsed value whose `typeof` is `object` - **which a JSON array satisfies**, so an array reached the projection
with no `kind` and threw on `startsWith`. **That is exactly the malformed input this reader exists to
survive**, and the fixtures are what found it.

## Requirements

- **R1 - Read the reader first**, and write fixtures against what it actually does.
- **R2 - Cover legacy, malformed, incomplete and secret-bearing ledgers.**
- **R3 - Fix what the fixtures find.**
- **R4 - Keep a secret out of any summary produced from the fixtures.**
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Four fixture files exist and are read by a suite.
- [x] **AC2** The reader refuses a parsed value that is not a record.
- [x] **AC3** A secret in the input does not appear in the summary.
- [x] **AC4** The gate passes.