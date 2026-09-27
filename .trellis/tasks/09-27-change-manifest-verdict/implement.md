# Implementation plan: the change manifest and its verdict

## Before writing code

Load `trellis-before-dev` and read `.trellis/spec/backend/personal-agent-project-context.md` (the convergence
contract) and `.trellis/spec/backend/quality-guidelines.md`. Curate `implement.jsonl` / `check.jsonl` - `task.py
start` refuses empty manifests even on this inline workflow, and the two real entries are the convergence spec and
`decisions.md` Round 13.

## Ordered checklist

- [x] **0. Verify the gate labels the ledger actually records - DONE, and the set changed.** Grep every `gate:` value passed to
      `appendGateRefused` and confirm the eight labels in `design.md`. The observable set is a claim about what the
      ledger holds, and a label that never appears would make a prediction permanently `contradicted` - which is the
      failure mode this task exists to prevent, one level up. **Result: ten labels, not eight** - `ask`
      (`extension.ts:2412`) and `effect-claim` (`:2450`) were missing - and a recorded label may be a **composite**
      from `gates.join("+")` (`:2377`), so the read must split on `+`. **`stop-reasons` left the set**: it is the
      loop's reasons, the progress guard's kinds and the adapter's terminals in one field, recorded as a list, so it
      is not a closed set yet. `convergence` refusals are a different ledger kind and were never in it.
- [x] **1. The vocabulary and the verdict - DONE.** New `src/core/change-verdict.ts` (pure): `ChangeSurface`,
      `PredictedMovement`, the four observable names, `parsePredictedMovement` with refusals that name the whole
      closed set, and `verdictFor(prediction, currentRead)` returning `{ verdict, observed }`. No throws: an
      unreadable observable is `unobserved`, because a read that can throw is a read a run learns to avoid.
- [x] **2. Core tests - DONE.** New `tests/change-verdict.test.ts`: `pending` with no round after the recording;
      `confirmed` for each of the four observables; `contradicted` by absence **and** by movement in the opposite
      direction; `unobserved` for a missing key; the parser refusing an unknown observable, an unknown target and a
      malformed string, each naming the set.
- [x] **3. The record - DONE** (two bugs found by the tests, both mine: `decodeChange` served the event and the snapshot with one decoder, and `freezeSnapshot` left the manifest array mutable). `src/core/task-convergence.ts`: `TaskChange`, `changes?` and `lastObservedRevision?` on the
      snapshot, the `change.recorded` event in the union (`:73-100`), its branch in `decodeTaskConvergenceEvent`
      (`:127`), a `recordChange` in the reducer (`:230`), `request.observed` setting `lastObservedRevision`, the
      bounds (`MAX_CHANGES = 50`, `MAX_PREDICTIONS = 8`, text through the existing `MAX_TEXT`), and the refusal of a
      manifest with **no** predicted fix.
- [x] **4. Reducer tests - DONE.** `tests/task-convergence.test.ts`: record and decode; the bounds; the no-prediction
      refusal; and - the compatibility clause - **a snapshot written before this change still decodes**, which is what
      the optional fields are for.
- [x] **5. The operation - DONE.** `src/project-provider/contracts.ts` (the operation union, `:78-86`) and
      `native-provider.ts` (the mapping, the `:302-313` pattern), plus the read projection. Check while here whether
      `src/commands/task.ts` builds events itself for `dove-pi task convergence`; if it does, the new kind needs the
      same branch there or the CLI becomes a second writer with a different vocabulary.
- [x] **6. The tool - DONE** (and the status vector runs `verdictFor` beside `verification`). `src/pi-adapter/extension.ts`: `operation: "change"` in the union (`:1511`) with `surface`,
      `failureEvidenceRef`, `rootCause`, `fix`, `predictedFixes` and `predictedRegressions`; the execute branch
      parses the compact predictions through step 1, **builds the baseline by reading the harness's own observables**,
      and refuses a caller-supplied one; the `status` branch (`:1544-1559`) adds a `changes` vector beside
      `verification`; and the `status` mutation-field list (`:1539`) gains the manifest fields, without which AC6 is
      untestable.
- [x] **7. Tool and host tests - DONE** (six new assertions in `tests/pi-adapter.test.ts`, plus the suite stays green). Record a manifest, then: `status` reads `pending`; after a `request.observed` and
      a criterion movement it reads `confirmed`; a manifest whose predicted fix does not happen reads `contradicted`;
      an unreadable observable reads `unobserved` and never `confirmed`; a `baseline` in the input is refused; a
      `status` carrying a manifest field is refused and names `change`.
- [ ] **8. The contract.** `.trellis/spec/backend/personal-agent-project-context.md`: the manifest fields, the closed
      observable set, the four verdicts, the baseline rule, and **both limits in the spec's own words** - n = 1, and
      the regression field is a record rather than a control (with AHE's measured P/R).

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/spec-context-budget.test.ts
```

All three must pass. `npm test` is green as of `a0d1bad` (630 pass / 0 fail / 2 skipped); a red suite at the start
of this task would mean something else landed first.

## Risky files and rollback points

| File | Risk | Mitigation |
|---|---|---|
| `src/core/task-convergence.ts` | The reducer is the record's only writer; a validation bug corrupts formal-task state that other sessions then read. | Both new fields are optional, the decode test covers a pre-change snapshot, and the bounds are enforced with the same helpers as the existing fields. |
| `src/pi-adapter/extension.ts` (`status`) | The verdict runs on every status read of every formal task; a throw breaks the read. | `verdictFor` is total and never throws, and `unobserved` is the answer for anything it cannot read. |
| `src/project-provider/contracts.ts` | The operation union is shared with the CLI, so an unhandled operation becomes a silently different vocabulary. | Step 5 checks the CLI's path explicitly rather than assuming. |
| The observable set | A label or a state name that no writer produces makes every prediction permanently `contradicted`. | Step 0 verifies the labels against the writers before the set is frozen. |

**Rollback point** is after step 4: `core` and its tests are complete and nothing else reads them, so reverting that
far leaves the repository exactly as it was. There is no persisted migration to unwind - old snapshots keep decoding
and the new fields are absent until the first manifest is recorded.

## Follow-up checks before `task.py start`

- [x] Step 0 has run: the set is three members, each traced to the writer that produces it (see design.md §Step 0).
- [ ] The `status` mutation-field list is updated in the same change as the manifest fields (AC6).
- [ ] `implement.jsonl` and `check.jsonl` carry real entries, or `task.py start` will refuse.

## Recorded, not built

1. **Automatic rollback** when a predicted fix does not appear. AHE has it; here a revert that moves a permission
   boundary needs HITL, so the verdict is reported and a human decides. Its own task, when the loop exists.
2. **D6's axis work** (SSM and ITQ), which is what would turn a weak n = 1 delta into a measurement.
3. **The declared editable surface** - the fence protects paths; declaring which surfaces are editable, so a
   manifest's `surface` can be checked against a declaration rather than against a closed set of names, is the other
   half of D5(c).