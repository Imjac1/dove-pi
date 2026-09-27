# The source of truth names two artifacts that are not there

## Goal

Correct the stale paths a tracked tool document names, from the side of the boundary this repository controls, and make the
correction notice when the tool catches up.

## Background: the measurement

The front-door documents were swept for the same rule the specifications now carry - every repository-owned path resolves:

```text
README.md, AGENTS.md, .trellis/workflow.md   ->  11 owned paths, 2 missing
  .trellis/workflow.md: .trellis/scripts/inject-workflow-state.py
  .trellis/workflow.md: .trellis/spec/cli/backend/workflow-state-contract.md
```

**And the tool own bookkeeping says where the script actually is**: `.claude/hooks/inject-workflow-state.py` and
`.codex/hooks/inject-workflow-state.py` are tracked; nothing under `.trellis/scripts/` matches that name. So the document names a
path from an older layout, and the mechanism it describes is the one a previous round verified as working - thirty
`[workflow-state:...]` blocks in that very file.

**Why this matters more than a filename**: `.trellis/workflow.md` calls itself the workflow source of truth and is what the
Trellis block points every agent at first. A reader who follows its path to understand the mechanism finds nothing, and has no way
to know the document is the thing that is wrong.

## Requirements

- **R1 - The correction lives where an update cannot delete it.** `workflow.md` is tracked tool content with no managed block, so a
  local edit to it may be overwritten; the correction goes in this repository own section of `AGENTS.md`, whose position outside the
  block a test already holds.
- **R2 - It says what is wrong and where the artifact really is**, in one sentence a reader can act on.
- **R3 - A check notices when the tool catches up.** The front-door sweep asserts that the only missing owned paths are those two -
  so an update that fixes the document makes the check fail, and the note is removed rather than left to rot.
- **R4 - Our own front-door documents are held to the rule**: `README.md` and the repository section of `AGENTS.md` name only paths
  that exist, checked the same way the specifications are.
- **R5 - The gate passes**: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** The check asserts our front-door documents name only existing paths.
- [ ] **AC2** It asserts the tool document missing set is exactly the two known paths, and says why that assertion exists.
- [ ] **AC3** The `AGENTS.md` section carries the one-sentence correction with the real path.
- [ ] **AC4** The measurement, including the tracked-set evidence, is in the task.
- [ ] **AC5** The gate passes.

## Out of scope

- **Editing `workflow.md`**, which a tool update may overwrite.
- **The tool own stale paths beyond the front door**, which this repository does not read to start work.
- **The first real turn**, which needs a Pi host.
