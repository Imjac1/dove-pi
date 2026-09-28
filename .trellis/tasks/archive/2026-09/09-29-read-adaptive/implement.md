# Implementation plan: reading the adaptive formal workflow

## Ordered checklist

- [x] **1. Read the P0 PRD and plan.**
- [x] **2. Measure its claims against the source.**
- [x] **3. Archive it, since that is what it lacked.**
- [x] **4. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
```

## What it was missing

**Nothing but the archive.** Its plan is honest, its code is present, and its `check.jsonl` was never curated -
which is why `task.py start` would have refused it, and why it looked unfinished in the survey. **The survey
reported it as in_progress from `task.json`, and the plan said otherwise; the plan was right.**
