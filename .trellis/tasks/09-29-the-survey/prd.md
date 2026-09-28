# The survey the skill prescribes, run for the first time

## Goal

Run `get_context.py --mode record` - the first step of the finish-work skill, read in round 158 and never
executed - and act on what it says.

## What the survey found

```text
[P1] Dove Interoperability Layer (in_progress)                        08-27-dove-interop-layer
[P2] dove-pi real-user web access (in_progress)                       08-28-dove-pi-web
[P1] Dove audit observability and regression (planning)               08-30-dove-audit-observability-regression
[P2] Reading the adaptive formal workflow (planning)                  09-29-read-adaptive
[P2] The survey the skill prescribes, run for the first time          09-29-the-survey
```

**And the umbrella, and every task archived earlier in this span, are absent** - so those archives worked. **Five
active tasks, four of them ours.**

## What was done about them

```text
08-27-dove-interop-layer                 archived   its one measured gap closed in an earlier round
08-30-dove-audit-observability-regression archived  all eight of its plan items were done across five rounds
09-29-read-adaptive                      archived   a reading task of mine whose archive had apparently failed
09-29-the-survey                         this task
```

## And the one left open, with the reason

**`08-28-dove-pi-web` stays open on purpose.** Its feature exists and is tested, and its PRD was written from the
code with its acceptance criteria *deliberately unchecked* - because checking them would be marking my own reading
as the intent, which is the failure this repository specification exists to prevent. **It stays until whoever wrote
the intent says whether those are it.**

## And one the survey did not list, which is worth finding anyway

**`08-28-dove-pi-usage-review` is still open on disk but did not appear in the survey**, so its `task.json`
status is one the survey filters. **Its work is done** - its P0 landed, the fuse it named was wired, and its P1,
P2 and P3 were each measured and answered - **but its plan carries twenty-three unchecked boxes**, and each box
describes work that is either done or measured as already existing. **Checking them honestly means saying which is
which**, and that is the next concrete piece of work rather than a formality.

## Acceptance criteria

- [x] **AC1** The survey was run for the first time.
- [x] **AC2** Every task it listed was archived or given a reason to stay.
- [x] **AC3** The one it did not list, and why, is recorded.
- [x] **AC4** The gate passes.