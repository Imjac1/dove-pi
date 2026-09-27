# Implementation plan: one reader for the ledger

## Before writing code

Load `trellis-before-dev`; read the five readers and the ledger writer. Curate `implement.jsonl` / `check.jsonl` and start the
task in this same turn.

## Ordered checklist

- [x] **1. The reader**: exported, tolerant, with the reasoning in its doc comment.
- [x] **2. `read()` uses it**, keeping the missing-file behaviour it already has.
- [x] **3. The four scripts import it**, and the two strict copies go.
- [x] **4. The test**: the truncated ledger, all four readings, exit 0, the complete records, no phantom.
- [x] **5. Count `JSON.parse` on ledger lines** and report the number.
- [x] **6. The contract**: the rule and the open question.

## The measurement, and the things this round got wrong on the way

```text
a truncated ledger, before:  harness-failures exit 1, no output;  harness-axes exit 1, no output
a truncated ledger, after:   all four exit 0, the complete records read, the partial line not a record
the count:                   one reader in src, four callers in the scripts, one exception named
```

1. **The first measurement was polluted by my own pipeline.** `| Select-Object -First 6` terminates the process it reads, so
   the exit codes I first reported were the pipeline own. The re-measurement used redirection and real exit codes, and it is
   the one the numbers above come from.
2. **The first insertion put the function inside the class**, because the doc comment it replaced was a member comment. The
   typecheck said so immediately, and the fix took **three refused attempts** - each refusing because the script own boundary
   check was wrong, never because it half-applied something. Brace depth zero and a clean typecheck on the fourth.
3. **The PRD was wrong about the blackbox script.** It said the blackbox reads a different file; measured, it reads
   `execution.jsonl` like everyone else and keeps a tolerant copy because it runs under plain node and cannot import a
   TypeScript module. That correction is in the contract, and the check that counts the reader names the exception rather than
   quietly excluding it.

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/harness-readings.test.ts
```

## Risky files

| File | Risk | Mitigation |
|---|---|---|
| The four scripts | A script that imports core code is a script that changes when core does, which is the point. | They already import their readings from core; this adds one more import of the same kind. |

## Recorded, not built

1. **The middle-of-file question**, with its options and the evidence that would decide it.
2. **A reading that reports unreadable lines**, which the request-path reader argues against.