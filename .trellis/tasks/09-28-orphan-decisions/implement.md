# Implementation plan: orphan decisions

## Before writing code

Load `trellis-before-dev`. Curate `implement.jsonl` / `check.jsonl` and start the task in this same turn.

## Ordered checklist

- [x] **1. The reading**: collect the decisions naming no change in the record, print them by id with the sentence.
- [x] **2. The test**: the orphan fixture, plus the assertion that an ordinary ledger prints no such line.
- [x] **3. The contract**: the ledger may hold decisions the record dropped, and the reading says so.
- [x] **4. The gate.**

## The probe results, all four, because three of them are negative findings too

```text
orphan-decision              a decision naming no change in the record   -> no line anywhere (fixed here)
negative-resources           a snapshot with toolCalls: -5                -> refused, and the reading says so (correct)
observation-unknown-acceptance  an observation naming AC-404              -> invisible, and outside the readings subjects
negative-ledger-resources    a resource record with toolCalls: -3        -> read by no reading, which is a gap of its own

every one of the four exited 0, which is the crash fix of two rounds ago still holding.
```

**The second line is the interesting negative**: the decoder bounds `observedResources`, so a negative count is refused, and the
reading reports the record as unreadable rather than printing a number. That is a previous round working on a case it was not
written for.

**The fourth line is recorded rather than fixed**: a resource record with a negative count is read by nothing at all - the axis reads
terminals and refusals, the failure reading reads failures, and the corpus walks ledgers - so no reading would show it. That is a
question about which reading should own the resource record, not a defect in the one that does not.

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/harness-readings.test.ts
```

## Recorded, not built

1. **Reattaching an orphan**, which nothing in the record can support.
2. **The first real turn**, which needs a Pi host.