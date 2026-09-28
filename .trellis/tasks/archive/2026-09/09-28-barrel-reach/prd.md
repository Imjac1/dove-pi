# The barrel that re-exports what nothing names

## Goal

Measure through the barrel the previous round could not see through, and say whether the five symbols are reachable at all.

## Background: the limit, stated and then removed

The round before this one removed four dead exports and left five alone, because `src/project-provider/index.ts` re-exports three modules
with `export *` and a text search cannot tell a symbol reachable through a barrel from one that is not.

**That limit is measurable**, and this round measures it: who imports the barrel, and what they take from it. **If nothing imports it, the
barrel is an export wall with no consumer, and the five symbols are unreachable - which would make them dead after all.**

## Requirements

- **R1 - Find every file that imports the barrel**, and what each takes from it.
- **R2 - Establish whether any of the five symbols is reachable** through an import of the barrel or of the modules it re-exports.
- **R3 - If the barrel has no consumer, say what that means for it and for the five** - and act at the side that is wrong.
- **R4 - If it has a consumer, record which of the five is live and which is not.**
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Every importer of the barrel is listed, with what it takes.
- [x] **AC2** The reachability of each of the five is stated.
- [x] **AC3** The consequence is acted on or recorded.
- [x] **AC4** The gate passes.

## Out of scope

- **Removing the barrel**, unless the measurement says it has no consumer.
- **Other barrels**, which this measurement does not cover.
- **The first real turn**, which needs a Pi host.