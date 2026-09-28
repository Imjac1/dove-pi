# The exports nothing references

## Goal

Count the exported symbols in `src` that no other file references, and read each one before calling it dead.

## Background: what the module graph could not see

A previous round measured which modules nothing imports and left this out of scope in its own words: *unused exports inside a live module,
which is a different measurement*. **A module can be alive and still carry a symbol nothing calls** - a leftover from a refactor, or a
function whose only caller was replaced.

**The trap is the same and this session has met it repeatedly**: a name appearing somewhere is not the same as the name being used, and a
name in a comment, a string or a type position counts for a text search where it would not count for a reader. **So the check errs toward
silence and the finding is read rather than asserted.**

## Requirements

- **R1 - Collect every exported symbol** from `src`, one per module, with its kind.
- **R2 - Search for each name** across `src` and `tests`, and count the files that mention it.
- **R3 - Read every symbol referenced in no other file**, and classify it: used through a re-export, part of a public contract, referenced
  only in a type position, or genuinely unused.
- **R4 - Anything genuinely unused is removed or recorded**, and removing it must keep the suite passing.
- **R5 - A check is added only if it is not a weaker duplicate** of the ones holding the surfaces above.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Every export is collected, and the count is stated.
- [x] **AC2** The unreferenced ones are read and classified, not listed.
- [x] **AC3** Anything genuinely unused is removed or recorded with the reason it stays.
- [x] **AC4** Any check added is justified against the ones that exist.
- [x] **AC5** The gate passes.

## Out of scope

- **Unused locals and parameters**, which the compiler holds.
- **Exports used only by tests**, which is a legitimate use.
- **The first real turn**, which needs a Pi host.