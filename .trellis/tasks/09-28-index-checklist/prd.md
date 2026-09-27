# The entry point the workflow promises

## Goal

Give the two specification indexes the two sections the workflow says they have, because a skill tells every agent to read files listed
in a checklist that does not exist.

## Background: the pointer, measured

```text
.trellis/workflow.md:31
  `.trellis/spec/<package>/<layer>/index.md` - entry point with **Pre-Development Checklist** + **Quality Check**.

.agents/skills/trellis-before-dev/SKILL.md:31
  Read the specific guideline files **listed in the Pre-Development Checklist** that are relevant to your task.
```

And neither `backend/index.md` nor `frontend/index.md` contains a Pre-Development Checklist or a Quality Check: both were read in
full while writing the index check, and both are a title, a purpose line, a table, and a language line. A sweep of the whole
repository finds the phrase only in the workflow, in the skills that describe it, and in two gitignored backup copies - **never as a
section of a specification**.

**So an agent that loads `trellis-before-dev`, as every coding task in this repository does, is told to read a list that is not
there.** What it does instead is guess from the table - which is the same information under a different name, with the entry point
never saying so.

## Requirements

- **R1 - Each index says which files to read first, under the name the workflow uses.** The table already carries the content; what
  is missing is the instruction that tells a reader how to use it.
- **R2 - Each index names its Quality Check**, which exists: `quality-guidelines.md` is the quality check under another name, and the
  index should say so rather than leaving a reader to find it in the table.
- **R3 - Nothing is invented.** The checklist points at the table that is there; the quality check points at the file that is there.
  No new guidance is written in this round.
- **R4 - The index check gains the presence assertion**, with its limit stated: it can see that the two sections are named, and it
  cannot see whether what they say is useful.
- **R5 - Two measurements are recorded**: the gitignored backup trees are not a repository defect, and a wide sweep has to skip them.

## Acceptance Criteria

- [ ] **AC1** Both indexes carry a Pre-Development Checklist line that names the table as the list to choose from.
- [ ] **AC2** Both indexes name `quality-guidelines.md` as the Quality Check.
- [ ] **AC3** The index check asserts both sections are named, and states what it cannot see.
- [ ] **AC4** The backup trees are recorded as gitignored and local, so a future sweep does not mistake them for content.
- [ ] **AC5** The gate passes: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Out of scope

- **Editing `.trellis/workflow.md` or the skills**, which are tool content.
- **Inventing a checklist of specific files per task type.** The table and the router already do that, and this round is about
  naming what exists.
- **The first real turn**, which needs a Pi host.
