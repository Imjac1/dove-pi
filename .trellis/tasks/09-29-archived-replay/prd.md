# The isolated replay of the archived scenario

## Goal

Build the isolated archived-scenario E2E replay whose acceptance criterion is no duplicate Dove registration,
request persistence or tool execution.

## Background: the harness exists, and one fact is missing

The child sixth plan item is the largest of the eight, and this round established exactly what it needs rather
than building it. **The reconnaissance is the product**, and one fact is still missing.

## What was read, and what it settles

```text
scripts/real-dove-blackbox.mjs   takes --scenario <path>, and isolates everything under a scenario root:
                                 workspace, dove-state, pi-session, run log, provider capture
tests/real-dove-blackbox.test.ts runHarness(project, output, extraArgs, timeoutMs, caseId) spawns it, and
                                 three existing cases already pass --provider faux --scenario <file>,
                                 so the scenario mechanism is in use and the scenario is a file the test writes
tests/harness-round.test.ts      NOT a turn driver, despite the name: it tests the surface fence. Read, and
                                 the name would have misled a guess
installer_test.py:314            the isolation house pattern: env["DOVE_PI_HOME"] = str(tmp / "DovePi")
managed-install-status.test.ts   and the injectable form: inspectManagedInstall({ DOVE_PI_HOME: root })
```

## The missing fact, named rather than guessed

**The replay needs the ledger file the harness run wrote**, so that `summarizeExecutionRecords` can count the
duplicates the acceptance criterion is about. **The driver summary carries `ledgerTerminal`, which comes from
the ledger, but nothing read here names its path** - it is under the scenario root, whose name includes a
nonce, so it cannot be constructed from the output path. **That is one grep in the driver away, and it is the
first thing the next round does.**

## Why this round stopped there

**Writing a replay that asserted "no duplicates" from a summary that has no duplicate counters would be a case
that proves nothing** - the failure mode this specification exists to prevent, and the one the previous round
caught in its own reader. **The reconnaissance is worth committing; a guess dressed as a replay is not.**

## Acceptance criteria

- [x] **AC1** The harness, its parameters and its isolation were read.
- [x] **AC2** The house pattern for keeping the real machine out was found and named.
- [x] **AC3** The missing fact is named, not guessed.
- [ ] **AC4** The replay itself, which needs the ledger path.