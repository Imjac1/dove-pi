# Personal Agent Convergence Record

The convergence contract for a formal native task, and the records around it: what is frozen, what a request observed,
what a change predicted, what the classifier of a failure said, what a round decided, and which commit embodies an edit.

The state this is about is documented in `personal-agent-project-context.md`; the loop that reads these records is
documented in `personal-agent-harness-loop.md`.

## Scenario: Formal Task Convergence State


### 1. Scope / Trigger

Trigger: a formal native task needs a frozen acceptance contract, bounded
checkpoint recovery, and host-independent finish semantics. Fast-lane requests
remain outside this state machine.

### 2. Signatures

```text
python ./.trellis/scripts/task.py convergence replay [--fixture PATH] [--trace NAME]
python ./.trellis/scripts/task.py convergence status --snapshot PATH
python ./.trellis/scripts/task.py convergence apply --snapshot PATH --event JSON
```

The Dove equivalent is `dove-pi task convergence <operation>` and persists
under `.dove/tasks/<goal-id>/convergence.json`.

### 3. Contracts

- `acceptance.frozen` establishes the ordered `AC-*` set and SHA-256 revision.
- Every product-work event carries an existing `acceptanceId`; unknown IDs are
  rejected before metadata or product mutation.
- `follow_up` findings are retained but do not block current acceptance work.
- `scope_change` and `serious_unexpected_risk` create one AC-bound checkpoint.
- `ready_to_finish` is terminal for product mutation in the frozen revision.
- **`request.observed` records what a request cost, and decides nothing.** The host writes one at the
  **end of a request** (the `agent_end` block, after the `request.terminal` record), from the counters it already
  keeps, and the **same object** goes to the ledger (`appendTaskResourceObservation`) and to the record - so the two
  cannot disagree about a round. It adds `observedResources` and a revision and touches no criterion, finding,
  completed step, state or checkpoint.
- **That block is the only writer of the kind, and the site is the design.** A producer on
  `appendRequestTerminal` would fire once per terminal *transition*, and one `settle()` can terminalize several
  leases - so it would record the active request's cost more than once and would need a guard against attributing
  that cost to a superseded request. The `agent_end` block has exactly one current request, so it needs no guard.
  **A second writer was added here once**, on the belief that this call did not exist, and a real ledger showed both
  records for one request; that is why this contract now names the writer rather than describing the data.
- **A request with no task is not observed at all.** The writer's guard is a current request plan and a task id, so a
  fast-lane request produces nothing - a **known gap**, recorded rather than implied, because covering it is a
  decision with its own evidence and not a detail of which site writes.
- **When the record cannot take the observation, the skip is named rather than silent.** The event
  needs an existing `acceptanceId` and the record refuses events after `ready_to_finish` or while
  checkpointed or blocked, so the observation attaches to the criterion that is `in_progress` and
  is skipped - with a typed `convergenceSkipReason` on the ledger record - when there is no active
  criterion, the state will not take it, or there is no formal native task. "Never observed" and
  "observed and discarded" must not look the same.
- **A change manifest predicts movements, and the next read decides them.** `change.recorded`
  carries the failure evidence, the inferred root cause (distinct from the verifier-level cause),
  the fix, and a **closed-set** prediction: `criterion-status:<AC>=<status>`,
  `verification-state:<AC>=<state>`, or `gate-refusals:<label>=down|up`, where `<label>` is one of
  `deny`, `scope`, `registered`, `limit`, `conformance`, `sandbox`, `technique`, `fence`,
  `ask`, `effect-claim`, `intensity`. **The last of those was found by the typecheck and not by a hand count**: the label a
refusal carries is typed as a member of the vocabulary, and the intensity ceiling refused with `intensity` while the set
carried ten - so that refusal class was one no prediction could name, and three earlier rounds had verified the ten by hand.
The vocabulary is declared once (a tuple, with the union and the set derived from it), the label a refusal carries and the
effect boundary are typed against it, and the policy gate list is checked against it by a test. **A label nobody produces is
checked by neither** - the type rejects new labels rather than unused ones.

  **Three more couplings are typed, and one channel cannot be.** The decision record carries a `ChangeVerdict` rather than a
