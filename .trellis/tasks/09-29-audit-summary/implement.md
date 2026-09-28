# Implementation plan: the audit summary command

## Ordered checklist

- [x] **1. Read the CLI routing and the ledger read API.**
- [x] **2. Write the summary projection.**
- [x] **3. Hold it with tests.**
- [x] **4. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
```

## What was read first

```text
src/cli.ts                       the command routing: args[0] === "doctor", and command === "status",
                                 "auth", "reset", "list", "show", "install"
src/core/execution-ledger.ts      parseLedgerLines, and the comment above it
```

## The constraint that shaped the whole projection

**`parseLedgerLines` carries this comment: *the one reader of the ledger line format, because five of them
disagreed*.** So the summary is built on it and adds **no second reading of the file** - it projects what that
one reader returns, and a truncated last line stays what that reader says it is. **A test asserts exactly that**,
because a second reader is the defect the comment was written about.

## And a test caught a real bug in the first implementation

```text
written    observed: toolCallIds.size + unattributable
test says  four tool calls, expect 4
actual     3 - and the assertion failed with "3 !== 4"
fixed      observed counts tool.observed records, which is what "tool calls seen" means
```

**The formula looked reasonable and was wrong**: it counted *distinct identifiers plus the ones with none*, which
is a different quantity from *how many calls ran*. **That is what the case was for, and it earned its place on
its first run.**

## What the summary deliberately does not claim

**Cross-turn stagnation and cache-prefix changes are not in it**, and the doc comment says so rather than
leaving a reader to notice: stagnation is a tool-loop child decision this vocabulary gives no kind of its own,
and cache-prefix evidence lives on the model gateway rather than on these records. **Counting something adjacent
and calling it stagnation would be exactly the failure this specification exists to prevent.**
