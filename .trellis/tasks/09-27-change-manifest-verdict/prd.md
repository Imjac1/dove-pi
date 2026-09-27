# The change manifest: a two-sided prediction, and a per-edit verdict from observed deltas

## Goal

Make a harness change **falsifiable by the next evaluation**. An edit records what failure motivated it, what it
infers the root cause to be, what it changed, and **which movements it predicts**; the next read intersects those
predictions with **movements actually observed** and reports a verdict per edit. AHE states the purpose better than
this file can: it "replaces rationale-driven self-justification with a measurable contract between rounds"
(`2604.25850` §3.3).

This is pieces 2 and 3 of the bounded-self-improvement scaffold, and they turn out to be **one artifact**: AHE's
manifest entry names "the failure evidence, the inferred root cause, the targeted fix, and a predicted impact
comprising both expected fixes and at-risk regressions" - which is Self-Harness's failure record *plus* a prediction.
The two fields that looked like separate work in Round 11 delta 5 (`rootCause` distinct from the verifier-level
cause, and the passing behaviour a change must not regress) land as the first and the last of those four. Piece 1 -
the fence - protects the surface; this makes a change to it checkable.

## Background: what the field measured, and what it forces here

Read from the primary source, not the abstract (`2604.25850` §3.3, Appendices B.2, C.3, D):

- **The manifest.** "Each edit attaches a manifest entry that names the failure evidence, the inferred root cause,
  the targeted fix, and a predicted impact comprising both expected fixes and at-risk regressions; this manifest is
  the loop's evidence ledger." Each also carries a **constraint level** (prompt / tool implementation / middleware
  / ...), and every entry is "subject to the same automatic rollback if their predicted fixes do not appear".
- **The check.** "In the next round, the loop **intersects the predicted-fix and predicted-regression sets with the
  observed task-level deltas** to produce a per-edit verdict."
- **The regression half does not work, and it was measured.** Across 9 rounds: **43 unique regression predictions,
  5 landed (cumulative P = 11.6%)**, while **40 regressions it did not foresee actually occurred (cumulative
  R = 11.1%)**.
- **Attribution needs a previous round**, not an absolute score: "a seed already fitted to the target benchmark
  would contaminate every subsequent edit's attribution".

Three readings this task takes as requirements rather than options:

- **R1 - A prediction verified only by "the reference resolves" is refused by this design.** Resolvability is a
  claim that a record exists, written by the same party that wrote the prediction. The verifiable form compares a
  **predicted movement** against an **observed movement**.
- **R2 - The observable universe is closed and read by the harness, never supplied as prose.** Otherwise the
  contract is self-reported again. Three members, each verified against the writer that produces it (step 0):
  criterion statuses and the D3 `verification` vector from the snapshot, and **gate refusals by atomic label** from
  the ledger - ten labels, because that is what the writers record (`deny`, `scope`, `registered`, `limit`,
  `conformance`, `sandbox`, `technique`, `fence`, `ask`, `effect-claim`). A recorded label may be a **composite**
  (`deny+scope+registered+ask`), so the read splits on `+` and counts atoms. `stop-reasons` was in this set and left
  it: it is three vocabularies meeting in one field, and a subject that cannot be matched is a prediction that is
  permanently contradicted.
- **R3 - The regression field is carried, and is not sold as a control.** Absence must be explicit, but at P/R
  around 11% it is a record, not a protection. Regression *detection* stays where it already is: held-out criteria,
  the gates, and the fence. The record says so in its own words.

## Requirements

- **R4 - A change manifest can be recorded** through a new convergence operation, carrying: a `surface` from a
  closed set (AHE's seven components, which the misevolution pathways of `2509.26354` map onto), a failure-evidence
  ref, a root cause, the fix, one or more **predicted fixes**, and zero or more **predicted regressions** - the
  latter stored as an explicit `none claimed` when empty rather than left blank.
- **R5 - A prediction is a movement over a closed observable set**, not a sentence: an observable, a subject, and a
  direction (a state a subject moves into, or a count that moves down or up). An observable or direction outside
  the set is refused, and the refusal names the whole set.
- **R6 - The baseline belongs to the harness.** The values a verdict compares against are **read by the harness when
  the manifest is recorded** and stored with it. A caller-supplied baseline is refused: it would let one party write
  both sides of the contract.
- **R7 - The verdict is computed in the status read**, beside the D3 `verification` vector, as
  `pending` / `confirmed` / `contradicted` / `unobserved`, each carrying the observed deltas that produced it.
  `confirmed` requires the movement to be observed; an observable that cannot be read is `unobserved`, **never**
  `confirmed`.
- **R8 - `status` stays read-only.** A manifest cannot be recorded or amended through it, and the existing
  mutation-field refusal keeps holding.
- **R9 - The record states its own limits**, in the artifact and in the spec: one task's run is not a benchmark
  (AHE measured 9 rounds over a benchmark with k rollouts per task, so an observed delta here is weak evidence), and
  the regression predictions are not a protection.

## Acceptance Criteria

- [ ] **AC1** A manifest records with `surface`, failure evidence, root cause, fix, at least one predicted fix and
      an explicit regression stance; a manifest with **no** predicted fix is refused, naming the reason (a change
      with nothing predicted is a rationale).
- [ ] **AC2** An unknown observable, an unknown direction, or an unknown surface is refused, and the refusal names
      the closed set it must come from.
- [ ] **AC3** A caller-supplied baseline is refused.
- [ ] **AC4** The status read returns a `changes` vector beside `verification`: one entry per manifest, with its
      verdict and the observed deltas that decided it.
- [ ] **AC5** A manifest whose predicted fix is observed afterwards reads `confirmed`; one whose predicted fix did
      not happen reads `contradicted`; one whose observable cannot be read reads `unobserved`. An unreadable
      observable never reads `confirmed`.
- [ ] **AC6** A `status` call that carries a manifest field is refused, and names the operation that records one.
- [ ] **AC7** An empty regression set is stored as an explicit `none claimed`, not as an absent field.
- [ ] **AC8** `npm run typecheck`, `npm test` and `tests/spec-context-budget.test.ts` pass, and the spec records the
      contract.
- [ ] **AC9** No shipped mode, policy control or host behaviour changes: this is additive to the convergence record.

## Out of scope

- **Automatic rollback.** AHE rolls an edit back when its predicted fixes do not appear. Here a rollback that moves
  a permission boundary needs HITL (`2605.18747` §3.5.3), and the fence is what keeps that boundary out of reach.
  So this task **reports** a contradicted verdict and stops; the decision is a human's.
- **D6's scoring.** The verdict compares one round against the previous read for one task. Comparing harness
  *variants* under controlled conditions is D6, and it stays deferred.
- **The declared editable surface** (D5(c) in its Round 11 form) - the fence protects paths today; declaring which
  surfaces are editable is a separate piece.
- **Any new observable** beyond the closed set in R2. Adding one is a decision with its own evidence.
