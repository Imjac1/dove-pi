# Implementation: the cross-child checkpoints, and the integration review

This task is **not started** as an implementation target - its children are. This plan is what this task does across
them: the preconditions it holds, the checkpoint it runs when each child lands, and the review it performs once.

## Before any child starts

- [ ] Re-curate this task's manifests for what *it* now needs: the graded recipe and the field-run spec, because its job
      is to judge two measurements and say what they may claim. The four entries curated on 2026-10-16 were written for an
      implementation target that has since moved into the children.
- [ ] Confirm every child has its own PRD with testable criteria **and** the artifacts its complexity requires - the gate
      child needs a design (it rewrites two cases and adds one), the release child needs a written rollback position, the
      reading child needs its second project specified.

## Done when

- [ ] All three children are archived, and each one's own PRD criteria are ticked **or** the unticked one is named here.
- [ ] The release identity and the reading identity are the same build, or the difference is explained in one sentence.
- [ ] The gate child's mutation evidence is on record: both cases go red when the behaviour they hold is broken.
- [ ] The reading child's two passes are on record with, for each: the project's own test result, the held-out
      instrument's byte count, and the untouched state of the source or fixture.
- [ ] No temporary install and no temporary copy is left behind; the graded clone is back at its three pins.
- [ ] The conclusion lists the boundaries verbatim: two projects, two modes, the wrap-up as the next request, the driver
      answering no interactive question, one pass as one sample.

## Checkpoints, one per child

1. **When `10-16-release-024` lands**: read `gh release list` and the user-facing URL. If the CI job went red, check
   whether it is the fence (a `test (locked)` failure in the parallel-batch case) - if it is, record it here and do
   **not** move the tag; that red belongs to the gate child.
2. **When `10-16-trustworthy-gate` lands**: read the two mutation results, not the green suite. A gate change certified
   only by "the suite passes" has certified nothing, because it passed before too.
3. **When `10-16-two-project-reading` lands**: read the three numbers per project, and the sentence saying which build
   each pass measured. A pass whose build is not the released one is a fact to state, not to omit.

## Validation

- After each child's archive, the archive tax is due: run `spec-anchors`, `document-drift`, `harness-surface`,
  `spec-context-budget`, and scan the curated entries for pointers into the archived directory - the front door documents
  the tax and its two payers.
- The corpus gate (`node scripts/task-artifact-lint.mjs --assert-corpus`) runs after each artifact set changes.
- The mount table moves whenever the adapter is edited above a registration; repoint from the declarations and read the
  page's prose citations back one by one.

## Risky files and rollback

This task writes only its own artifacts, so it has nothing to roll back. The irreversible step in the goal belongs to the
release child, and the rule for it is written in this task's design: a red run does not move a tag.

## Follow-up checks before any child starts

- [ ] The three children reviewed together with this task's requirement set, and the final planning summary approved in a
      later message.
- [ ] Each child's own "before start" list satisfied - in particular the JSONL manifests, since the verification step
      dispatches a sub-agent.
