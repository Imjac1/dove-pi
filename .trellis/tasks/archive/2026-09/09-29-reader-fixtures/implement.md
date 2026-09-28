# Implementation plan: fixtures that try to break the reader

## Ordered checklist

- [x] **1. Read parseLedgerLines.**
- [x] **2. Write the four fixtures.**
- [x] **3. Fix what they found.**
- [x] **4. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
```

## The defect the fixtures found

```text
the reader   JSON.parse, then `record && typeof record === "object" ? [record] : []`
the hole     typeof [] === "object", so a JSON array on a line was kept as a record
the crash    summarizeExecutionRecords read .kind off it, got undefined, and threw on startsWith
the fix      isRecord(parsed) plus `typeof parsed.kind !== "string"` - which is what the contract says,
             not a new rule: ExecutionRecord requires kind
```

**A malformed ledger took the whole summary down**, which is the failure this reader was written to prevent.

## And three assertions were wrong about the fixtures themselves

```text
said 5 records in incomplete.jsonl     the file holds 4 records and 1 cut line
said 5 tool calls                      three parse, because the cut line is the third tool.observed
said 2 unattributable calls            one: the fourth raw line is the one with no correlation
```

**Each was written from expectation rather than from the file**, and each was corrected by counting the file -
the same class as the nine word-searches and the truncated task name. **A fixture assertion is a claim about a
file, so the file is what settles it.**

## The secret case

**The summary is built from counts and from `details.reason`, so the free-text fields never reach it** - the
secret-bearing fixture asserts that `ghp_…`, `sk-live-…` and `hunter2` do not appear anywhere in the rendered
summary, and that the records are still counted.
