# Implementation plan: the message cap

## Ordered checklist

- [x] **1. Read context-guard.ts, since it already advises compaction.**
- [x] **2. Add the reader, the input, the interface and the branch.**
- [x] **3. Widen the deepEqual the new fields would break.**
- [x] **4. Two cases: the boundary, and the absent count with its control.**
- [x] **5. The gate.**

## Validation commands

```powershell
npx tsx --test tests/context-guard.test.ts
npm test
```

## Why this is one branch and not a mechanism

```text
already there   env reader with a validated default, a disable switch, an advisory-only contract,
                and an adapter that notifies the hint
added           one env reader, one input field, two interface fields, one branch
```

## Recorded, not built

**The adapter does not yet pass `messages`.** It reads the count from `ctx.sessionManager.getEntries()`, which the
fuse already calls on the same lines - so passing it is a one-line change there, and it belongs to the round that
touches that handler next rather than to the branch itself.
