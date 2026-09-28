# Whether the tool that breaks the pointers is mine to fix

## Goal

Measure the assumption this session has been making about the tool, and act on what the measurement says.

## Background

A previous round measured 66 broken curated pointers, 58 of them the same shape: an entry pointing inside the task own directory, which
`task.py archive` moves to `archive/<month>/<name>/` without rewriting anything. **The result of that round was to repoint the entries**, and
the tool that will break them again was left alone, on an assumption stated in `AGENTS.md`: that `.trellis/scripts` is managed and an edit
is overwritten by a `trellis update`.

**An assumption that decides whether a fix is worth making should be measured.** `.trellis/.template-hashes.json` is the list of files the
tool tracks, so the question is exact: is the archive script in it.

## Requirements

- **R1 - Read the template hashes** and answer whether `task.py` is tracked, with the evidence.
- **R2 - If it is tracked, record the consequence**: the pointers will break again, the fix is not ours to make, and the record says so
  where the next person will look.
- **R3 - If it is not tracked, fix the archive path** so the entries are repointed when the directory moves, and verify by archiving a task
  with a curated entry that points inside it.
- **R4 - Either way, the round states which of the two happened**, because an assumption left unmeasured is what this round exists to
  correct.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The tracked-or-not question is answered with evidence from the hash file.
- [x] **AC2** The consequence is recorded, or the fix is made, depending on the answer.
- [x] **AC3** If a fix is made, it is verified by archiving a task and reading the entries back.
- [x] **AC4** The round says which of the two happened.
- [x] **AC5** The gate passes.

## Out of scope

- **Rewriting the archive layout**, which is not what a broken pointer asks for.
- **The three pointers whose files are gone**, which the previous round settled.
- **The first real turn**, which needs a Pi host.