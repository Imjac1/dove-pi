# The diagnostics by default

## Goal

Show the cache diagnostics by default in `/status`, rather than behind a `full` flag.

## Background: a tension that was measured and does not exist

The round before this one found the diagnostics are already surfaced, behind a `full` flag, and called that a
visibility question. **The first thing this round measured is whether that text reaches the model** - because if
it did, showing it every turn would add tokens per request and work against the review own goal.

```text
extension.ts:1137   pi.registerCommand("status", { handler: async (args, ctx) => {
extension.ts:1153   ctx.ui.notify(`Dove Pi: workspace=...${cacheText}${strategyText} ${detail}`, "info")
```

**It is a command handler and the output goes to `ctx.ui.notify`**, which is the user screen and not the request.
**So the change costs zero tokens**, and the tension was a guess that measurement retired.

## What was changed, and why the line splits

```text
before   const cacheText = full ? ` Cache: <cache>. Goals: <goals>.` : " Use /status full for cache diagnostics.";
after    const cacheText = ` Cache: <cache>.${full ? ` Goals: <goals>.` : ""}`;
```

**The two halves cost differently.** The cache text is formatted from diagnostics already inspected one line
above; **the goal line needs `await ledger.read()`**, which is a file read, so it stays behind `full`. **And the
hint the old line printed - *Use `/status full` for cache diagnostics* - is gone, because it is no longer true.**

## The holder this does not have

**The `/status` command has no direct test.** The two `/status` matches in the suite are about
`agent_task_convergence` status-shaped arguments, and `document-drift` one is about a workflow sentence - **all
three are false positives for this command**. Holding it would need the fake extension host those adapter tests
build, with an `events.get("input")` driver and a `ctx.ui.notify` spy. **That is a larger change than the edit, and
the honest form of the gap is to name it rather than to claim a holder that does not exist.**

## Acceptance criteria

- [x] **AC1** Whether the text reaches the model was measured before the change.
- [x] **AC2** The cheap half is unconditional and the expensive half stays behind the flag.
- [x] **AC3** The hint that became untrue is removed.
- [x] **AC4** The gate passes.