# Implementation plan: the log grows additively

## Ordered checklist

- [x] **1. Read MaintenanceResult.**
- [x] **2. Extend the writer additively.**
- [x] **3. Hold it with tests.**
- [x] **4. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test

# and the one that matters here
npm run test:installer
```

## What was read first

```text
installer/manager.py:30-67   MaintenanceResult: eleven fields, and to_json already emits release,
                             profile, degradedExtensions and pathRemoved
dove_pi.py:575               write_maintenance_log(layout, command, status, message) - four fields
installer/*.py               no sync-state vocabulary anywhere: zero hits for in_sync, managed_newer,
                             project_newer or diverged
```

## What was written

```text
dove_pi.py   maintenance_run_id()   a sixteen-character digest, per the design rule on bounded hashes
             write_maintenance_log(..., *, record=None, duration_ms=None, run_id=None)
                                      no record - the legacy write, the same four fields
                                      a record  - schema 2 with runId, durationMs, decision, release,
                                                  previousRelease, profile, selectedExtension,
                                                  syncState, pathRemoved
             emit_maintenance_result now passes record=result
```

## syncState is unknown because the vocabulary does not exist

**The design says an unavailable field is labelled rather than guessed**, and the installer package has no sync-state vocabulary: zero hits
for `in_sync`, `managed_newer`, `project_newer` or `diverged`. **Those words exist on the TypeScript side**, in the extension identity module,
so the field is real - it is this half of the tree that cannot fill it yet. **Reporting `unknown` is the honest value, and a later plan item can
populate it.**

## And a generator failure worth recording

**The first attempt wrote the test class in the same call as a string replacement, and the block vanished silently** - the pattern did not
match, so the file was written without it, and the suite reported the same count as before: `Ran 130 tests`. **The count is what gave it away.**
The second attempt died on a `SyntaxError`, because a Python list was written where a JavaScript array belonged.

**The third attempt worked because it stopped being clever**: the class went to its own file, a staged copy held a placeholder, and a ten-line
script spliced them. `Ran 134 tests, OK` - four more than before, which is the number this round was supposed to add.

## Files

```text
dove_pi.py                                  contract, writer and the call site
tests/maintenance_evidence_installer_test.py  6 cases from the contract round, 4 from this one
```
