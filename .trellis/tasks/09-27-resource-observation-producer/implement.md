# Implementation plan: the resource observation producer

## Before writing code

Load `trellis-before-dev` and read `.trellis/spec/backend/personal-agent-project-context.md` (the convergence
contract, including the inert annotation this task replaces) and `.trellis/spec/backend/quality-guidelines.md`.
Curate `implement.jsonl` / `check.jsonl` - `task.py start` refuses empty manifests even on this inline workflow.

## Ordered checklist

- [ ] **0. Confirm the hook fires once per terminal and before the next start.** Read the call sites of
      `appendRequestTerminal` (`:711`, `:1867`, and wherever `requestLifecycle` emits a terminal) and confirm that a
      request terminal is always emitted before the next request is accepted. This is the plan's one assumption; a
      reordering would make an observation describe two requests, and the design says a test pins it either way.
- [ ] **1. The operation.** `src/project-provider/contracts.ts`: add
      `{ action: "observe"; acceptanceId: string; resources: TaskResourceObservation }` to the union (`:78-86`),
      importing the type from `../core/task-convergence.ts`.
- [ ] **2. The mapping.** `src/project-provider/native-provider.ts`: a `case "observe"` in `toConvergenceEvent`
      (`:293-321`) returning `{ ...base, kind: "request.observed", acceptanceId, resources }`.
- [ ] **3. The skip marker.** `src/core/execution-ledger.ts`: `appendTaskResourceObservation` (`:374`) gains an
      optional `convergenceSkipReason?: string`, written into `details` beside `observationOnly: true` so a dropped
      observation is countable rather than invisible.
- [ ] **4. The producer.** `src/pi-adapter/extension.ts`, inside `appendRequestTerminal` (`:962`): after the
      `request.terminal` write, resolve the current task, and for a formal native task read the snapshot, apply the
      two conditions from the design (`working`/`verifying`, and an `in_progress` criterion), assemble the
      observation once, then write the ledger record and, when both conditions pass, the convergence event.
      **Everything convergence-side is guarded so an additive failure cannot surface as a terminal failure.**
- [ ] **5. Reducer and provider tests.** `tests/task-convergence.test.ts` and `tests/project-provider.test.ts`: an
      `observe` operation accumulates `observedResources` and bumps the revision, and the event refuses nothing that
      the existing fixture already covers. Add the provider round-trip through `mutateTaskConvergence`.
- [ ] **6. The semantic-state diff (AC3).** `tests/task-convergence.test.ts`: project a snapshot before and after an
      observation with the existing `projectSemanticState` helper and require them to be identical, so the promise
      that observations never decide anything is asserted rather than asserted-in-a-spec.
- [ ] **7. Host tests (AC1, AC2, AC4, AC5).** `tests/pi-adapter.test.ts`, in the formal-task scenario that already
      drives a request to a terminal: the snapshot grows by that request's counts; the ledger gains
      `task.convergence.observed` and the diagnostics reader returns it; a terminal with no `in_progress` criterion
      writes the ledger record with a skip reason and no convergence event; a non-formal run writes neither.
- [ ] **8. The two-request test.** Assert two sequential requests produce two observations with different tool-call
      counts, which is what pins the reset ordering the design calls out.
- [ ] **9. The contract.** `.trellis/spec/backend/personal-agent-project-context.md`: replace the inert annotation
      with the live contract - what is recorded, bound to which criterion, skipped when none is active, and never
      semantic.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
node --import tsx --test tests/spec-context-budget.test.ts
```

All five must pass. `npm test` is green as of `b310036` (649 pass / 0 fail / 2 skipped).

## Risky files and rollback points

| File | Risk | Mitigation |
|---|---|---|
| `appendRequestTerminal` | It is on the request-completion path: a throw here turns bookkeeping into a terminal failure. | The two state conditions are read first, and every convergence-side step is wrapped so an additive failure stays additive. |
| `execution-ledger.ts` | The observation record already exists and is read by diagnostics; a shape change would break a reader. | Only an optional field is added, and the existing `observationOnly` marker stays. |
| The reducer | It refuses events after `ready_to_finish` and while checkpointed or blocked. | The producer checks the state before offering the event; the reducer is not weakened to accommodate a producer. |
| `tests/pi-adapter.test.ts` | The formal-task scenario asserts counts of other ledger kinds and equality of semantic fields across a transient retry. | The observation writes the `task.convergence.observed` kind and a different convergence event, so those counts are untouched - verified by running that file alone before the full suite. |

**Rollback point** is after step 3: the operation, the mapping and the marker are in place and nothing calls them, so
reverting that far leaves the repository exactly as it was. After step 4 the producer writes records, and a revert
loses evidence it already collected - stated in the design rather than discovered at rollback time.

## Follow-up checks before `task.py start`

- [ ] Step 0 has run: the terminal-before-next-start ordering is confirmed, not assumed.
- [ ] The inert annotation in the spec is removed in the same change that makes it untrue (AC8), so the two cannot
      disagree even briefly.
- [ ] `implement.jsonl` and `check.jsonl` carry real entries.

## Recorded, not built

1. **A narrower round boundary for the change manifest.** Now that `request.observed` has a producer, the manifest
   could key its `pending` rule on it. It takes its boundary from the read revision today and that works; changing
   it is a decision with its own evidence.
2. **D6 first axis (SSM and ITQ).** This task makes the resources real for the first time; D6 is what turns them
   into a measurement, and it is the next item in the agreed order.
