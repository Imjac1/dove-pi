# Implementation plan: the mode id that must not appear in core

## Ordered checklist

- [x] **1. The vertical ids.**
- [x] **2. The measurement.**
- [x] **3. The holder, or its absence.**
- [x] **4. A holder if warranted, then the gate.**

## The claim is false, and its principle is true

```text
the principle   "A vertical adds no core code. A mode id appearing in executable code under src/core is a framework defect."
the item        "A vertical mode id does not appear in executable code under src/core."
the measurement 45 files, 10 hits for the three vertical names, and three of them in executable code:
                work-mode.ts:751-752  if (options.workspaceMode === "pentest") { ... name: "pentest" ... }
                workspace-policy.ts:36  value === "development" || value === "pentest"
                and a type union at work-mode.ts:694
```

**The hits are a *workspace mode* called `pentest`, not the vertical.** The principle is about a vertical needing core code, and the item
restated it as a string search - **and by the principle own words, `"pentest"` in `src/core` would be a framework defect, which it is not.**

## What was changed, and what was deliberately not

**The item was qualified** to state the principle it was standing in for, and to name why a string search cannot stand in for it: a workspace
mode shares the name, so the word appears for a reason unrelated to the claim. **No test was added.**

**That is the point of the round.** The item could not be held because it is not checkable - and inventing a check would have produced exactly
the artifact that made it wrong: **a string search reported as a guarantee**. What *can* be held is that a mode is loaded from `modes/` rather
than built in, and that is where the loader is tested.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The other mode-format items.**
2. **The first real turn.**