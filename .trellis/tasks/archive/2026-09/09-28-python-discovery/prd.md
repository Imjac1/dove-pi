# The Python test files the pattern would skip

## Goal

Check that every Python test file on disk is one the installer runner loads.

## Background

`npm run test:installer` runs `python -m unittest discover -s tests -p "*installer*_test.py"`. **The pattern is the whole definition of
what runs**, exactly as the TypeScript glob is for the other suite - and a file whose name does not contain `installer` is a test nobody
has ever seen run, while the count stays green.

**Round 61 measured the other runner and found the question could not be answered behaviourally**, so it was answered by the files: every
TypeScript test file is at depth one, which makes the glob unambiguous. **This round asks the same shape of question of the Python
pattern**: which files match it, and which files exist.

**A discovery pattern is a claim about a directory**, and the repository now holds two of them. Both are worth the same treatment.

## Requirements

- **R1 - Enumerate every Python test file on disk**, by the convention `unittest` uses to find them.
- **R2 - Establish which the pattern matches**, as `unittest` interprets it - not as a reader reads a wildcard.
- **R3 - Report both directions**: a test file the pattern skips, and a pattern that depends on files which are not there.
- **R4 - Anything skipped is either renamed, loaded, or recorded with the reason it must not run.**
- **R5 - A check is added only if it is not a weaker duplicate** of the TypeScript one, which holds a different pattern.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** Both sets exist and their sources are named.
- [ ] **AC2** The comparison is reported in both directions.
- [ ] **AC3** Every skipped file is resolved or recorded with its reason.
- [ ] **AC4** Any check added is justified against the TypeScript one.
- [ ] **AC5** The gate passes.

## Out of scope

- **The TypeScript runner**, which round 61 settled.
- **Rewriting the test command**, which is not what a skipped file asks for.
- **The first real turn**, which needs a Pi host.
