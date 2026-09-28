# Implementation plan: the keepalive

## Ordered checklist

- [x] **1. Find the repository own observation about miss timing.**
- [x] **2. Derive the interval from it rather than from the review suggestion.**
- [x] **3. Write the policy as a pure function, off by default.**
- [x] **4. Hold it with tests.**
- [x] **5. The gate.**

## Validation commands

```powershell
npx tsx --test tests/session-keepalive.test.ts
npm test
```

## What is not built, and why it is not a gap in the policy

```text
the timer      a caller has to schedule the heartbeat. That is wiring, and the policy is the part that
               has a decision in it
the benefit    whether a keepalive actually keeps a given provider cache warm needs the network. The
               repository observation is about when misses happen, not about whether a heartbeat prevents
               one - and the honest reading is that it should, because the miss is time-driven
```
