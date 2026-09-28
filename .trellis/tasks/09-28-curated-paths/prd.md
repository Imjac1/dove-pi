# The paths the task contexts curate

## Goal

Check that every path a task curated into its context still exists.

## Background: a pointer with no reader

Each task carries `implement.jsonl` and `check.jsonl`, one JSON object per line, each naming a path and why it was chosen. **The workflow
refuses an empty one**, so the file being there is held - but nothing holds what it points at. A path that has since been moved or deleted
leaves an entry that reads perfectly and leads nowhere.

**This is the same shape as the front-door paths a previous round held**, one layer further in: not a document a person reads, but the
context a task was built from.

## Requirements

- **R1 - Read every curated entry** across the active tasks and the archive.
- **R2 - Resolve each path** against the tree, and not against a memory of what used to be there.
- **R3 - Report every path that does not resolve**, with the task and the line.
- **R4 - A path that cannot resolve is either fixed or recorded with the reason it cannot be** - a file that was deliberately removed, or one
  that moved.
- **R5 - A check is added only if it is not a weaker duplicate** of the ones holding the surfaces above.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Every curated entry is read, and the count is stated.
- [x] **AC2** Each path is resolved against the tree.
- [x] **AC3** Anything unresolvable is fixed or recorded with its reason.
- [x] **AC4** Any check added is justified against the ones that exist.
- [x] **AC5** The gate passes.

## Out of scope

- **The reasons** beside each path, which are prose and not claims about the tree.
- **Contexts outside the task tree**, which the workflow does not curate the same way.
- **The first real turn**, which needs a Pi host.