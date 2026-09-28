# Implementation plan: the boundary

## Ordered checklist

- [x] **1. Run every gate command, including the one that cannot work.**
- [x] **2. Read the open list and the goal numbers.**
- [x] **3. State the boundary with its evidence.**
- [x] **4. Change nothing.**

## Validation commands

```powershell
npm run typecheck; npm test; npm run test:installer; npm run doctor; npm run pi:smoke; npm run release:check
```

## Why this round exists at all

```text
the temptation   find a fourth thing to inspect, because a round that changes nothing can feel like a round
                 that did nothing
the answer       three rounds have inspected. The third found a check worth running and ran it. Writing the
                 boundary down once, with evidence, is worth more than a fourth inspection of the same tree
```
