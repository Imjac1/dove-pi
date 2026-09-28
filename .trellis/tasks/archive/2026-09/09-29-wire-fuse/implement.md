# Implementation plan: wiring the fuse

## Ordered checklist

- [x] **1. Read the wiring site.**
- [x] **2. Check the diagnostics are reachable there.**
- [x] **3. Wire it beside the guard, under its own flag.**
- [x] **4. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
```

## The wiring, at the lines

```text
extension.ts:3117   const contextGuard = guardContext({ tokens: usage?.tokens ?? null, contextWindow, mode })
                    if (contextGuard.compactAdvised && contextGuard.hint && ctx.hasUI && !guardNotified)
                      -> guardNotified = true; ctx.ui.notify(...)

added beside it     const fuse = evaluateSessionFuse(
                      inspectCacheDiagnostics(ctx.sessionManager.getEntries()), contextWindow ?? 0)
                    if (fuse.state === "cold_start" && fuse.recommendation && ctx.hasUI && !fuseNotified)
                      -> fuseNotified = true; ctx.ui.notify(fuse.recommendation, "warning")

and                 let fuseNotified = false; beside let guardNotified = false;
```

**The diagnostics were already reachable at that site** - `inspectCacheDiagnostics(ctx.sessionManager.getEntries())`
is called at three other places in the same file - **which is why the wiring is four lines rather than a new seam.**

## What this does not have, stated because it is true

**The wiring line has no direct holder.** It lives inside a three-thousand-line event handler with no seam to test
it through, so what holds this behaviour is the fuse own six cases for the decision and the full suite for the
call site compiling. **A seam in that handler would be a larger change than this round**, and the honest form of
the gap is to name it rather than to claim a holder that does not exist.
