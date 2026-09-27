# One reader for the ledger

## Goal

Make the five places that parse the ledger line format read through one tolerant reader, because two of them disagree with
the other three about a line a crash left half-written - and they are the two that mine failures.

## Background: the measurement, and the failure it produces

A ledger whose last line is half a record (an append that a crash cut short) was handed to every reading:

| Reading | Exit | Output |
|---|---|---|
| `harness-failures.mts` | **1** | **none** - it dies before printing anything |
| `harness-axes.mts` | **1** | **none** - same |
| `harness-corpus.mts` | 0 | it survives, and says what it found |
| `harness-rounds.mts` | 0 | it survives |

**So the two readings that mine failures are blind on exactly the run a maintainer most needs explained**, and the reason is
that the ledger line format has **five** readers:

| Reader | Tolerant? |
|---|---|
| `execution-ledger.ts` `read()` | yes |
| `harness-corpus.mts` | yes |
| `harness-rounds.mts` | yes |
| `harness-axes.mts` | **no** - a bare `JSON.parse` in a `map` |
| `harness-failures.mts` | **no** - the same line, copied |

**Which is the class this repository keeps finding**: one rule, several implementations, and the copies drifting apart. The
answer is not to add a `try` to the two that throw; it is to have one reader.

## Requirements

- **R1 - One exported reader** for the line format, in `execution-ledger.ts` where the writer lives, used by `read()` and
  imported by the four scripts - so the format has one implementation and the disagreement cannot recur.
- **R2 - The behaviour is the one already committed**: a line that does not parse is **not a record**, because the append
  guarantee is one line per call and a line the writer never finished was never written. Nothing about what the reading
  reports changes for a complete ledger.
- **R3 - The middle of the file is a different question**, and it is recorded rather than answered: a partial line anywhere but
  the end means the append guarantee itself was broken, and no evidence says whether a reading should skip it, count it, or
  refuse. That question is written down with its options instead of being decided inside this round.
- **R4 - A regression test** hands all four readings the truncated ledger and asserts exit 0 **and** that the records which were
  written are the ones reported - no phantom record, and no silence about the rest.
- **R5 - The rule is written in the contract** where the ledger is documented: a line the writer never finished is not a record.

## Acceptance Criteria

- [ ] **AC1** One exported reader exists, `read()` uses it, and the four scripts import it.
- [ ] **AC2** No script parses a ledger line itself: the check is that `JSON.parse` on a ledger line appears exactly once in
      the repository.
- [ ] **AC3** The truncated-ledger case is a test, asserting exit 0, the complete records, and no phantom.
- [ ] **AC4** The contract states the rule and the recorded open question.
- [ ] **AC5** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.

## Out of scope

- **Deciding the middle-of-file case**, which needs evidence about how a ledger could be corrupted mid-file.
- **A reading that reports unreadable lines**, which needs a shape its callers do not have: the host reads this ledger on the
  request path, where silence is right.
- **The blackbox harness own parsing**, which reads a different file.
