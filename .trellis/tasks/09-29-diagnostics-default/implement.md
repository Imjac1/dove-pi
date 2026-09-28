# Implementation plan: the diagnostics by default

## Ordered checklist

- [x] **1. Measure whether the text reaches the model.**
- [x] **2. Read the exact lines.**
- [x] **3. Split the line by cost.**
- [x] **4. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
```

## The measurement that decided the change

```text
the command handler    pi.registerCommand("status", { handler: async (args, ctx) => {
the output             ctx.ui.notify(`Dove Pi: ...`, "info")
the conclusion         user screen, not the request - so the change costs zero tokens
```

**Reading the handler before editing it retired a guess.** The guessed cost was tokens per request; the measured
cost is none, because the channel is the UI.

## Recorded, not built

**A holder for `/status`**: it needs the fake extension host the adapter tests build. Named here so the next round
that touches this command knows the gap is real rather than overlooked.
