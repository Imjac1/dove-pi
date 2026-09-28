# Implementation plan: the fuse case

## Ordered checklist

- [x] **1. Read the file so the edit tool has a revision.**
- [x] **2. Establish the exact anchor and the exact whitespace.**
- [x] **3. Insert the case with the edit tool only.**
- [x] **4. Fix the staged order and the context type.**
- [x] **5. The gate.**

## Validation commands

```powershell
npx tsx --test tests/pi-adapter.test.ts
npm test
```

## What was measured rather than assumed

```text
the fuse on the entries    ran it directly: near_limit at 1.096 for the warm pair, cold_start for the idle pair
the wiring condition       read it: only cold_start notifies, so the test stages were the wrong way round
the interface indentation  Node JSON.stringify: no leading tab on "interface FakeContext {"
the entry shape            read from sampleFromEntry: type message, role assistant, usage, timestamps in ms
```

## Recorded, not built

**The status line and the fuse now both have holders.** What remains unheld in that handler is everything else
it does, and that is a seam question rather than a case question.
