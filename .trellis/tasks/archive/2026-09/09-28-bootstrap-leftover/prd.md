# The bootstrap instruction this project never needed

## Goal

Remove the leftover bootstrap instruction from the two specification indexes, now that the measurement says nothing regenerates
them and every file they point at is already filled in.

## Background: two measurements and one discovery

**1. Nothing regenerates these files.** The boilerplate phrase appears in exactly two files and nowhere else in the repository: no
template, no script, no registry. The local Trellis scripts are six Python files and none of them writes a specification. So the
reason a previous round gave for leaving the text alone - that a tool update may rewrite it - was **wrong**: the footer on the managed
block says the *block* may be overwritten, and the specification files are project content.

**2. The content files are real.** Spot-checked three of them: the directory structure document says this is a single-package
TypeScript project with explicit runtime boundaries, the database document says the first release has no database or ORM and where
compact project goals live, and the error handling document says errors cross process, provider and host boundaries. **None of it is
template text.**

**3. And the discovery**: the `trellis-spec-bootstrap` skill own checklist says, in one line,

```text
- `index.md` files match the final spec file set.
```

**which is exactly the rule the test enforces now.** So the check was not invented here: it is the tool own requirement made
mechanical - and it was not being kept, since the backend index was missing three specifications when the check was written.

## Requirements

- **R1 - The bootstrap leftover goes from both indexes.** "Fill in each file with your project specific conventions" is an instruction
  to a project that has not filled them in, and this one has.
- **R2 - What is true stays**: the table, and the line that says the documentation here is written in English.
- **R3 - The check says where its rule comes from**, naming the skill line, so a reader knows it is the tool own requirement rather
  than a preference of this round.
- **R4 - The measurement is recorded**: nothing regenerates these files, and the reason a previous round left them alone was wrong.
- **R5 - The gate passes**: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** Both indexes drop the leftover section and keep their table.
- [ ] **AC2** The check names the skill line its rule comes from.
- [ ] **AC3** The index check still passes, and the indexes still list every file in their directories.
- [ ] **AC4** The correction is recorded in the task and the journal.
- [ ] **AC5** The gate passes.

## Out of scope

- **Editing the skill itself**, which is tool content and not this project own.
- **Rewriting the indexes generally**, which the check keeps honest without help.
- **The first real turn**, which needs a Pi host.
