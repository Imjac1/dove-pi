# The corpus as a reading

## Goal

Make "what does the recorded corpus contain" a **reading** instead of something rediscovered by hand each round, and
print the finding this round research produced: the fuel gap is a **preservation** problem, not a "nothing ever fails"
problem.

## Background: the measurements, this round

A scan of every `execution.jsonl` under the temporary directory - 174 ledgers, all of them walked - found:

| Fact | Count |
|---|---|
| ledgers from the blackbox harness | 173 |
| ledgers from anything else | 1 (the fixture a previous round wrote) |
| `request.terminal` records whose reason is not `completed` | **0** |
| `gate.refused` records | **0** |
| change manifests (`change.recorded`) | **0** |

**The conclusion is not that the harness never fails.** The host suite drives a convergence refusal, a fence refusal and
a recorded manifest on purpose; those ledgers exist while the tests run. **They are not in the corpus because nothing
preserves them**: `tests/pi-adapter.test.ts` makes its state directory with `mkdtempSync` and takes it away with it,
while the blackbox harness keeps its state under a scenario root. So the corpus is skewed by *which* runner keeps its
ledgers, and the paths that carry the interesting evidence are exactly the ones that do not.

That is worth a reading rather than a note in a task record, because every round so far has asked the same question by
hand and reached for a different answer.

## Requirements

- **R1 - One summary of many ledgers, and it is pure.** `src/core/harness-corpus.ts`: given the ledgers (path and
  records), return the aggregate - ledger and record counts, record kinds, terminal classes, refusals by label, the
  failures from the failure reading, and what the corpus does not contain.
- **R2 - It reuses the rules rather than restating them.** Terminal classes come from `classifyTerminal` and failures
  from `readFailures`, so a corpus reading cannot disagree with the axis or with the mining half about what a failure
  is - and it gets their refusals, their skip accounting and their corpus notes for free.
- **R3 - What is missing is part of the summary, and so is where it is missing from.** A corpus with no failure record
  is reported together with the reason this one has none: the runners that exercise those paths do not keep their
  ledgers. A reading that says "zero failures" and stops is the one this project keeps having to correct.
- **R4 - The script walks, and says what it walked.** `scripts/harness-corpus.mts [root ...]`: default roots are the
  temporary directory and the resolved Dove state directory; it prints the summary and exits 0 in every case, including
  a root that does not exist and a corpus with nothing in it.
- **R5 - It is a reading, not a gate.** Like the other four: no threshold, no assertion, exit 0 always.

## Acceptance Criteria

- [ ] **AC1** The summary counts ledgers, records and kinds across a constructed set of ledgers.
- [ ] **AC2** Terminal classes come from the axis classification: a fixture with one failure, one recovery, one
      cancellation and one completion reports one of each class, and the failures appear as failure records.
- [ ] **AC3** Refusals are grouped by label with composites split, and a refusal with no request id is counted in the
      unrefused total rather than attributed.
- [ ] **AC4** A corpus with no failure says so **and** names the preservation gap as the reason it has none.
- [ ] **AC5** The script prints a summary for the real corpus, exits 0 with no ledger at all, and exits 0 for a root
      that does not exist.
- [ ] **AC6** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.
- [ ] **AC7** The loop specification records the reading and the preservation gap it reports.

## Out of scope

- **Preserving the test ledgers.** Whether a unit test should leave state behind is a decision about the tests, and the
  honest corpus is made of runs rather than of tests. Recorded here with the measurement that motivates it.
- **A blackbox scenario that fails on purpose.** It is the other way to put real fuel in the corpus and it needs the
  scenario runner and a real provider; the reading is what tells us whether it is needed.
- **Storing readings, or a dashboard.** One command, printed.
