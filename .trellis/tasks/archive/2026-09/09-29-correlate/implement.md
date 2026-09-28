# Implementation plan: correlating the lifecycle records

## Ordered checklist

- [x] **1. Read the record contract and the kind union.**
- [x] **2. Write the correlator.**
- [x] **3. Hold it with tests.**
- [x] **4. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
```

## What was read first

```text
contracts.ts:90     ExecutionRecordKind: thirty-four kinds
contracts.ts:99     "Correlation identifiers are optional for legacy records but required for new runs"
contracts.ts:100    correlation carries requestId, sessionId, taskId, attemptId, providerCallId,
                    executionId and toolCallId
execution-ledger    the append sites, which showed which kinds each child writes
```

## What was written

```text
src/core/execution-ledger.ts   executionEvidenceFamily()  kind prefix -> the child that eliminated the defect
                               correlateExecutionRecords()  groups by requestId, then sessionId, then attemptId,
                                                            counts the families, marks an uncorrelated group incomplete
tests/execution-correlation.test.ts   5 cases
```

## The key is chosen by strength, and the test says why

**`requestId` identifies one logical user request** - the identifier the idempotency child exists to keep stable - so it outranks
`sessionId`, which is wider, and `attemptId`, which is narrower and does not pull a record out of its request group. **A record carrying
none of them is grouped under `unlinked` and its group is marked incomplete**: the contract says legacy records may carry no correlation,
**and an audit projection labels that rather than inventing a key from the timestamp.**

## Three mistakes on the way, all the session own recurring class

```text
typecheck   ExecutionRecordKind was used but not imported - one mechanical error, one fix
totals      a pattern of whitespace then the word matched nothing against a line beginning with a marker:
            exactly the round 152 failure, and the reader was rewritten to allow anything before the word
curation    task.py create seeds prd.md only, so implement.md has to be written by hand - and this is the
            second round in a row to reach the commit step without it. Recorded here so the third round does
            not: the task is not ready to commit until both files exist
```

**The count reader broke before the suite did. The totals then read 764 tests, 762 pass, 0 fail.**
