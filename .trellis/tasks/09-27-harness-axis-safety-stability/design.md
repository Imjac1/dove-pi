# Design: the Safety & Stability reading

## Boundaries - where each piece lives, and why there

| Piece | File | Why there |
|---|---|---|
| The vocabulary and the arithmetic | `src/core/harness-axes.ts` (new, pure) | It reads `ExecutionRecord` values and returns numbers; no I/O, so every case - including the empty ledger and the composite label - is a unit test rather than a fixture-driven host test. |
| The reading | `scripts/harness-axes.mts` (new) | Same disposition as `scripts/mode-behaviour-map.mts`: it prints and never asserts. A threshold belongs to whoever decides to have one, with its own evidence. |
| The contract | `.trellis/spec/backend/personal-agent-framework-core.md`, in the evidence-plane scenario | The axis is a reading of the evidence plane, and that spec lost a scenario when the mode format was split out, so it has room. |

## The axis, in the field's own words

RSI-Bench states the axis as **Safety & Stability (SSM)** - "does self-modification preserve system integrity?" - with
the key metrics **crash-free ratio, Pareto preservation, sandbox violations**. This task computes two of the three and
declares the third.

```typescript
export type TerminalClass = "clean" | "recovered" | "interrupted" | "failure";

export interface SafetyAndStability {
	readonly axis: "SSM";
	readonly requests: number;
	readonly terminals: Readonly<Record<TerminalClass, number>>;
	/** clean / (clean + failure), or `undefined` when neither happened. */
	readonly crashFreeRatio: number | undefined;
	/** Reported **beside** the ratio, never folded into it. */
	readonly recoveredRate: number | undefined;
	readonly refusals: { readonly total: number; readonly byLabel: Readonly<Record<string, number>> };
	/** The two controls that make an isolation claim enforceable: `sandbox` and `fence`. */
	readonly isolationRefusals: number;
	readonly isolationRefusalsPerRequest: number | undefined;
}
```

## The classification, which is ours and is therefore stated

| `RequestTerminalReason` (`request-lifecycle.ts:7-16`) | Class | Why |
|---|---|---|
| `completed` | `clean` | the request reached its end. |
| `recovered` | `recovered` | it was interrupted and the harness brought it back. Reported **beside** the ratio: it is a stability *event*, and folding it into either side would hide it. |
| `cancelled` | `interrupted` | the operator ended it. |
| `superseded` | `interrupted` | a newer request replaced it. |
| `failed`, `startup-failed`, `startup-conflict`, `invalid-configuration`, `authorization-denied` | `failure` | the request did not do its work, for a reason the run did not choose. |

**Why a stated classification does not undermine the axis.** The field names the metric; it does not ship a
classifier, and a harness that cannot say which of its own endings it counts as a failure is not measuring. What
makes the reading trustworthy is not that the definition is someone else's - it is that the **evidence is the
harness's own records**, and the report prints all four counts so a reader who disagrees with the classification can
apply their own arithmetic without re-reading the ledger.

## What is counted, and against what

- `requests` - `request.terminal` records (`execution-ledger.ts:244`). One per logical request; several may follow
  from one settle, which is why the denominator is terminals and not "agent turns".
- `crashFreeRatio` - `clean / (clean + failure)`, and **`undefined` when the denominator is zero**. A ledger with no
  terminals must not report `1.0`: that is a perfect score from no evidence, which is the defect class this project
  keeps finding in its own files.
- `refusals` - `gate.refused` records, grouped by `details.gate`, with a recorded label **split on `+`** exactly as
  the observation reader splits it (`extension.ts:2377` can record `deny+scope+registered+ask`). Without the split,
  a composite entry would be invisible to every label it names.
- `isolationRefusals` - the `sandbox` and `fence` labels summed, because those two are what make an isolation claim
  enforceable, and a rate over requests is what a reader compares between runs.

## The axes we cannot read, as data

```typescript
export const UNCOMPUTABLE_AXES: readonly { axis: string; metric: string; reason: string; evidence: string; wouldNeed: string }[]
```

With one entry today: **Improvement Trajectory Quality** - slope, acceleration, stagnation escape rate - because it
needs a **per-round score** and none is persisted. The evidence is exact, not approximate: the criterion vector exists
only in `TaskCheckpoint.acceptanceVector` (`task-convergence.ts:40`), written when a checkpoint is written;
`task.convergence.decision` records `eventKind` (the *operation*), `state`, `snapshotRevision`, `acceptanceRevision`
and `acceptanceId` - and **not the criterion's status**, so a `progress` decision looks identical whether it started,
passed or failed one. `acceptanceRevision` changes when the criteria *set* changes, not when a status does.

`wouldNeed` records the small thing that would change it: the observation at a request terminal already runs once per
request and already carries a `TaskResourceObservation`; carrying the criterion vector beside it would make each
round's score a record. That is a decision with its own evidence, and it is deliberately **not** taken here.

## Why a report and not a gate

A gate needs a threshold, a threshold needs a decision about what a good refusal rate is, and that decision is not
this task's. What the reading gives is a **direction**: a change that raises isolation refusals is doing something,
and one that lowers them may have weakened a control - neither of which is "better" without a floor someone chose.
This is the same disposition `scripts/mode-behaviour-map.mts` took, for the same reason: a report that cannot be
mistaken for coverage.

## Compatibility and rollback

- **Nothing is written.** The module is pure, the script reads one file and prints. There is no migration, no new
  record, no changed contract, and a revert is a deletion.
- **No existing behaviour moves.** Nothing imports the new module except its test and the script, so the axis cannot
  change a decision the harness makes - which is the property a measurement must have before anyone trusts it.
