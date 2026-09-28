# Implementation plan: the skills

## Ordered checklist

- [x] **1. trellis-finish-work, read.**
- [x] **2. trellis-check, read.**
- [x] **3. What each adds.**
- [x] **4. The gate.**

## The manual path is not complete, and this is where it is thin

```text
trellis-finish-work   Step 1 runs get_context.py --mode record and reviews active tasks
                      Step 2 classifies dirty paths and BAILS OUT if code changes are uncommitted
trellis-check         names get_context.py --mode packages, and reads the spec index per changed layer
```

**Two things the manual path does not do**: *survey the other open tasks*, and *classify dirty paths so that uncommitted code from this task
cannot be archived silently*. The second is a safety check, and the session has been running without it for 186 sessions.

## And the survey found five tasks that are not this session own

```text
[P1] Dove Interoperability Layer (in_progress)                    08-27-dove-interop-layer
[P2] dove-pi real-user web access (in_progress)                   08-28-dove-pi-web
[P1] Dove audit observability and regression (planning)           08-30-dove-audit-observability-regression
[P0] Dove Pi runtime reliability and synchronization (planning)   08-30-dove-pi-runtime-reliability
[P0] Dove Adaptive Formal Workflow (in_progress)                  09-01-dove-adaptive-formal-workflow
```

**Five open tasks, two of them P0, none of them this session own work.** The skill says to surface them with a one-shot confirmation and
default to no - **and that is what happens here**: they are surfaced and not touched, because whether they are done is not this session
judgement to make.

## The tools named but never run, now three

```text
get_context.py --mode record      prints active tasks, git status and recent commits
get_context.py --mode packages    names the packages and layers a change touches
get_context.py --mode phase       the step-level detail trellis-continue pulls
```

**All three exist and none had been run in this span.** That is the third round in a row to find a mechanism that was there - the toolset
last round, the skills this one - **and the pattern is now well enough established that the next round should look for it deliberately rather
than by accident.**

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The install.**