# The six required-test lists, item by item

## Goal

Hold the items of all six `Tests Required` sections against the tests that exist, and say which item has no holder.

## Background: a claim with an author

`framework-core.md` is six scenarios with a fixed six-section shape, and the fifth section of each is `Tests Required`. **That makes the
document state which tests are required in six places** - a countable claim with an author, which is the kind this session has learned to
check.

**The first list was partly checked last round**: two of its items are held in the specification own words by `loop-gate.test.ts`, and the
third - *the external adapter satisfies the same cases* - has a suite holding one case and nothing named for the rest. That is the first
question of this round.

## Requirements

- **R1 - Read all six lists** and restate their items, so the round knows the whole surface before judging part of it.
- **R2 - Hold the items against tests**, by searching for what the item says rather than for a name I invent.
- **R3 - Answer the adapter parity question** the first list leaves open.
- **R4 - Add a holder where an item is testable, unheld and safety-shaped**, and say what it asserts.
- **R5 - Say which items were not checked**, rather than implying all six lists were.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** All six lists are read and their items restated.
- [x] **AC2** The items checked are held against tests, read not guessed.
- [x] **AC3** The adapter parity question is answered.
- [x] **AC4** Unchecked items are named as unchecked.
- [x] **AC5** The gate passes.

## Out of scope

- **Judging whether a test truly holds an item**, which needs a reader.
- **Changing the framework behaviour.**
- **The first real turn**, which needs a Pi host.