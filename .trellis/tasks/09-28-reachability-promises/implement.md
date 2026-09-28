# Implementation plan: the promises on the reachability list

## Ordered checklist

- [x] **1. The entries**: every `wiredBy` and its reason.
- [x] **2. The tasks**: state each one from the task tree.
- [x] **3. The classification**, entry by entry.
- [x] **4. The gate.**

## The measurement, and the premise it refuted

```text
entries on the allow-list:  10
wiredBy: null               10
wiredBy: <milestone>         0

the task that made the original claims:  09-26-dove-agent-harness-capabilities  (finished, not in the active tree)
shrinks its own comments record:          six
```

**The premise was that the list carries promises from finished tasks. It carries none.** Every entry says `wiredBy: null` - "stated
rather than left blank" - and what is left is modules unreachable on purpose (the four readings) and modules that predate the framework
work and are claimed by nothing (`dispatcher`, `dispatch-policy`, the two adapters, the loop runner and its checkpoint).

**That is worth having because the exactness assertion cannot see it.** The test catches dead code arriving and a list rotting; it cannot
catch a promise whose task ended, because the list stays exact and the suite stays green either way. **The one thing the check is blind to
is now written where the next entry will be written.**

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **Wiring the modules**, which the promises are about.
2. **The first real turn**, which needs a Pi host.