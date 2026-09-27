# The verdict as a record

## Goal

Give the loop its **validation half as memory**: at the round boundary, record what the last change predicted and what
the next read found. Today that verdict exists only as a pure function recomputed on every read, so the harness never
keeps what its own edits did.

## Background: why recomputation is not enough, verified

- **The verdict is computed and discarded.** `verdictFor(change, observables)` (`task-convergence.ts:1040`) returns
  `pending | confirmed | contradicted | unobserved` and the status read reports it. Nothing writes it down.
- **The manifest is bounded and per task.** `MAX_CHANGES = 50` and the changes live in the convergence record of *one*
  formal task, so a change whose verdict is still `pending` falls out of the record as newer changes arrive - and
  then the verdict is not recomputable at all. A harness edit's effect also outlives the task that made it.
- **A verdict is an observation, not a function.** It is what was true **at a revision**, against the baseline read
  when the manifest was recorded. Recomputing it later against a different snapshot is a different question, and the
  observation record already establishes the convention: a round writes what it saw.
- **And the corpus has nothing in it yet.** A survey of 168 ledgers and 1517 records found only seven record kinds -
  all from happy-path blackbox runs: no `change.recorded`, no `gate.refused`, no `task.convergence.decision`, no
  `tool.observed`. So no decision exists today and none can; what this task establishes is that when a change is made,
  the round that follows decides it. That is stated rather than hidden, because a record with no producer and a
  producer with no input look identical from the outside.

## Requirements

- **R1 - The round boundary decides, once per change.** When a request ends and its observation is written, every
  change in the record whose verdict is no longer `pending` and which has no recorded decision yet gets one:
  `change.decided` with the change id, the verdict, the movements observed, and the revision it was read at.
- **R2 - The ledger is the memory.** "Already decided" is answered by reading the decision records, not by an
  in-memory set: a set would re-decide every change after a restart, and the whole point is that the harness keeps
  what it learned across sessions.
- **R3 - The record decides nothing, and says so.** It reports a verdict; it never reverts an edit, never mutates a
  criterion or a finding, and never refuses anything. `verdictOnly: true` follows the observation record's convention
  for the same reason: a reader must be able to tell a record that reports from a record that acted.
- **R4 - One assembly, two consumers.** The observables the decision reads are the ones the status read already
  assembles (`changeObservables`), extracted so both call it. Two assemblies is how a field comes to be added to one
  and forgotten in the other - the drift this record has already paid for once.
- **R5 - The decision is reported where a loop turn looks.** The status read reports the recorded verdicts beside the
  computed ones, so the durable memory is reachable without reading the ledger by hand. A record nothing reads is the
  defect this project keeps finding in its own declarations.
- **R6 - The logic is pure and testable without a host.** Choosing which changes are decidable, given a snapshot, the
  observables and the set of already-decided ids, is a function in `core`; the adapter only wires it to the ledger.

## Acceptance Criteria

- [ ] **AC1** A change whose verdict is `confirmed` after the next read produces exactly one `change.decided` record,
      carrying the verdict, the observed movements and the revision.
- [ ] **AC2** A change whose verdict is still `pending` produces none; a change that is `unobserved` produces one that
      says `unobserved` rather than being skipped.
- [ ] **AC3** Deciding is idempotent **across rounds and across restarts**: a second round with the same change
      produces no second record, and the check is the ledger rather than a process-local set.
- [ ] **AC4** `contradicted` is recorded as readily as `confirmed`: the loop learns from an edit that failed to do what
      it predicted, which is the case that matters most.
- [ ] **AC5** No path in the decision writes anything but the record: no convergence mutation, no revert, no refusal.
- [ ] **AC6** The status read reports the recorded verdicts for the task.
- [ ] **AC7** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.
- [ ] **AC8** The spec records the decision, the once-per-change rule and the convention that the record decides
      nothing.

## Out of scope

- **Acting on the verdict** (keeping or reverting an edit). That is a person's decision, and the loop's governance
  keeps the verifier outside the loop; this task writes down what was observed.
- **Clustering decisions into "which surfaces help".** That is a query over the records, and it needs decisions to
  exist first.
- **A failure reading of decisions** or a new script. The status read is the consumer; a report can follow when there
  are records to report.
- **Changing the manifest or the verdict function.** Both work; this task persists their output.
