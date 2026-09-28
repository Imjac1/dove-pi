# Every promised refusal and what holds it

## Goal

Take each behaviour the capability runtime specification promises and establish whether a test holds it.

## Background: a technique that worked, applied to the rest of the table

The last round searched the tests for a specific promised refusal and found nothing holding it, which turned out to be a real gap. **That
table has nine rows and only the last one was checked.** The others promise rejections, denials and a conflict report - each of them a
statement that a test could hold and that no test might.

**The question is countable and the answer is a list**, which is what makes it worth a round: not "is the suite good" but "which promises have
a holder and which do not".

## Requirements

- **R1 - List every behaviour the table promises**, in its own words, with the line.
- **R2 - Find what holds each one**, by the behaviour rather than by the words - a test may hold it under another name.
- **R3 - Name the promises nothing holds**, and say for each whether that is a gap or a case that cannot be staged here.
- **R4 - Add a holder only where the promise is testable and untested**, and say what it asserts.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Every promised behaviour is listed with its line.
- [x] **AC2** Each is matched to a holder or to nothing, and the match is stated.
- [x] **AC3** Promises nothing holds are classified: a gap, or unstaged here.
- [x] **AC4** Testable and unheld promises get a holder.
- [x] **AC5** The gate passes.

## Out of scope

- **Judging the suite as a whole**, which is not a countable question.
- **Staging a case this environment cannot stage.**
- **The first real turn**, which needs a Pi host.