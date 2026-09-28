# Implementation plan: the seam question

## Ordered checklist

- [x] **1. Measure the handler span.**
- [x] **2. Read its shape: calls, branches, bindings.**
- [x] **3. Answer the question with the measurement.**
- [x] **4. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
```

## What would change the answer

```text
today        fifteen branches, each checking a value a unit produced or routing on it;
             six top-level calls, five of them named units with their own suites

signal       a branch whose decision is inline - a computation, a classification, a policy -
             that nothing holds. That is when a unit is missing and the handler should lose lines.

not a signal short lines, many locals, or a long file. Those are what orchestration looks like.
```

## Recorded, not built

**Nothing was changed.** The measurement answered the question, and the answer was that the earlier framing was
the thing that was wrong.
