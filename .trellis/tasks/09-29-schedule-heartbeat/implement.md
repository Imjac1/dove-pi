# Implementation plan: scheduling the heartbeat

## Ordered checklist

- [x] **1. Measure what the adapter may call on the host.**
- [x] **2. Find the three hooks that already exist.**
- [x] **3. Wire arm, observe and disarm.**
- [x] **4. Remove the allow-list entry the check flagged.**
- [x] **5. The gate.**

## Validation commands

```powershell
npx tsx --test tests/harness-reachability.test.ts tests/session-keepalive.test.ts tests/pi-adapter.test.ts
npm test
```

## What is still out of reach, and it is the last thing

```text
the act   nothing in this repository can send the keepalive. The host owns the provider, and the adapter ten
          verbs do not include one that reaches it
so        the timer reports, and the report is the whole of what this side can do about a cold prefix
```
