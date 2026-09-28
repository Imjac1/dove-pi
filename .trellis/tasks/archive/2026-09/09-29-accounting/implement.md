# Implementation plan: the accounting

## Ordered checklist

- [x] **1. The span boundary.**
- [x] **2. The counts by area.**
- [x] **3. The largest change.**
- [x] **4. The gate.**

## The span, and its boundary stated before the numbers

```text
boundary   f822a0b - the commit that added the first 09-28 task directory
commits    530

by area                 files   insertions   deletions
src                        20        1198         191
tests                      32        2491          33
.trellis/spec              14         777         186
.trellis/tasks            800       18716         241
```

## The largest single changes, and what they are not

```text
tests/document-drift.test.ts        +456
tests/harness-readings.test.ts      +314
src/core/failure-reading.ts         +303
tests/failure-reading.test.ts       +266
```

**These are not this span own work, and the boundary is why.** The span was defined by a *directory date* - the first `09-28` task - and it
therefore contains everything committed after that, including work from before the rounds this session has been recording. **A count over a
date range is a count over a date range**, and calling it "what this span changed" would overstate it. **What the count does say reliably is
the shape**: the record *dwarfs* the code, at 18716 insertions against 1198 in the source - **eighteen lines of task record for every line of
source**, which is what a change whose main product is evidence looks like.

## The gate

**Nothing was changed in this round but its own record**, which is the same shape as the last one: when there is nothing reachable left, an
account is the honest form of work, and an account of a range has to say what the range is.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **Any claim the count does not support.**
2. **The first real turn.**