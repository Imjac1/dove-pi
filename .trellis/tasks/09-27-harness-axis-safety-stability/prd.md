# D6 first axis: a safety-and-stability reading from the ledger, and the axes we cannot read yet

## Goal

Take one **named** axis from the field - RSI-Bench's *Safety & Stability*, whose key metrics it states as
**crash-free ratio, Pareto preservation and sandbox violations** - and compute the parts of it that this harness
can read **from records it already writes**. Print the reading. Do not turn it into a threshold.

D6 has been the deferred item since the frontier round, on the reasoning that an instrument should come after the
thing it measures. Two pieces now exist to measure: the fence (a control that can refuse) and the change manifest
(a claim a round can falsify). And the axis is what makes either of them comparable rather than merely asserted.

**Why a named axis and not a scoring function of our own.** Our own D6 record already concluded it: "adopt a named
axis rather than invent a score", because a score we design is a ruler we own, and every convincing result in this
field was produced by a ruler its subject did not control. This task adopts the field's name and vocabulary, and
states which of its three metrics we can compute.

## Background: what the ledger actually holds, verified

| Metric the field names | Computable here? | Evidence |
|---|---|---|
| **sandbox violations** | **yes** | `gate.refused` records carry `details.gate` (`execution-ledger.ts:327`), and the labels include `sandbox` and `fence` (`action-policy.ts:334-518`). A recorded label may be **composite** (`gates.join("+")`, `extension.ts:2377`), so a count splits on `+`. |
| **crash-free ratio** | **yes, with a classification we must state** | `request.terminal` records carry `details.reason` (`execution-ledger.ts:244-245`), one of nine `RequestTerminalReason` values (`request-lifecycle.ts:7-16`), plus a `terminal` envelope with `origin` (one of seven). |
| **Pareto preservation** | **no** | It is a multi-objective property; nothing in the ledger records a second objective. Declared, not invented. |

And the axis this task will **decline**, with the evidence rather than with a shrug:

**Improvement Trajectory Quality** (slope, acceleration, stagnation escape rate) needs **per-round scores**, and this
harness does not persist one. The criterion vector exists only in `TaskCheckpoint.acceptanceVector`
(`task-convergence.ts:40`) - that is, only when a checkpoint is written. `task.convergence.decision` records the
*operation* (`eventKind`), the `state`, the `snapshotRevision`, the `acceptanceRevision` and an `acceptanceId`, and
**not the criterion's status**: a `progress` decision looks the same whether it started, passed or failed a
criterion. `acceptanceRevision` changes when the criteria **set** changes, not when a status does. So "how many
criteria were passed at revision N" is not reconstructible, and an ITQ number here would be invented.

**What would make it computable** is small and is recorded as a follow-up, not built here: the observation written
at a request terminal (`extension.ts`, `recordRequestObservation`) already runs once per request and already carries
a `TaskResourceObservation`; carrying the criterion vector beside it would make each round's score a record.

## Requirements

- **R1 - One module owns the axis's vocabulary and its arithmetic.** A pure `src/core/harness-axes.ts`: the axis
  name as the field states it, a **total** classification of the nine terminal reasons, and the derivation from
  ledger records. No I/O, so every case is a unit test.
- **R2 - The classification is stated, not implied, and is exhaustive by construction.** Each of the nine reasons
  maps to `clean` / `recovered` / `interrupted` / `failure`, and a test enumerates the closed set so a **new reason
  fails the test** rather than falling into a default. `cancelled` and `superseded` are `interrupted`, not failures:
  the operator or the session decided them. `recovered` is reported beside the ratio rather than folded into it.
- **R3 - No data is not the same as no failures.** An empty or headerless ledger yields `undefined` ratios and zero
  counts, never `1.0`. A harness that reports a perfect crash-free ratio from no evidence is the defect this
  project keeps finding.
- **R4 - Refusals are counted by control label, with composites split.** The same rule the observation reader uses,
  so the axis and the record agree about what a refusal is.
- **R5 - The axes we cannot read are declared as data, with the reason, and are printed.** A reader of the report
  sees that ITQ exists and why it is absent, rather than seeing a shorter report and assuming the axis was not
  measured.
- **R6 - The reading is a report, not a gate.** Same disposition as `scripts/mode-behaviour-map.mts`: it prints and
  never asserts, and its exit status is always 0. A threshold would be a decision with its own evidence.

## Acceptance Criteria

- [ ] **AC1** `classifyTerminal` is total over `RequestTerminalReason`; a test enumerates the nine values and fails
      if the classification does not cover one, so adding a terminal reason cannot silently default.
- [ ] **AC2** `safetyAndStability` returns exact counts and ratios for a fixture ledger, and `undefined` ratios for
      an empty one.
- [ ] **AC3** Refusals are grouped by label with `+`-joined labels split into their atoms (a fixture with a
      composite label proves it).
- [ ] **AC4** The not-computable list names Improvement Trajectory, the reason (no per-round score is persisted),
      the `file:line` evidence, and what would make it computable - all asserted, so it cannot be quietly dropped.
- [ ] **AC5** `node --import tsx scripts/harness-axes.mts <ledger>` prints the reading for a real ledger and exits 0;
      with no argument it reports that it found no ledger rather than failing.
- [ ] **AC6** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.
- [ ] **AC7** The spec records the axis, the classification, the two computable metrics and the deferred one.

## Out of scope

- **Comparing harness variants.** That is D6's eventual shape (HarnessOpt-Bench's split: an agent edits the harness
  on development feedback while a separate system scores candidates on **hidden** tasks). It needs a task set and a
  scoring function that do not exist, and this task is the prerequisite: a run that cannot be scored cannot be
  compared.
- **Any threshold, budget or gate.** The reading informs a decision; it does not make one.
- **Making ITQ computable** (see the follow-up above). Its own decision, with the record change it implies.
- **Pareto preservation.** Nothing records a second objective, and inventing one is not a measurement.
- **Cross-session aggregation, storage or a dashboard.** The script reads one ledger and prints.
