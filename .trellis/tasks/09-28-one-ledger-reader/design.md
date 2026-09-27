# Design: one rule, five callers, and one question left open

## The shape

```typescript
// execution-ledger.ts, beside the writer
export function parseLedgerLines(content: string): readonly ExecutionRecord[]

// read() uses it, and so do the four scripts
```

**Why the reader goes where the writer is.** The format is defined by what `append` writes - one JSON object per line, then a
newline - so the rule about what a line means belongs beside the code that writes them. A script importing it is a script
saying "this file has one format", which is the statement the two strict copies could not make.

## Why not just add a `try` to the two that throw

Because that leaves three implementations and five readers, and the next one to be written will be written by copying whichever
is nearest. The two thrown-away copies were *already* copies of the tolerant one with the `try` removed, which is what drift
looks like in this codebase: not a disagreement anyone chose, but a simplification nobody checked.

## The open question, recorded rather than answered

A partial line **at the end** is a crash: the writer appends one line per call, so the line was never finished and is not a
record. A partial line **in the middle** means the append guarantee was broken - two writers, a hand edit, a filesystem that lied
- and nothing in this repository says whether a reading should skip it, count it, or refuse the whole file. The contract states
that, names the options, and says which evidence would decide it: an observed corruption, which has not happened.

## Verification

- **The regression test is the verification**: the same truncated ledger that produced two exit codes of 1, in the suite,
  asserting what the readings now print.
- **AC2 is checked by counting**: `JSON.parse` on a ledger line should appear once, in the one reader, and the round reports
  the count rather than promising it.
