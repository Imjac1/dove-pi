# Implementation plan: D6's first axis

## Before writing code

Load `trellis-before-dev` and read `.trellis/spec/backend/personal-agent-framework-core.md` (the evidence plane this
axis reads, and where its contract goes) and `.trellis/spec/backend/quality-guidelines.md`. Curate
`implement.jsonl` / `check.jsonl` - `task.py start` refuses empty manifests even on this inline workflow.

## Ordered checklist

- [x] **0. Re-confirm the two vocabularies against their types, not against this plan.** Read
      `RequestTerminalReason` (`src/core/request-lifecycle.ts:7-16`) and the `gate.refused` label set
      (`src/core/action-policy.ts:334-518` plus `effect-claim` at `extension.ts:2450`). The classification must be
      total over the first and the labels must match the second; a label that never appears has the same effect here
      as it did in the change manifest - a metric that is permanently zero.
- [x] **1. The axis module.** `src/core/harness-axes.ts` (pure): `TerminalClass`, `classifyTerminal`,
      `safetyAndStability(records)`, `UNCOMPUTABLE_AXES`, and the axis name as the field states it. No I/O, no
      imports beyond `../core/contracts.ts` for `ExecutionRecord` and `../core/request-lifecycle.ts` for the reason
      type.
- [x] **2. The tests.** `tests/harness-axes.test.ts`: the classification enumerated over the closed set (AC1); exact
      counts and ratios for a fixture (AC2); `undefined` for an empty ledger, asserted as `undefined` rather than as
      a number (AC2); a `+`-joined label split into atoms (AC3); and the `UNCOMPUTABLE_AXES` entry asserted for the
      words it must contain (AC4), so the declaration cannot be quietly dropped.
- [x] **3. The reading.** `scripts/harness-axes.mts`: an optional ledger path argument, a default resolved through
      `resolveDoveStateDir`, a printed reading, the not-computable section, and exit 0 in every case including "no
      ledger found" (AC5).
- [x] **4. The contract.** `.trellis/spec/backend/personal-agent-framework-core.md`, in the evidence-plane scenario:
      the axis and its two computable metrics, the classification with its rationale, the `undefined`-not-`1.0` rule,
      the composite-label split, and ITQ declared not computable with its evidence (AC7).
- [x] **5. Run the reading against a real ledger - DONE.** Both branches, with what they printed:

```text
> node --import tsx scripts/harness-axes.mts
No execution ledger at C:\Users\<user>\.pi\agent\dove\workspaces\ab9cd15fe95ad3ee\execution.jsonl.
Pass one explicitly: node --import tsx scripts/harness-axes.mts <execution.jsonl>
exit=0

> node --import tsx scripts/harness-axes.mts <ledger a blackbox host run left behind>
Safety & Stability (SSM) - ...\dove-state\execution.jsonl
  requests (request.terminal records)............... 1
    clean (completed).............................. 1
    recovered (interrupted, then brought back)..... 0
    interrupted (cancelled or superseded).......... 0
    failure........................................ 0
  crash-free ratio (clean / clean + failure)....... 100.0%
  recovered rate (beside the ratio)................ 0.0%
  refusals by control label: (none recorded)
  isolation refusals (sandbox + fence)............. 0 (0.0% per request)
Axes this harness cannot read: ITQ ... ; SSM / Pareto preservation ...
exit=0
```

The first is the honest state of this machine: **no live session ledger exists**, because these sessions are driven
through the harness rather than the Pi host. The second is a real ledger a host run wrote, so the reading is
exercised against evidence rather than against a fixture. **No live session ledger existing is itself the reason the
axis matters**: the numbers D6 needs are written by the host, and this is the first thing that reads them.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
node --import tsx --test tests/spec-context-budget.test.ts
node --import tsx scripts/harness-axes.mts
```

All six must pass, and the last must exit 0 whether or not a ledger exists.

## Risky files and rollback points

| File | Risk | Mitigation |
|---|---|---|
| `src/core/harness-axes.ts` | A pure module that nothing in the harness calls could become the very thing this project hunts: an inert declaration. | It is imported by its test, by the script, and **the report is run as part of the task's validation** - so it has a consumer that a reader can execute. |
| The classification | A new `RequestTerminalReason` would fall into a default and silently be classified as something it is not. | The test enumerates the closed set from the type, so a new reason **fails** rather than defaults (AC1). |
| The reading | A number that reads as a target invites being gated on. | It prints and never asserts, and the design states why: a threshold is a decision with its own evidence. |

**Rollback point** is any time: nothing is written and nothing else imports the module, so a revert is a deletion
with no consequence to any run. That is stated rather than assumed because the previous two tasks both had a
non-free rollback, and the difference matters to whoever reviews this one.

## Follow-up checks before `task.py start`

- [ ] Step 0 has run: the reason set and the label set are read from the code, not from this plan.
- [ ] `implement.jsonl` and `check.jsonl` carry real entries.
- [ ] The deferred item is recorded as a decision rather than as a plan step (ITQ needs a record change, and taking
      that change here would be scope creep with its own evidence missing).

## Recorded, not built

1. **Making ITQ computable**: carry the criterion vector on the observation the request terminal already writes.
   Small, and a decision of its own - the design states exactly what it would take.
2. **D6's eventual shape**: comparing harness variants, with a task set, a scoring function and a held-out split
   (HarnessOpt-Bench's pattern: edit on development feedback, score on hidden tasks). This task is the prerequisite,
   not the beginning of that.
3. **The loop over the loop** (the four-piece scaffold's last item), which needs this axis to judge whether a harness
   edit helped or hurt.