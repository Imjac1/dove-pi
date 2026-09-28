# What I have edited against what the tool tracks

## Goal

Find out whether any file changed in this repository is one the tool tracks, and therefore may be reverted by an update.

## Background: an old measurement that now matters to my own work

A previous round compared the tree against `.trellis/.template-hashes.json` and concluded that **`AGENTS.md` is the only file this
repository edited on purpose**. Since then this session has changed the launcher, the installer, the typecheck config, the mode files, the
specifications and `AGENTS.md` again.

**A tracked file that was edited may be overwritten by a `trellis update`**, and that is worth knowing before more work is built on it - not
because the edits are wrong, but because a reader should know which of them can survive a tool update and which cannot.

## Requirements

- **R1 - Read the tracked list** from `.trellis/.template-hashes.json`, with the count.
- **R2 - Compare it with the files this repository has changed**, from the git history rather than from memory.
- **R3 - Say for each overlap whether the change is ours to keep**, and what an update would do to it.
- **R4 - Record the conclusion where the next reader looks**, because the previous round put the same conclusion in `AGENTS.md` and it is
  now out of date.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The tracked list is read and counted.
- [x] **AC2** The changed files are taken from the history, not from memory.
- [x] **AC3** Every overlap is named with what it means.
- [x] **AC4** The conclusion is recorded, and the stale one corrected.
- [x] **AC5** The gate passes.

## Out of scope

- **Reverting anything**, which is not what a comparison asks for.
- **Files the tool does not track**, beyond confirming they are not tracked.
- **The first real turn**, which needs a Pi host.