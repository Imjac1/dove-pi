# Design: the change manifest and the verdict it earns

## Boundaries - where each piece lives, and why there

| Piece | File | Why there |
|---|---|---|
| The record and its vocabulary | `src/core/task-convergence.ts` | The event union (`:73-100`), the snapshot (`:52-66`) and the reducer (`:230`) are the one place a formal task record is defined. A new event kind and a snapshot field go here or they are a second record. |
| The verdict | `src/core/task-convergence.ts`, not a new module | **Corrected at implementation.** This row first said a new `change-verdict.ts`. It would have had to import `AcceptanceStatus` (or restate the 5-member union, which is a second truth) from the record it judges, and the record would have to import `PredictedMovement` back - a cycle for no gain, because the module it joins is **already pure** (it imports `node:crypto` and nothing else). Same testability, no cycle, no duplicated vocabulary. |
| The read | `src/pi-adapter/extension.ts` | The observables come from the snapshot and from the ledger, both of which the adapter already holds (`ledger.read()` at `:1550`). Same split as D3: `unresolvedAcceptanceEvidence` decides in the adapter because the record of what the harness wrote lives there. |
| The operation | `src/project-provider/contracts.ts` (`:78-86`) and `native-provider.ts` (`:302-313`) | The provider is the only writer of a task record; an operation that bypassed it would be a second writer. |
| The tool input | `src/pi-adapter/extension.ts` (`:1511`) | One operation added to a union that already exists, with the predictions parsed and validated in `core`. |
| The contract | `.trellis/spec/backend/personal-agent-project-context.md` | The convergence contract is already there (the `dove-pi task convergence` surface, the event list, and the rejection matrix around `:209-241`), and the file has room. |

## The record

```typescript
/** The harness components a change may touch. AHE enumerates them (`2604.25850` §3.3); `2509.26354` measures
 *  misevolution along the same pathways. A closed set, because "which surface did this touch" is the question
 *  a misevolution guard has to ask, and a free string cannot be asked. */
export type ChangeSurface =
  | "system-prompt" | "tool-description" | "tool-implementation" | "middleware"
  | "skill" | "subagent-config" | "long-term-memory";

/** One predicted movement. A movement, not a sentence - see the verdict rule below. */
export type PredictedMovement =
  | { readonly observable: "criterion-status"; readonly subject: string; readonly to: AcceptanceStatus }
  | { readonly observable: "verification-state"; readonly subject: string; readonly to: VerificationState }
  | { readonly observable: "gate-refusals"; readonly subject: string; readonly direction: "down" | "up" }
  | { readonly observable: "stop-reasons"; readonly subject: string; readonly direction: "down" | "up" };

export interface TaskChange {
  readonly id: string;
  readonly surface: ChangeSurface;
  readonly failureEvidenceRef: string;      // the failure this answers, resolvable like any other ref
  readonly rootCause: string;               // inferred, and distinct from the verifier-level cause
  readonly fix: string;
  readonly predictedFixes: readonly PredictedMovement[];       // >= 1 - enforced, see AC1
  readonly predictedRegressions: readonly PredictedMovement[]; // may be empty; stored as an explicit claim of none
  readonly baseline: Readonly<Record<string, string | number>>; // READ BY THE HARNESS, never supplied
  readonly recordedAtRevision: number;
}
```

The snapshot gains `changes?: readonly TaskChange[]` and `lastObservedRevision?: number`. **Both optional on
purpose**: the snapshot is `schemaVersion: 1` and older records are on disk, so a reader is decoding files that
predate this change. An absent `changes` means "none recorded", which is true of every record written before it.

## The observable set, and why it is this small

## Step 0's result: three members, not four, and one of them has a shape nobody expected

Step 0 was in the plan because the observable set is a claim about what the writers actually produce, and a subject
that never matches makes a prediction **permanently contradicted** - the failure mode this task exists to prevent, one
level up. It found three things, and two of them changed the set.

