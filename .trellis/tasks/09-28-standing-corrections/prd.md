# Whether the standing corrections still hold

## Goal

Hold the two corrections in the repository own section of `AGENTS.md` against the repository as it is now.

## Background: the section a future session reads first

`AGENTS.md` has a Trellis-managed block and a repository-owned section after it, and the section carries two corrections: one about a path a
documented script names, and one about archiving breaking curated context entries. **It is the first thing a future session reads**, which is
what makes a claim in it expensive to get wrong.

**This session has changed the repository since those notes were written** - a specification line corrected, the rpc error codes fixed, a
ceiling removed, a contract widened. So the question is whether the standing claims survived that, and the method is to test them the way they
were made: by reading the repository.

## Requirements

- **R1 - Restate both corrections in their own words**, before checking anything.
- **R2 - Hold each against the repository as it is**, by the method the original used.
- **R3 - Correct anything that no longer holds**, at the smallest size, and say what changed.
- **R4 - Say plainly if both still hold**, which is a result and not a non-result.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Both corrections are restated.
- [x] **AC2** Each is held against the repository and the result recorded.
- [x] **AC3** Anything stale is corrected, and the correction stated.
- [x] **AC4** The round says whether it changed anything, either way.
- [x] **AC5** The gate passes.

## Out of scope

- **Rewriting the section**, which a stale claim does not ask for.
- **The Trellis-managed block**, which a tool may overwrite.
- **The first real turn**, which needs a Pi host.