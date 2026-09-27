# Design: one writer for the resource observation

## What changes, and what deliberately does not

| Piece | Action | Why |
|---|---|---|
| `recordRequestObservation` (`extension.ts`, inside `appendRequestTerminal`) | **deleted** | It was the second writer, and it sat on a hook that fires per terminal transition rather than per request - which is why it needed an attribution guard the surviving site does not. |
| The ledger call at `agent_end` (`:2405-2429`) | **survives, becomes the only one**, and gains the convergence event | It is the right site: once per request, with the counters live, and it already resolves an `acceptanceId`. |
| The `observe` operation, its mapping, `convergenceSkipReason` | **untouched** | The genuine gap was the **event**, and these are what close it. |
| `personal-agent-project-context.md` | corrected | It carries a false statement written by the previous task. |
| The host assertions in `tests/pi-adapter.test.ts` | retargeted | They assert the shape the previous task built (two records, its own stepId); the shape is now one record belonging to the site that was always there. |

## The corrected flow, in one request

```
agent_end
  |  counters are live (nothing has reset them: the resets are at agent_settled and at the next lease)
  |- read the current task; for a formal native task read the snapshot
  |- decide: does the record accept an event (working|verifying), and is a criterion in_progress?
  |- ledger.appendTaskResourceObservation({ stepId: request:<id>, ...counters, ...(skipReason) })   <-- the ONE record
  |- when both conditions hold: mutateTaskConvergence({ action: "observe", acceptanceId, resources })
  `- wrapped, so an additive failure never fails the request
```

**The two conditions are the previous task's, and they are kept for the reasons it recorded**: the reducer refuses any
event after `ready_to_finish` (`task-convergence.ts:255`) and any but `task.resumed` while checkpointed or blocked
(`:254`), so offering one regardless would throw out of the request path; and `requireKnownAcceptance` means an
observation must name a criterion that exists. What is **not** kept is the attribution guard: it existed because the
deleted hook fired once per terminal transition and `settle()` can terminalize several leases, so the guard stopped
one request's cost being recorded under another's id. At the `agent_end` site there is exactly one current request, so
the hazard it guarded against is not present - and the guard's absence is the symptom that the hook was the wrong
place.

## Where the ledger record's `acceptanceId` comes from

The surviving writer resolves it from the checkpoint's next acceptance, the corrective action, or the task's
`activeAcceptanceId` (`:2416`). That is a **different rule** from the one the deleted hook used (the `in_progress`
criterion). They are not reconciled here: the ledger record's `acceptanceId` is optional and informational, while the
one that matters for the event is the one the reducer checks. Reconciling two optional fields would be a change to
what the surviving writer means, and this task is about how many writers there are. **Recorded, not done.**

## The false statement, and its replacement

Before: "**Declared, and inert end to end:** nothing emits the event (`toConvergenceEvent` has no case for it) and
`appendTaskResourceObservation` (`execution-ledger.ts:374`) has no callers, so `observedResources` stays zero in a
live run." The second clause is false and was written by the task that acted on it.

After: the ledger observation was **always** written, by the `agent_end` site; what had no producer was the
**`request.observed` event**, so the convergence record's `observedResources` stayed zero while the ledger beside it
filled up. The correction says that, and the corrected text keeps the `file:line` anchors so a reader can check it.

## Recorded, not built: the coverage the surviving guard does not have

The surviving writer is guarded by `currentRequestPlan && currentRequestTaskId`, so **a request with no task is not
observed at all** - a fast-lane request costs whatever it costs and leaves no resource record. The deleted hook had
covered that case (it wrote a record with `convergenceSkipReason: no-formal-native-task`), so this repair **narrows
coverage** as the price of removing the duplicate.

That narrowing is recorded rather than hidden, and it is not repaired here: widening the guard means deciding that a
request outside a task is worth observing, which is a decision about the record's scope with its own evidence. What
matters for the reader is that the spec now says so, and the host test asserts the current truth - so a future
widening is a deliberate edit to a line that names the behaviour, not a silent change.

## Verification and rollback

- **The count is the assertion.** One `task.convergence.observed` record per request terminal, with the surviving
  stepId, asserted from the ledger file in the host test - which is also what a reader would check by hand.
- **Rollback** deletes the event call and restores nothing else: the ledger keeps being written by the site that
  always wrote it, and the convergence record goes back to zero `observedResources`. That is a smaller rollback than
  the previous task had, which is one of the reasons the single writer is the better shape.
