# The roadmap closed out

## Goal

Bring the decision record that has owned this work since round 1 up to date with what the rounds built, and archive the task
whose plan is delivered.

## Background: why this is a deliverable rather than bookkeeping

`09-27-harness-scaffold-frontier/decisions.md` is the roadmap: D1-D8, four research rounds, and a list of what is deliberately
not on it. It is still in `planning`, and its last entry predates everything built since - which makes it **stale**, and a
stale decision record is exactly the declaration this project treats as a defect: it says something about the work that is no
longer true.

What has shipped since it was written, and what each claim will be checked against:

| Built | Evidence |
|---|---|
| The protected surface and the fence (D8) | `09-27-mode-protected-surface-fence`, the `fence` gate label |
| The change manifest and its verdict (D5 first half) | `09-27-change-manifest-verdict`, `verdictFor` |
| The resource observation, one writer | `09-27-resource-observation-producer`, repaired in `09-28-observation-single-writer` |
| The SSM axis (D6 cheapest step) | `09-28-harness-axis-safety-stability`, `scripts/harness-axes.mts` |
| The declared editable surface | `09-28-declared-editable-surface`, `.trellis/harness-surface.yaml` |
| The failure reading (D5 second half) | `09-28-failure-reading`, `src/core/failure-reading.ts` |
| The verdict as a record | `09-28-verdict-as-record`, `change.decided` |
| The applied commit, and the surface check | `09-28-applied-commit`, `operation=applied` |
| The corpus as a reading | `09-28-harness-corpus-reading`, `scripts/harness-corpus.mts` |
| The verifier declared, and the boundary stated | `09-28-verifier-map`, `09-28-verifier-boundary` |
| The first real failure in the corpus | `09-28-mining-cannot-see`, the preserved ledger |

## Requirements

- **R1 - A Round 14 entry**, in the record own voice, saying what shipped and what it changes about the earlier decisions -
  including where an earlier recommendation was overtaken by what was built.
- **R2 - D6 is stated where it honestly stands**: its first measurable step shipped as a reading over our own ledger, and the
  **variant comparison** it actually wants still needs a task set that does not exist. Not "done", not "abandoned".
- **R3 - The two decisions from the rounds that belong in a roadmap rather than only in a contract are named**: the verifier
  is outside the loop, and the third module was measured and declined.
- **R4 - What remains, and why it is not here**: the turn needs a Pi-hosted session with a formal native task, which this
  environment cannot create - stated as a fact about the environment rather than as unfinished work.
- **R5 - The frontier task is archived**, because its plan is delivered and a roadmap that stays open claims work nobody is
  doing. Its record remains readable in the archive, which is where the next reader will look.

## Acceptance Criteria

- [ ] **AC1** The Round 14 entry exists, its claims each name an artifact that can be checked, and it does not contradict any
      earlier entry without saying so.
- [ ] **AC2** D6 status is stated with the part that shipped and the part that still needs a task set.
- [ ] **AC3** The two round decisions are named with a pointer to where they are stated at length.
- [ ] **AC4** The frontier task is archived with the house flag, and the active task count drops by one.
- [ ] **AC5** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass, and no source or specification file changes.

## Out of scope

- **Acting on what remains** - the turn is a Pi-hosted act and the variant comparison needs a task set.
- **Reopening D1-D8.** The entry records what shipped; it does not relitigate the decisions.
- **Rewriting the earlier rounds.** They are the history of how the roadmap got here, and history that gets edited stops
  being history.
