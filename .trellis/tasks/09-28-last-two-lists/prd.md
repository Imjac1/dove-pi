# The last two required-test lists

## Goal

Hold the eleven items of scenarios 4 and 5 against the tests that exist, and say which item has no holder.

## Background: the two lists the last rounds named as unchecked

Two rounds checked four of the six `Tests Required` lists in `framework-core.md` and named scenarios 4 and 5 as unchecked rather than
implying otherwise. **This round picks them up**, which empties the list of things this audit has named and not done.

**Scenario 4 is identity** - reworded messages, moved files, edits in place, deletions, byte stability, checkpoints and restore. **Scenario 5
is context** - compaction, the head window, the three channels, and path classification. Both use distinctive words, which is the search term.

## Requirements

- **R1 - Restate all eleven items** in their own words.
- **R2 - Hold each against a test**, searching for what the item says rather than for a name I invent.
- **R3 - Name any item with no holder**, and say what was searched before saying so.
- **R4 - Add a holder where an item is testable, unheld and safety-shaped**, and say what it asserts.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** All eleven items are restated.
- [x] **AC2** Each is held or named as unmatched, with what was searched.
- [x] **AC3** No item is called unheld on a single failed pattern.
- [x] **AC4** Holders added where warranted.
- [x] **AC5** The gate passes.

## Out of scope

- **Other specifications**, which this audit has not mapped for required-test lists.
- **Changing the behaviour the lists describe.**
- **The first real turn**, which needs a Pi host.