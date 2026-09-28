# Implementation plan: the capability incentive

## Ordered checklist

- [x] **1. Measure what the adapter injects.**
- [x] **2. Find that both halves of P1 exist.**
- [x] **3. Reconcile the previous round fuse against the existing guard.**
- [x] **4. The gate.**

## Validation commands

```powershell
npx tsx --test tests/session-fuse.test.ts tests/context-guard.test.ts
npm test
```

## Why no third mechanism was added

**Two already exist and are wired in.** Adding a third would be the failure this session keeps recording: a
mechanism built beside one that was never inspected. **What P1 actually needs is a measurement of why the model
does not invoke, and that measurement is not obtainable from this repository** - it needs a host running a real
turn.

## Recorded, not built

```text
the fuse is unwired   evaluateSessionFuse has six holders and no caller; wiring it means changing the request
                      path, which deserves its own round
P1 real question      the incentive exists in the prompt and in the matched-command hint, and the model still
                      does not call. Why is not answerable from here
P2 and P3             editor alignment across hosts, dispatch through the Trellis lifecycle, and surfacing
                      the diagnostics the fuse reads
```
