# Design: the verdict as a record

## Boundaries

| Piece | File | Why there |
|---|---|---|
| Choosing what is decidable | `src/core/task-convergence.ts` (pure) | It is a function of a snapshot, the observables and the set of already-decided ids, so every case - pending, confirmed, contradicted, already decided - is a unit test with no host. |
| The record | `src/core/execution-ledger.ts` (`appendChangeDecided`) plus `contracts.ts` (the kind) | Same shape as the observation: a flat record carrying the decision, and the convention that it decides nothing. |
| The round boundary | `src/pi-adapter/extension.ts`, in the `agent_end` block, **after** the observation is applied | The revision advances when the observation lands, and a change is decidable only once `currentRevision > recordedAtRevision` - so the decision reads the snapshot after that, or it would decide a round that has not happened. |
| The observables | extracted into one helper that both callers use | `changeObservables` already takes `unresolvedByCriterion` and the refusal counts, and the status read assembles both. Two assemblies is how a field is added to one and forgotten in the other. |
| The report | the `decided` list in the status read | The tool a loop turn already calls; a record nothing reads is the defect this project keeps finding in itself. |

## The pure part

```typescript
export interface DecidedChange {
	readonly changeId: string;
	readonly verdict: Exclude<ChangeVerdict, "pending">;
	readonly observed: readonly string[];
	readonly revision: number;
}

/** The changes whose next read has happened, and which carry no decision yet. */
export function decidableChanges(
	snapshot: TaskConvergenceSnapshot,
	current: ChangeObservables,
	decided: ReadonlySet<string>,
): readonly DecidedChange[];
```

It never returns a `pending` verdict: `pending` means the next round has not happened, and writing "not yet" on every
round for every change would make the record noise. It **does** return `unobserved`, which is a real answer - the
prediction named something this record does not carry - and returning it is the difference between no decision and a
decision that reads `unobserved`.

## The record

```json
{ "kind": "change.decided",
  "details": { "changeId": "...", "verdict": "contradicted",
    "observed": ["gate-refusals:fence: 0 -> 3 (prediction not met)"],
    "decidedAtRevision": 7, "verdictOnly": true } }
```

- **`stepId: "change:" + changeId`**, so the record is addressable by the change it decides and a duplicate is visible
  in the ledger rather than buried in `details`.
- **`verdictOnly: true`** follows the convention of the observation record for the same reason it exists there: a reader
  must be able to tell a record that **reports** from a record that **acted**. Nothing on this path reverts an edit,
  mutates a criterion, or refuses a call.
- **`decidedAtRevision`** freezes the revision the verdict was read against. A verdict is an observation, not a
  function: recomputing it later against a different snapshot answers a different question, and this record already
  decided that precedent once, when a movement already true at baseline became `contradicted` rather than re-judged.

## Idempotence, and why the ledger is the memory

`decided` is built by reading the `change.decided` records. A process-local `Set` was the obvious alternative and is
worse in the way that matters: it would re-decide every change on the next process start, so the record would claim
"decided at revision 7" twice with two different revisions. The ledger is append-only, and this path already reads it
for the refusal counts, so the memory costs one more pass over data already in hand.

## What a comment from the previous task said, and how this amends it

The status read carries: "**Decision observability read, and the only place a verdict exists.** ... nothing is written
back, so `status` stays read-only and a verdict can never become a claim the record makes about itself." That was true,
and it is deliberately amended: **the status read stays read-only**, and the writing happens at the round boundary,
where the harness already writes what a round cost. The half worth keeping is the one about self-reference - a verdict
is still read from the movements and never asserted by the manifest - so the comment is updated to say where the record
now comes from instead of being left to contradict the code.

## Verification and rollback

- **Unit**: the pure chooser over constructed snapshots and observables, including already-decided and pending.
- **Host**: the manifest scenario drives a change and then a round, and the test asserts exactly one `change.decided`
  with the verdict the movements support, and that a second round adds none.
- **Rollback** deletes the producer call and the record kind: decisions already written stay readable, and the status
  read computes verdicts exactly as it did before. Free, and stated because it will not always be.
