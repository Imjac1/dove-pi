# Design: what a header is for

## The two rewrites

```text
document-drift.test.ts   was: two documents that name things (+ four checks)
                         now: five kinds of naming, each named, with the limits the file states

harness-readings.test.ts was: the layer only a hand had run
                         now: that, plus the four failure modes it holds - a truncated ledger, a record that cannot be
                              decoded, a decision no change carries, and a path that is not there
```

**A header is a cursor, not a summary.** A reader arrives at a file to answer one question: is the defect I care about caught here?
So the header names the kinds it holds and points at the limits - and it does not restate the cases, which are below it and cheaper to
read than a description of them.

## The convention, and why it is in the guidelines

```text
A test file header says what class of defect the file holds, and what it does not.
```

**It is a judgement and not a control**, like the count convention: no check can read a paragraph and decide whether it describes the
file. What can be checked is what the file does, which is what its cases are.
