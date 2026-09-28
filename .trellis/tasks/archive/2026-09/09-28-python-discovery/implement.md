# Implementation plan: the Python discovery pattern

## Ordered checklist

- [x] **1. The disk set**: every Python test file under `tests/`.
- [x] **2. The matched set**: what `*installer*_test.py` matches.
- [x] **3. The comparison, both directions.**
- [x] **4. Resolve or record, then the gate.**

## The measurement

```text
python test files under tests:  7
matched by *installer*_test.py: 6
skipped:                        1  - active_task_test.py

who runs active_task_test.py:   nothing. No script, no workflow, no document names it.
what it tests:                  .trellis/scripts/common/active_task.py, the Trellis tooling rather than this project
```

**Neither the file nor the pattern is wrong.** The pattern names the installer, and this is not an installer test; the file is the tool
own, in a directory where the other six are all Dove own. **What was missing is a statement**, so the check holds the classification:
the next Python file added under `tests/` is either named for the suite that runs it or listed with the reason it is not.

## Two directions, and a control

The finding direction is one-way, like the switch check - the pattern may match a subset. But the foreign list is asserted in both
directions, because an entry naming a file that is gone is the same rot the reachability list guards against. **And the check was given a
negative control**: a planted file makes it fail naming that file, and removing it makes it pass.

## Validation commands

```powershell
npm run test:installer
npm test
```

## Recorded, not built

1. **The TypeScript runner**, which round 61 settled.
2. **The first real turn**, which needs a Pi host.