string, and the axis isolation set is a `ReadonlySet<GateLabel>` - proven by renaming `fence` in the vocabulary and watching the
typecheck report five errors, four in the producers and **one in the axis**, which would otherwise have kept printing a
number that had quietly stopped counting fence refusals. The **reader** of a decision record stays a string, because an
append-only ledger holds what it holds and a reader that insists on today vocabulary breaks on yesterday records. And the
refusal channel itself must stay a string: a gate may be a **composite** (`deny+scope+registered+ask` is a legal value that the
axis splits), so a label typo in a *computed* label is covered by neither the typecheck nor the reader. At least one predicted fix is required; an empty regression set is a
  declared claim of none rather than a blank field.
- **The baseline is the harness's read, taken when the manifest is recorded** and stored with it.
  A caller-supplied baseline is refused at the tool boundary: one party must not write both sides
  of the contract a verdict is computed from.
- **The verdict is computed in the status read and never written back.** `pending` until any event
  has landed after the manifest's revision, then `confirmed` / `contradicted` / `unobserved`.
  `unobserved` answers for an observable that cannot be read and can never be `confirmed`; a
  predicted movement that was already true at the baseline is `contradicted`, because it is not
  evidence for the change.
- **Two limits, stated rather than left to be discovered.** One task's run is not a benchmark, so
  an observed delta here is weak evidence; and the regression predictions are a **record, not a
  control** - AHE measured P 11.6% / R 11.1% over 9 rounds, so regression detection stays with the
  held-out criteria, the gates, and the fence.
- Trellis calls the shared TypeScript reducer through its narrow helper; Dove
  never imports or executes Trellis scripts.

- **The Safety & Stability axis (`src/core/harness-axes.ts`) is a read-only projection of the append-only
  execution ledger**, never a second source of truth: a `crash-free ratio` over `request.terminal` reasons and
  `sandbox violations` over `gate.refused` labels, plus a **declared** list of the axes it cannot read.
  - **A terminal reason is classified by a table we state**: `completed` is clean; `recovered` is reported
    beside the ratio and never folded into it; `cancelled` and `superseded` are interrupted; the five
    startup/authorization/`failed` reasons are failures. The table is keyed by the reason union, so **a new
    reason fails the typecheck** rather than defaulting, and the test enumerates the closed set.
  - **No data is not no failures**: a ledger with no terminals yields `undefined` ratios, never `1.0`. A
    perfect score from no evidence is the failure this project keeps finding in its own files.
  - **A recorded refusal label may be composite** (`gates.join("+")`) and is split into its atoms - the same
    rule the observation reader applies, so the axis and the record agree about what a refusal is.
  - **The reading is printed, never asserted**: `scripts/harness-axes.mts`, exit status 0 in every case,
    including "no ledger found". A threshold is a decision with its own evidence.
  - **It lives here because it is a reading of the records this specification documents**, and it moved when the loop contracts were split to make room for the boundary they now state.
- **`change.decided` is the validation half of the loop, written at the round boundary.** A verdict existed only as
  a function computed on read and discarded, which reports and does not accumulate: the manifest is bounded and lives
  in one task, so a change whose verdict is still `pending` falls out and stops being recomputable. So the round that
  makes a verdict readable records it, **once per change**, with `verdictOnly: true`.
  - **The round boundary is the only writer**, and the status read stays read-only; deciding in a read would make
    `status` a mutation.
  - **The memory is the ledger**, not a process-local set: a set would re-decide every change after a restart and the
    record would claim two revisions for one decision.
  - **`pending` is never recorded.** It means the next round has not happened; writing "not yet" every round for every
    change is noise. `unobserved` **is** recorded, because it is an answer - the prediction named something the record
    does not carry - and it is not the same as no decision.
  - **The record reports and never acts.** Nothing on that path reverts an edit, mutates a criterion or refuses a call,
    and `verdictOnly` is what lets a reader tell a reporting record from an acting one.

