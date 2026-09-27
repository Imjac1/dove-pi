# Design: the resource observation producer

## Boundaries - where each piece lives, and why there

| Piece | File | Why there |
|---|---|---|
| The operation | `src/project-provider/contracts.ts` (`:78-86`) | The provider is the only writer of a task record; an observation that bypassed it would be a second writer with a second vocabulary. |
| The event mapping | `src/project-provider/native-provider.ts` (`toConvergenceEvent`, `:293-321`) | One `case "observe"` next to the eight that exist. The event kind, its decoder and its reducer branch are already there and untouched. |
| The producer | `src/pi-adapter/extension.ts`, inside `appendRequestTerminal` (`:962`) | It already runs **once per request terminal** and has every number in scope (`:836-839`). The two other reset sites (`:2396`, `:2442`) are request *starts*, not ends, so they are the wrong hook. |
| The skip marker | `src/core/execution-ledger.ts` (`appendTaskResourceObservation`, `:374`) | The ledger record already carries `observationOnly: true`; a typed skip reason belongs beside it, so an operator can tell "no observation" from "observation dropped". |
| The contract | `.trellis/spec/backend/personal-agent-project-context.md` | It currently says the path records observations. It will say what is recorded, when, bound to what, and when it is skipped - replacing the inert annotation added on 2026-09-27. |

## The operation and the event

```typescript
// contracts.ts
| { readonly action: "observe"; readonly acceptanceId: string; readonly resources: TaskResourceObservation }

// native-provider.ts
case "observe":
	return { ...base, kind: "request.observed", acceptanceId: operation.acceptanceId, resources: operation.resources };
```

No change to `task-convergence.ts`: the kind (`:100`), the decoder (`:121`) and the reducer branch (`:277`) already
exist, and the branch is already written so that it touches `observedResources` and the revision and nothing else.

## The producer, and the two conditions it must check first

In `appendRequestTerminal`, after the ledger `request.terminal` write, for a **formal native task**:

```
1. read the snapshot; if it is not `working` or `verifying`, record nothing on the convergence side
2. find the criterion whose status is `in_progress`; if there is none, record nothing on the convergence side
3. assemble the observation ONCE (TaskResourceObservation) and use it twice
4. ledger.appendTaskResourceObservation({ ...observation, toolDurationMs, stopReasons, ...skipReason })
5. when 1 and 2 passed: projectProvider.mutateTaskConvergence(taskId, { action: "observe", acceptanceId, resources: observation })
```

**Condition 1 is not defensive padding.** `reduceTaskConvergence` refuses any event after `ready_to_finish` (`:255`)
and any event other than `task.resumed` while `checkpointed` or `blocked` (`:254`). A producer that ignored the state
would **throw inside `appendRequestTerminal`** - turning a bookkeeping failure into a request-terminal failure, which
is the one thing this hook must not do. Reading the state first is how the observation stays additive.

**Condition 2 is the record's own invariant.** `reduceTaskConvergence` calls `requireKnownAcceptance` before the
branch, so an observation must name a criterion that exists. An observation is not product work, but attributing it
to a criterion is what keeps it inside the model rather than beside it. When no criterion is `in_progress` the
observation is **skipped, not re-bound** to a pending or passed one, and the skip is recorded as a typed reason on
the ledger record so it is countable rather than invisible.

## One assembly, two consumers

The ledger wants flat fields (`toolCalls`, `providerRounds`, `elapsedMs`, `toolDurationMs`, the five token counts,
`stopReasons`) and the convergence event wants `TaskResourceObservation`
(`toolCalls`, `providerRounds`, `elapsedMs`, the five token counts). The second is a **subset** of the first, and the
names match, so one object with two extras satisfies both:

```typescript
const observation: TaskResourceObservation = { toolCalls: currentRequestToolCalls, providerRounds: currentRequestProviderRounds, elapsedMs, ...currentRequestResources };
await ledger.appendTaskResourceObservation({ ...observation, toolDurationMs: currentRequestToolDurationMs, ...(stopReasons.length ? { stopReasons } : {}), ...(skipReason ? { convergenceSkipReason: skipReason } : {}) });
```

That is not a convenience: it is the reason **R4** exists. Two assemblies of one round is how a field comes to be
added to the ledger and forgotten in the snapshot, which is exactly the drift this record already carries.

## What must not change, and how the test shows it

The spec promises that observations "cannot change semantic state", and the reducer branch honours it - it touches
`observedResources` and `revision` only. **AC3 asserts that as a diff**: project the snapshot with and without the
observation and require the projected semantic state to be byte-identical, with only the two resource fields
differing. A rule stated in a spec and asserted nowhere is the class of claim this project keeps finding in itself.

## Compatibility and rollback

- **Nothing on disk changes shape.** `observedResources` and the event kind already exist; a record written before
  this change still decodes and simply carries zeros, which is what it carried while the path was inert.
- **No new failure mode on the terminal path.** Every convergence-side step is guarded by the two conditions and
  wrapped so an additive failure cannot surface as a terminal failure - the same disposition the existing
  `appendTaskConvergenceDecision` call takes.
- **Rollback** is deleting the producer block and the operation case; the ledger records and snapshots already
  written stay readable, so a revert loses evidence rather than corrupting it. Recorded because that asymmetry
  matters: a rollback here is not free of consequence.

## One consequence to state rather than discover

`currentRequestToolCalls`, `currentRequestProviderRounds`, `currentRequestStartedAt`, `currentRequestResources` and
`currentRequestStopReasons` are reset at request **starts** (`:2396`, `:2442`, `:2986`). The observation therefore
describes the request that just ended, and only if the terminal runs before the next start. It does: the terminal is
emitted from the request lifecycle on completion, and the reset happens when a new request is accepted. **A test
pins it** - two sequential requests produce two observations whose tool-call counts differ - so a future reordering
of the resets is caught rather than silently summing two requests into one observation.
