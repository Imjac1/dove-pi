# Implementation plan: the boxes

## Ordered checklist

- [x] **1. Count the boxes.**
- [x] **2. Read every P0 to P3 bullet.**
- [x] **3. Give each a verdict with the round it came from.**
- [x] **4. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
```

## The two items that are work rather than verdicts

```text
P0.2  DOVE_PI_MAX_MESSAGES - a configurable cap that advises compaction or a new session near the limit.
      Small, and advice rather than control: the host owns the conversation.
P0.3  keepalive - the affinity header is already set; the keepalive that would re-warm a cold prefix is not,
      and it needs the network. The plan own note says to make it optional and offline-first, which is the
      constraint that makes it a round rather than an edit.
```
