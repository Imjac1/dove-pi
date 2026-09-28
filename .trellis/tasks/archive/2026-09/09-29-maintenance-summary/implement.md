# Implementation plan: the maintenance summary

## Ordered checklist

- [x] **1. Read the contract and where the logs live.**
- [x] **2. Write summarize_maintenance_logs.**
- [x] **3. Hold it with tests.**
- [x] **4. The gate.**

## Validation commands

```powershell
npm run test:installer
npm test
```

## What was read first

```text
dove_pi.py:577   MAINTENANCE_SCHEMA_VERSION = 2
dove_pi.py:581   MAINTENANCE_UNAVAILABLE = "unknown"
dove_pi.py:608   project_maintenance_record(payload)
dove_pi.py:662   logs at layout.logs_dir / f"maintenance-{stamp}.log"
```

## What was written

```text
dove_pi.py   summarize_maintenance_logs(entries)
               runs        listed in order, with at, command, decision and durationMs
               byDecision  changed, no_op, and whatever else a record recorded
               runCount, runsWithoutDecision, runsWithDuration, totalDurationMs
tests/maintenance_summary_installer_test.py   6 cases
```

## The two counters that keep the summary honest

**`runsWithoutDecision` and `runsWithDuration`.** A summary that reported only run counts and a duration total
would look complete while explaining nothing - which is the archived defect, restated. **And the duration total
is `unknown` rather than zero when nothing could be measured**, because a sum of nothing reads as "no time at
all", which is a claim, where `unknown` is the truth.

## And the grouping that was deliberately not invented

**The defect is a *cluster* of runs, and the obvious implementation groups them by proximity.** That was not
done: **the design says correlation fields are identifiers and bounded hashes, and a timestamp is neither.** The
runs are listed in order with their times, so a reader sees the cluster - **the summary does not assert one
exists.** Inventing a window would be the same failure as counting something adjacent and calling it
stagnation.
