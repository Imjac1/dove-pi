# The acceptance criteria of archived tasks

## Goal

Count the acceptance criteria left unticked in archived tasks, and decide what a box nobody ticked means.

## Background: a checkbox is a question with two answers

Every task carries a PRD with acceptance criteria written as `- [ ]` boxes. **A task is archived when its work is done**, so an archived
PRD with unticked boxes is either a record nobody finished filling in or a criterion nobody met - and the two look identical.

**This session own tasks are the first suspects**, because the rounds updated the checklist in `implement.md` and left the PRD boxes alone.
That is worth measuring rather than assuming in either direction.

**The measurement is a count per archived task**, with the unticked criteria quoted, because the number alone says nothing about which of
the two it is.

## Requirements

- **R1 - Walk the archived tasks** and count the ticked and unticked criteria in each PRD.
- **R2 - Quote the unticked ones** rather than counting them, because a criterion nobody met and a box nobody filled in are told apart by
  reading.
- **R3 - Classify what is found**: a box left unticked by a practice, a criterion genuinely not met, or a task whose PRD has no criteria at
  all.
- **R4 - Fix the practice if it is one**, and say what the fix is - ticking boxes in a PRD is cheap and the record is the reason the file
  exists.
- **R5 - A check is added only if it is not a weaker duplicate** of the ones holding the surfaces above.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Every archived task is counted, with the ticked and unticked totals.
- [x] **AC2** The unticked criteria are quoted and classified.
- [x] **AC3** Any practice found is fixed, or recorded with the reason it is not.
- [x] **AC4** Any check added is justified against the ones that exist.
- [x] **AC5** The gate passes.

## Out of scope

- **Active tasks**, whose boxes are legitimately open.
- **The criteria themselves**, which are not being rewritten.
- **The first real turn**, which needs a Pi host.