# Implementation plan: one writer for the resource observation

## Before writing code

Load `trellis-before-dev`. The specs to read are `.trellis/spec/backend/personal-agent-project-context.md` (the
false statement to correct) and `.trellis/spec/backend/quality-guidelines.md`. Curate `implement.jsonl` /
`check.jsonl`.

## Ordered checklist

- [ ] **1. Delete the second writer.** `src/pi-adapter/extension.ts`: remove the `recordRequestObservation` function
      and its call in `appendRequestTerminal`; remove the now-unused `TaskResourceObservation` import if nothing else
      uses it.
- [ ] **2. Move the event to the surviving site.** In the `agent_end` block at `:2405-2429`, after the ledger call,
      resolve the two conditions and call `mutateTaskConvergence({ action: "observe", ... })`, carrying
      `convergenceSkipReason` into the ledger record when it does not. Keep the existing `try/catch` disposition.
- [ ] **3. Comment the survivor as the one writer**, naming why the `appendRequestTerminal` hook is the wrong place -
      so the next person does not repeat the mistake this task is repairing.
- [ ] **4. Retarget the host assertions.** `tests/pi-adapter.test.ts`: the AC1/AC2 block asserts one record with
      `stepId: request:<id>` and its counters equal to the snapshot delta; the AC4 skip block asserts the same record
      carries `convergenceSkipReason` and that the convergence revision does not move; the fast-lane block asserts one
      record with the reason. The two-lease duplicate the previous task guarded against no longer exists to assert.
- [ ] **5. Correct the spec** (`personal-agent-project-context.md`): replace the false sentence with the corrected
      history and keep the contract text around it (the two conditions, the attribution note is no longer needed at
      this site - or is restated as why the site is `agent_end`).
- [ ] **6. Verify the ledger by hand**, not only by test: run a host test that settles a request and count the
      `task.convergence.observed` records for one request id in the ledger file it wrote.

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
| `agent_end` block | It already carries request bookkeeping; a throw would fail the end of a request. | The new call sits inside the existing `try/catch` whose comment already says this telemetry is observation-only. |
| `tests/pi-adapter.test.ts` | Its assertions were written against the duplicate shape; retargeting them could hide a real regression. | They move to a **stricter** claim (exactly one record, counters equal to the delta), not a looser one. |

**Rollback point** is any time before the commit: nothing is persisted differently, and the deletion in step 1 is the
whole of the behaviour change.

## Recorded, not built

1. **Reconciling the two acceptanceId rules** (the ledger record's and the event's) - recorded in the design.
2. **The blackbox script's `at(-1)` selection** now picks the right record again; whether its evidence projection
   should name the `acceptanceId` explicitly is a separate observation.
