# The commands the READMEs tell a reader to run

## Goal

Check every `dove-pi` invocation the two READMEs name against the command router, and hold them to what the READMEs actually claim.

## Background: what makes this checkable and what to check first

**The mechanism exists**: a previous round established that every command the router advertises answers `--help` with exit 0, which is a
safe way to ask whether a name is known - no install, no update, no network.

**And the direction has to be decided before the check is written.** A previous round found that the README switch list was a
purpose-bound example rather than an enumeration, and wrote the check one-directional for that reason: an example may omit, and must not
invent. The same question applies here:

| What the README does | What is owed |
|---|---|
| tells a reader to run a command | the command must exist, or the instruction is broken |
| lists the commands a product has | the list should also be complete |

**Only the first is a defect.** A README that names five commands out of twenty is showing a way in, not lying.

## Requirements

- **R1 - Extract every `dove-pi` invocation** from `README.md` and `README.en.md`, with the line each came from.
- **R2 - Read what the surrounding text claims**: a command a reader is told to run, or a list the document presents as complete.
- **R3 - Hold each name against the router** by asking it for its own help, which a previous round proved answers for every command the
  router knows.
- **R4 - Anything the router does not know is a finding**, and the fix is on the side that is wrong: the document if it invented the
  command, the router if it lost one.
- **R5 - The check, if it earns one, is one-directional** for the same reason the switch check is.
- **R6 - The gate passes**: typecheck, the suite and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** Every invocation is listed with its README line.
- [ ] **AC2** Each is held against the router and the result recorded.
- [ ] **AC3** Anything broken is fixed at the side that is wrong.
- [ ] **AC4** Any check added is one-directional, and says why.
- [ ] **AC5** The gate passes.

## Out of scope

- **Running a command that changes the machine**, which the `--help` form avoids.
- **The switch list**, which a previous round already settled.
- **The first real turn**, which needs a Pi host.
