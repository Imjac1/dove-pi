# Implementation plan: the task status

## Ordered checklist

- [x] **1. The statuses**, from every task.json.
- [x] **2. The comparison**, against the directory.
- [x] **3. The classification**, by reading.
- [x] **4. Fix or record, then the gate.**

## The measurement

```text
task.json files:                     121
statuses:                            completed 114, in_progress 4, planning 2, active 1
archived but not marked completed:   0
active tree but marked completed:    0
archived and completed with a date:  114   (none without a completedAt)
```

**The status record is consistent in all three directions**, which is what the tool is for: `task.py archive` sets `completed` and stamps the
date, so the invariant is structural rather than asserted. **No check was added**, because the tool cannot produce a disagreement.

## The field that holds nothing

Every `task.json` carries a `commit` field, and **all 122 are null** - the field is declared and never filled, including by the archive. **The
record of what a task produced lives in the journal instead** (a previous round resolved 267 shas there), so the field is a duplicate of a job
that is already done somewhere else, and it says nothing.

**It is recorded rather than filled**, because the mapping from a task to its commits is not in the task files: the journal records them per
session, not per task. **A field nobody fills is the same class as everything else measured here**, and this one is in the tool own state file.

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **The status vocabulary**, which the tool defines.
2. **The first real turn**, which needs a Pi host.