- **`change.applied` binds a change to the commit that embodies it, and is what makes an edit revertible.**
  AHE requires the action space to be explicit **and** revertible; the surface declaration made it explicit, and until
  this record existed nothing gave a revert a target - "which commit was change X" was unanswerable. It is a **ledger**
  record, not a convergence event: the ledger holds what happened, the convergence record holds goal state, and an
  application is not goal state.
  - **The runtime records the claim and a script checks it.** The runtime cannot reach git, and a process spawn on the
    request path to check one claim would be a control where a reading belongs. `scripts/harness-rounds.mts` checks,
    where git and this project evidence readings already live.
  - **Three refusals, each naming what is wrong**: an unknown change id (a prediction must be pre-registered, so a
    commit naming no change is an edit nobody predicted); a second application for the same change, naming the commit
    already recorded (one commit per logical edit is what gives the revert its granularity); an empty commit.
  - **The check is `surfaceFit`, against the declared paths of the surface the manifest named**, using the fence own
    rule through `declaredPrefixHit` rather than a second implementation of it. It answers **`inside`**,
    **`outside`** with the offending files named, or **`unresolved`** when the commit cannot be resolved - a third
    answer and not a nicer word for `outside`, because "the edit went somewhere it declared it would not" and "nobody
    could tell" are different facts and only one of them is about the edit.
  - **A file outside the declared component reads `outside`, and that is information rather than a violation.** A
    manifest names one component; an edit that also changes the specification, the declaration, or another component is
    a fact worth seeing, not something to hide by widening the claim - and a component implementation surface includes
    its own tests, or every real edit would read `outside`.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Duplicate or unknown `AC-*` | Reject the convergence event before mutation |
| Malformed snapshot | Preserve bytes and block only convergence metadata writes |
| Acceptance revision drift | Record `scope_change` and checkpoint |
| Two semantic no-progress reviews | Checkpoint with one criterion-bound next action |
| All criteria pass with no open blocker | Enter `ready_to_finish`; reject further product mutation |
| Missing resource usage | Keep the field unknown; never infer a stop |
| A request terminal with no active criterion, or in a state that refuses events | Record the ledger observation with a `convergenceSkipReason`; offer nothing to the record |
| A superseded request settling after the active one | Record no observation for it; its `request.terminal` record stands alone |
| A change manifest with no predicted fix | Refused: a change with nothing predicted is a rationale, not a contract |
| A prediction outside the closed set | Refused, naming the observables and the gate labels |
| A caller-supplied `baseline` | Refused at the tool boundary: the baseline is the harness's read |
| A manifest field on `operation=status` | Refused, and the refusal names the operation that records one |

| A terminal reason outside the nine the type defines | Counted as unclassified; never folded into `clean` |
| A change whose verdict is still pending at a round | No decision recorded; the round has not happened yet |
| A change already carrying a decision | Never decided again, however many rounds follow |

| An application naming a change the record does not carry | Refused, naming the id; the manifest comes first |
| A second application for one change | Refused, naming the commit already recorded |
| A commit that cannot be resolved | `unresolved`, never reported as inside or outside |
| A touched file outside the declared paths | `outside`, with the files named |

### 5. Good/Base/Bad Cases

- Good: replaying `tests/fixtures/task-convergence-traces.json` through both
  hosts yields the same state, findings, checkpoint, and terminal decision.
- Base: a long run emits large resource observations while semantic state is
  unchanged and remains eligible to continue.
- Bad: treat a follow-up as current remaining work, regenerate an open-ended
  backlog after resume, or use tool/time/token totals as a hard stop.

### 6. Tests Required

- Replay every shared trace incrementally and from its complete event list.
- Assert `task.py convergence apply/status` round-trips an atomic snapshot.
- Assert fast-lane requests create no convergence file or mutation guard.
- Assert `ready_to_finish`, checkpoint, scope drift, and malformed-state paths
  fail closed at the Pi tool boundary.
- From a request terminal, assert the ledger observation and the snapshot's `observedResources`
  describe the **same** request (the record equals the snapshot delta), that the revision advanced
  by exactly one, and that a settle of two leases records one observation rather than two.
- Record a manifest and read the same revision (`pending`), then read after one event
  (`contradicted`, carrying the movement it compared); assert the stored baseline is the one the
  runtime read, and that a caller-supplied baseline is refused.

- The axis classifies every terminal reason the type defines, reports `undefined` ratios for an empty ledger,
  and splits a composite refusal label into its atoms.
- A round records one decision per decidable change and never a `pending` one, and a second round adds none.

- An application is recorded once per change, and a second one, an unknown change and an empty commit are each refused.

### 7. Wrong vs Correct

#### Wrong

```text
Check failed -> fix -> re-check until green, including newly discovered scope.
```

#### Correct

```text
Classify the finding against an existing AC; checkpoint scope/risk, and stop
product mutation once the reducer reports ready_to_finish.
```
