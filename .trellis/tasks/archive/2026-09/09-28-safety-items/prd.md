# The safety items the last round named

## Goal

Hold the seven items of the third and fourth required-test lists in `capability-runtime.md` against tests.

## Background: items that were read and left unchecked

The last round read all four lists and held the load-bearing claim by mutation and the smoke matrix by name. **The remaining items - the
transactional workspace ones and the development-capability ones - were read but not held**, and it named them rather than leaving the
impression they were done.

**Two of them are safety-shaped**: path traversal and reserved snapshot paths are rejected, and a failed multi-operation patch rolls back what
already succeeded. **Those are the interesting ones**, because a promise about refusing something is the kind that can rot quietly.

## Requirements

- **R1 - Restate all seven items** in their own words.
- **R2 - Hold each against a test**, searching for what the item says rather than for a name I invent.
- **R3 - Name any item with no holder**, and say what was searched before saying so.
- **R4 - Add a holder where an item is testable, unheld and safety-shaped**, and say what it asserts.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** All seven items are restated.
- [x] **AC2** Each is held or named as unmatched, with what was searched.
- [x] **AC3** No item is called unheld on a single failed pattern.
- [x] **AC4** Holders added where warranted.
- [x] **AC5** The gate passes.

## Out of scope

- **The twelve other specifications with required-test sections**, which stay named as unread.
- **Changing the behaviour the items describe.**
- **The first real turn**, which needs a Pi host.