# The .dove paths the READMEs name

## Goal

Hold every `.dove` path the two READMEs name against the layout the code builds.

## Background: the ruler already exists

A previous round measured the layout the code builds and found the help naming a file that is not in it:

```text
what .dove holds:  state.json, tasks/<id>, sessions.jsonl, project-mutation.lock,
                   project.json, effects, workspace.json
```

**The READMEs mention `.dove` eleven times between them**, and the front door is where a reader goes to find out where things live. The
same comparison applies, and it is cheaper than the last round because the code side is already known - what is new is the documents.

**Both directions matter**: a path a README names that the code does not build sends a reader somewhere that is not there, and a path the
code owns that no document names is one nobody can find.

## Requirements

- **R1 - Extract every `.dove` path either README names**, with the line.
- **R2 - Confirm the layout from the code** rather than from the previous round note, because a note is not a source.
- **R3 - Compare in both directions.**
- **R4 - Anything wrong is fixed at the side that is wrong.**
- **R5 - A check is added only if it is not a weaker duplicate** of the ones holding the surfaces above.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** Every README path is listed with its line.
- [ ] **AC2** The layout is confirmed from the code.
- [ ] **AC3** The comparison is reported in both directions.
- [ ] **AC4** Anything wrong is fixed and verified.
- [ ] **AC5** The gate passes.

## Out of scope

- **Paths Pi owns**, under `~/.pi`.
- **The help own paths**, which the previous round settled.
- **The first real turn**, which needs a Pi host.
