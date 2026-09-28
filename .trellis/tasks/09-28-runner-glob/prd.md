# The tests the runner actually runs

## Goal

Check that every test file on disk is one the runner loads, and that nothing the runner loads is missing from disk.

## Background

`package.json` runs the suite as `node --import tsx --test tests/**/*.test.ts`. **That pattern is the whole definition of what runs**, and a
file it does not match is a test nobody has ever seen run - while the suite count stays green and says nothing about it.

**The measurement is a set comparison**, and both directions are worth having:

| Direction | What it would mean |
|---|---|
| on disk, not matched | a test that never runs |
| matched, not on disk | a pattern that depends on files which are not there |

**This is the same shape as the reachability and module-graph measurements**, and it has the same trap: the pattern is not the claim. The
glob is expanded by Node rather than by the shell, so what matters is what Node does with it, not what a reader thinks `**` means.

## Requirements

- **R1 - Enumerate the `*.test.ts` files on disk**, excluding fixtures the project excludes on purpose.
- **R2 - Establish what the runner loads**, from the pattern as the runner interprets it - not from a guess about glob semantics.
- **R3 - Report both directions.**
- **R4 - Anything unmatched is either made to run or recorded with the reason it must not.**
- **R5 - A check is added only if it is not a weaker duplicate** of something that already holds this.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** Both sets exist and their sources are named.
- [ ] **AC2** The comparison is reported in both directions.
- [ ] **AC3** Every unmatched file is resolved, or recorded with its reason.
- [ ] **AC4** Any check added is justified against what already exists.
- [ ] **AC5** The gate passes.

## Out of scope

- **The Python suite**, which the installer runner already discovers by pattern.
- **Rewriting the test command**, which is not what a missing file asks for.
- **The first real turn**, which needs a Pi host.
