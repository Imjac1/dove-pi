# Design: what a close-out entry has to do, and not do

## What it does

- **Names what shipped**, each claim against an artifact: a task archive, a file, a script, a gate label. A claim nobody can
  check is the thing this record exists to avoid.
- **Says where an earlier decision was overtaken.** Round 12 scoped D6 first version to "something measurable"; the SSM
  reading over our own ledger is that, and it is narrower than the variant comparison D6 wants - so the entry says both, in
  one place, rather than leaving a reader to notice the gap.
- **Names the two round decisions that belong in a roadmap**: the verifier is outside the loop (a boundary on what the loop
  may judge) and the third module, measured and declined (a boundary on what the refactor is worth). Both are stated at
  length in the loop contract; the roadmap names them so a reader of the plan knows they were decided.
- **States the one thing that cannot be built here**, and says why: the first turn needs a Pi-hosted session with a formal
  native task, and this workspace has no `.dove` directory. That is a fact about the environment, and writing it as
  "remaining work" would promise something nobody can do.

## What it does not do

- **It does not relitigate.** D1-D8 stand as decided; the entry records outcomes.
- **It does not edit the earlier rounds.** They are how the roadmap got here, and edited history is not history.
- **It does not touch the specifications.** The contracts already carry the decisions; this is the plan looking back at
  itself.

## Verification

- **By the gate**: no source or specification file changes, the suite and the budget test green.
- **By the archive**: the frontier task moves with the house flag, and the active task count drops by one - the mechanical
  part of "its plan is delivered".
