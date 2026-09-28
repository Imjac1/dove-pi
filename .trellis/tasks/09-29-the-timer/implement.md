# Implementation plan: the timer

## Ordered checklist

- [x] **1. Measure whether the adapter can schedule anything.**
- [x] **2. Measure what the host events offer.**
- [x] **3. Write the timer with an injected clock.**
- [x] **4. Make the fake clock model a timer.**
- [x] **5. The gate.**

## Validation commands

```powershell
npx tsx --test tests/session-keepalive.test.ts tests/harness-reachability.test.ts
npm test
```

## What is still not built

```text
the wiring    nothing constructs a SessionKeepaliveTimer yet, and the allow-list entry says what would
              reach it: the adapter round that schedules a heartbeat
the provider  the callback in production would make a request. That needs the network, which is why the
              policy is off by default and the clock is injected rather than called
```