| Observable | Subject | Read from | Movement |
|---|---|---|---|
| `criterion-status` | an `AC-*` id | the snapshot (`AcceptanceCriterionState.status`) | moves **into** a status |
| `verification-state` | an `AC-*` id | the D3 vector in the status read (`extension.ts:1553-1558`) | moves **into** a state |
| `gate-refusals` | an **atomic** gate label, from ten | the ledger's `gate.refused` entries (`execution-ledger.ts:327`) | count **down** or **up** |

**1. The label vocabulary is ten, not the eight this design first claimed.** Verified against every writer:
`deny` (`extension.ts:2292`), `scope`, `registered`, `limit`, `conformance`, `sandbox`, `technique`, `fence` and
`ask` (the policy's `labelled` calls, `action-policy.ts:334-518`), and **`effect-claim`** (`extension.ts:2450`, the
effect boundary). The first draft omitted `ask` and `effect-claim` - two labels that appear on real refusals.

**2. A recorded `gate` is not always atomic, so the reader normalises.** `extension.ts:2377` records the label
parsed from the reason, or, when a reason carries no `[label]` prefix, `activeActionPolicy.gates.join("+")` - a
composite such as `deny+scope+registered+ask`. A prediction naming one atom would never see a composite entry, so
**the read splits each recorded label on `+` and counts its atoms**. Without that, a whole refusal class would be
invisible to every prediction while looking present in the ledger.

**3. `stop-reasons` left the set, because it is not one set.** It is at least three vocabularies that meet in the
same field: the loop's stop reasons (`completed`, `providerError`, ... in `src/core/loop.ts`), the progress guard's
kinds (`consecutive-errors`, `repeated-failure`, `repeated-success`, `interactive-confirmation-loop`,
`read-only-budget`, `progress-guard.ts:44-48`), and the adapter's own policy terminals (`terminalForPolicy(...)`).
`request.terminal` records a **list** of them per request (`extension.ts:906`), not a typed single reason. Closing
that vocabulary is a task of its own, and until it is closed a `stop-reasons` prediction would be a subject that
never matches. **Deferred, with this evidence recorded** - it comes back when the vocabulary is one set.

**Also checked, because it looked like a fourth member: `convergence` refusals are not gate refusals.** The formal
task's product-mutation block writes `appendTaskConvergenceDecision` with `eventKind: "product_mutation.blocked"`
(`extension.ts:2331`) - a different ledger kind. A prediction over "convergence refusals" would have been
permanently contradicted.

**What is deliberately absent**, so a later round does not add it by accident: token counts, elapsed time, tool-call
counts, and a composite label taken as a subject. The convergence contract says resource observations never decide a
criterion, and a prediction over a noisy counter would manufacture verdicts. Adding a member is a decision with its
own evidence.

## The verdict rule

```
pending       no request.observed event has been recorded after the manifest revision
confirmed     the predicted movement is present in the current read, against the stored baseline
contradicted  the observable is readable and the movement is absent, or moved the other way
unobserved    the observable cannot be read at all - NEVER confirmed
```

**Why `pending` needs `lastObservedRevision`.** Without a round boundary the first status read after recording would
compare a baseline with itself and report `contradicted`, which is worse than useless: it would teach the loop that
every change fails. A round is a `request.observed` event (`task-convergence.ts:100`), which is the record's own
mark of "another request ran". Before one lands, the honest verdict is that no verdict is available yet.

**Why the baseline is stored, and why the caller cannot supply it.** AHE compares against the previous round's
task-level deltas; here the comparison is against the values the **harness read when the manifest was recorded**. If
the caller supplied those values, one party would write both sides of the contract - which is the failure R1 exists
to prevent. The tool schema therefore has no `baseline` field, and the operation refuses one.

## The tool input, and the schema-bytes trade-off

Predictions arrive as compact strings and are parsed and validated in `core`:

```
predictedFixes:      ["criterion-status:AC-003=passed", "gate-refusals:fence=down"]
predictedRegressions: ["verification-state:AC-008=unresolved_evidence"]
```

