# Implementation plan: chasing the flake

## Ordered checklist

- [x] **1. Repeated runs**, each output saved first.
- [x] **2. The totals compared.**
- [x] **3. Any failure attributed.**
- [x] **4. The gate.**

## Three full runs, and no reproduction

```text
run 1   exit 0   tests 757   pass 755   fail 0   skipped 2
run 2   exit 0   tests 757   pass 755   fail 0   skipped 2
run 3   exit 0   tests 757   pass 755   fail 0   skipped 2
```

**Each output was saved before the next run started**, which is the procedure the previous round failed - and it is what made these three
readable after the fact. **The flake did not reproduce in three consecutive full runs.**

## And my own reading of those files failed twice, the same way

```text
attempt 1   a Select-String pattern of "^. (tests|pass|fail) " matched nothing
attempt 2   a regex of "^\\s*tests\\s+(\\d+)" matched nothing either
the file    says "  ℹ tests 757" - the line begins with markup, not with whitespace
```

**Both patterns were built from what I expected the line to look like rather than from the file.** That is the same class as the nine
word-searches this session that failed: a pattern is a guess until it is read against the thing it is supposed to match. The third attempt
printed the file instead, and the numbers were there all along.

## What this settles, and what it does not

**Settled**: the suite is stable across three consecutive full runs, so the earlier failure was not a standing condition. **Not settled**:
whether it was a flake at all, or a one-off from the machine - three clean runs is evidence of stability and not an attribution, and no cause is
named because none was measured.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **A fix for a test not shown to fail.**
2. **The first real turn.**