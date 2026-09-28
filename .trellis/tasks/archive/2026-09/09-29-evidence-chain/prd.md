# The evidence chain, verified

## Goal

Verify that the session record is internally consistent, and say plainly what is left if it is.

## Background: the one claim left that this environment can check

Every session the journal records carries the commits it produced, and **a commit hash is checkable** - it either resolves in this repository or
it does not. The index, the journal and the archive are three views of the same sessions, so they can be held against each other.

**If they agree, that is the honest end of the reachable work**, and the round should say so rather than look for something else to read.

## Requirements

- **R1 - Read the session index** and take the commits it names.
- **R2 - Verify every one resolves**, and say how many do not if any.
- **R3 - Hold the index against the archive**, and say whether the counts agree.
- **R4 - State plainly what is left**, including that nothing may be.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Every commit named by the index is checked.
- [x] **AC2** The unresolved ones are named, or the round says there are none.
- [x] **AC3** The index and the archive are compared.
- [x] **AC4** The gate passes.

## Out of scope

- **Rewriting the record.**
- **A task invented out of a clean result.**
- **The first real turn**, which needs a Pi host.