**Why not a typebox union of the four shapes.** It was measured in Round 10: `agent_task_convergence` alone is
1,753 bytes, **32% of every tool schema this extension registers in a prompt**. Four union variants on two array
fields would grow the largest schema again, for a shape a one-line parser validates with a refusal that can name the
whole closed set. The cost is a small custom grammar; the benefit is that the refusal, not the schema, teaches the
set - and a refusal is only paid when it is wrong.

## Two defects found while wiring, and what each changed

**1. `request.observed` has no producer, so the round boundary this design first chose was unreachable.** The design
took its `pending` rule from the last `request.observed` event and added `lastObservedRevision` to the snapshot to
carry it. Reading the producers found none: the kind exists in the event union (`:100`), in the decoder and in the
reducer, and **nothing emits it** - `toConvergenceEvent` has no case for it and there is no `observe` operation. The
field would always be absent and every verdict would read `pending` for ever, which is exactly the inert declaration
this project keeps finding in its own files. **The fix was not to wire it here.** Wiring it means the request lifecycle
- who observes a request, where, with which resources - and that is its own defect with its own evidence. What this
task did instead: **delete the field** (D1's rule - delete what you cannot honour) and take the boundary from the read
itself. A verdict is available once **any** event has landed after the manifest's revision, which is the moment the
comparison stops being a baseline compared with itself. Recorded here so the missing producer is not rediscovered,
and so a later round knows the field was removed deliberately rather than forgotten.

**2. The manifest had two shapes, and the codebase's convention allowed only one.** Text is what a caller writes
(`criterion-status:AC-001=passed`) and structure is what a record stores (`{observable, subject, to}`), so a wire form
carrying text and a record carrying structure were designed. Two bugs came out of the seam, in order:

- The event decoder was given **one** decoder for both, so a snapshot holding parsed movements failed to decode on
  the very next event - the record broke as soon as it was written. Split into a text door and a structure door.
- Then the operation carried parsed movements while the event decoder read text, so **every recorded manifest threw**
  at the provider boundary. The convention settled it: `TaskConvergenceEvent` declares the **decoded** shape, as
  every other event kind does, so an event carries structure and the reducer validates structure. The text door was
  deleted - it would have had no producer, and an inert path is the defect class this task's own PRD is about. Text
  now arrives in exactly one place, the tool input, through `parsePredictedMovement`.

Both are recorded because the second one is a lesson about the codebase rather than about this feature: **a shape that
differs between two layers of four is a bug that tests will find on the third layer.**

## Compatibility, and what this does not do

- **`schemaVersion` stays 1.** Both new snapshot fields are optional and default to absent, so every record on disk
  still decodes; `decodeTaskConvergenceEvent` gains one branch and the existing branches are untouched.
- **The `status` read stays read-only.** The verdict is computed, never written back, and the existing
  mutation-field refusal (`extension.ts:1539-1541`) keeps holding - a manifest field on a `status` call is refused
  and names the operation that records one.
- **No rollback.** AHE rolls an edit back when its predicted fixes do not appear. Rolling back here means reverting
  a commit, and a revert that moves a permission boundary needs HITL (`2605.18747` §3.5.3). **This task reports a
  `contradicted` verdict and stops.** The fence is what keeps the boundary out of the loop's reach while that
  decision is made.
- **Rollback of the change itself** is a `git revert` of the commit the manifest names, which is why one logical
  edit per commit is the repository's working shape already.

## Two limits recorded rather than discovered later

1. **n = 1.** AHE measured 9 rounds over a benchmark with k rollouts per task. This record compares one task's read
   against the read taken when the change was made, so an observed delta is **weak evidence**, and the spec says so.
   Making the delta strong is D6, and this task does not pretend otherwise.
2. **Regression predictions are a record, not a control** (P 11.6% / R 11.1% over 9 rounds). The field is carried
   because absence must be stated and because the field's manifest has it; nothing here claims it detects
   regressions, and detection stays with the held-out criteria, the gates and the fence.
