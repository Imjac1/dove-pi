# Implementation plan: the replay

## Ordered checklist

- [x] **1. Find the ledger path.**
- [x] **2. Write the replay.**
- [x] **3. Get the harness flags right.**
- [x] **4. The gate.**

## Validation commands

```powershell
npx tsx --test tests/archived-scenario-replay.test.ts
npm test
```

## Where the ledger is

```text
scripts/real-dove-blackbox.mjs:198   readLedgerEvidence(stateDir)
scripts/real-dove-blackbox.mjs:375   readFileSync(resolve(directory, "execution.jsonl"))
scripts/real-dove-blackbox.mjs:38    stateDir = resolve(scenarioRoot, "dove-state")
and scenarioRoot is in the run summary, so the test builds the path exactly
```

## The finding that changes how the harness is called

**The driver exits zero even when the scenario fails.** It reports the run outcome *inside* its summary -
`exitCode`, `scenarioFailed`, `stderr` - and a caller checking only the process code would call a failed run a
pass. **The replay therefore asserts `summary.exitCode === 0` first, before any ledger assertion**, because
every assertion after it is about a ledger that only exists if the scenario actually ran.

## And four wrong attempts, all from not reading the existing helper exactly

```text
attempt 1   output passed positionally      the driver takes --output
attempt 2   case id passed positionally     the driver takes --case-id
attempt 3   --launcher bin/dove-pi.cjs      the driver takes a literal name, "source"
            - which produced "dove-pi.cmd is not recognized" and a run that never started
attempt 4   read the existing call exactly   --output, --case-id, --timeout-ms, --launcher source
```

**The existing suite had the exact call all along.** What went wrong was that a `read` of the file returned
that line *truncated at the terminal width*, and the truncation hid three flags - **which is the same class as
the count readers, the task name and the word-searches: a value taken from a view of the file rather than from
the file.**
