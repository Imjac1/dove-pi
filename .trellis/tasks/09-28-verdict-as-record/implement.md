# Implementation plan: the verdict as a record

## Before writing code

Load `trellis-before-dev`; read `.trellis/spec/backend/personal-agent-project-context.md` (the convergence and decision
contract, **546 bytes from its cap** - this addition needs a split rather than a trim, and choosing what to split is
part of the task) and `.trellis/spec/backend/quality-guidelines.md`. Curate `implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [x] **1. The pure chooser.** `task-convergence.ts`: `DecidedChange` and `decidableChanges`, exported and documented.
      It reuses `verdictFor` rather than re-deriving anything, so a decision and the status read cannot disagree about
      what a movement did.
- [x] **2. The record.** `contracts.ts` gains the kind; `execution-ledger.ts` gains `appendChangeDecided`, writing
      `verdictOnly: true` and `decidedAtRevision`.
- [x] **3. One assembly.** Extract the `unresolvedByCriterion` plus `changeObservables` lines from the status read into
      one helper, and call it from the status read **and** the round boundary. Do not copy the four lines: that copy is
      the drift this record has already paid for once.
- [x] **4. The round boundary.** In the `agent_end` block, **after** the observation is applied and the revision has
      advanced, re-read the snapshot, build `decided` from the ledger, and append one record per decidable change -
      inside the existing additive `try`, because a decision that cannot be written must not fail a request.
- [x] **5. The report.** The status read returns `decided` (change id, verdict, revision) beside `changes`, so the
      durable memory is reachable from the tool a loop turn already calls.
- [x] **6. Tests.** A unit test for the chooser, and host assertions: one record per change, the verdict the movements
      support, none for a second round, and a still-pending change producing nothing.
- [x] **7. The spec, and the split it needed - DONE.** Framework core was 139 bytes from its cap and the project context 546, so the four loop contracts were **moved** rather than compressed into prose that documents a rule:

```text
framework core   24,437 -> 21,005 / 24,576
project context  24,030 -> 18,348 / 24,576
harness loop      (new)    10,758 / 24,576
```

The new `personal-agent-harness-loop.md` carries the SSM axis, the failure reading, the change manifest verdict and the recorded decisions, plus the declared editable surface - one subject, and the reason they were spread over three documents was that the two carrying them had run out of room, not that they belonged apart. The router gained a link and a selection rule, and the budget test gained the file and its heading. Fourteen bullets, ten matrix rows and seven test lines moved; the one stale sentence in the moved text (a note saying the axis would move if the specifications were reorganised) was replaced with the sentence that is now true., including the split it needs, moving a contract to the specification that has room rather than
      compressing prose that documents a rule.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
node --import tsx --test tests/spec-context-budget.test.ts
```

## Risky files

| File | Risk | Mitigation |
|---|---|---|
| The `agent_end` block | It already carries request bookkeeping and the observation; a throw would fail the end of a request. | The decision sits inside the existing additive `try`, so its failure mode is a missing record rather than a failed request. |
| The extracted helper | Refactoring the status read could change what an audit reports. | The helper returns exactly what the two call sites used, and the host assertions on `verification` and `changes` are the regression test. |
| The decision record | A second producer of the same kind would double the memory. | One producer and one call site, and `stepId: change:<id>` makes a duplicate visible in the ledger. |

**Rollback** deletes the call and the kind; decisions already written stay readable and harmless.

## Recorded, not built

1. **Acting on a verdict** - keeping or reverting an edit - which is a decision for a person and needs the governance
   of the loop (a held-out check, and human consent for a permission-boundary change).
2. **A query over decisions** (which surfaces help), which needs decisions to exist before it can answer anything.
3. **The loop procedure itself** (piece 4c), which is what will use these records: the turn from a mined failure, to a
   manifest, to a decision, to a keep-or-revert.