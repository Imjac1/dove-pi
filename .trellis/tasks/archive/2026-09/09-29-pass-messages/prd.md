# Passing the message count, once

## Goal

Wire the turn cap the previous round added: pass the conversation count from the handler that reads it.

## Background: the round before this one recorded where the count already is

**The handler reads `ctx.sessionManager.getEntries()` twice on adjacent lines** - once to format the diagnostics
the fuse reads, and nowhere for the guard. **So the honest change is not to add a second call but to read once and
reuse**, which is also what keeps two adjacent advisers from drifting apart.

## What was changed

```text
before   const contextGuard = guardContext({ tokens, contextWindow, mode })
         const fuse = evaluateSessionFuse(inspectCacheDiagnostics(ctx.sessionManager.getEntries()), contextWindow)

after    const sessionEntries = ctx.sessionManager.getEntries();
         const contextGuard = guardContext({ tokens, contextWindow, messages: sessionEntries.length, mode })
         const fuse = evaluateSessionFuse(inspectCacheDiagnostics(sessionEntries), contextWindow)
```

**One read, two users, and a name that was free**: `sessionEntries` has zero occurrences in the whole file and was
not bound in the handler, which was checked before the edit rather than after the typecheck refused.

## And the holder this does not have, for the third time in this line of work

**The wiring line is held by compilation.** The two cases added last round test `guardContext` directly, so they do
not exercise the handler path, and the adapter suite session arrays are far below a hundred and fifty entries, so
the cap cannot fire in them. **Holding this line would need a case whose handler sees a long session**, and that is
the same seam question the round before that answered *no* to - **with one difference worth noting: this line *can*
be held, because the count is an argument the case controls.**

## Acceptance criteria

- [x] **AC1** The count is passed from the call that already reads it.
- [x] **AC2** The entries are read once and reused, not twice.
- [x] **AC3** Both suites pass, and the new fields did not break the existing shape assertion.
- [x] **AC4** The gate passes.