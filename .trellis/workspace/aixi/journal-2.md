# Journal - aixi (Part 2)

> Continuation from `journal-1.md` (archived at ~2000 lines)
> Started: 2026-09-28

---



## Session 52: The readings, exercised as scripts: the layer only a hand had run
<!-- trellis-session: v=2 fp=9fd2ef573e5a723c -->

**Date**: 2026-09-28
**Task**: The readings, exercised as scripts: the layer only a hand had run
**Branch**: `master`

### Summary

Four reading scripts had unit tests over constructed records and no test had ever spawned one, while the turn guide quotes them as the first and last steps of a turn. A fixture with a request, a refusal before its failure, an application and a decision now drives all four as processes.

### Main Changes

- the assertions reach the links between instruments rather than one reading at a time: the failure reading prints the mechanism, the reference a manifest cites, and the preserve list, which means the declaration verifiedBy reaches the mining half through the component attribution - a link never exercised end to end until now
- four paths that do not exist are asserted too, one per script, each exiting 0 with a sentence saying what was not found: the property the scripts were written for, and a comment rather than a check until this file
- each script is spawned with execFileSync and --import tsx, the shape tests/harness-effect-claim.test.ts already uses: in-process imports would test the modules, and the modules are the layer that already had tests
- both cases passed on the first run, which is the outcome to want from a test written after the code, and no script changed - git status shows it rather than a sentence claiming it

### Git Commits

| Hash | Message |
|------|---------|
| `a798c9f` | test(readings): exercise the four scripts as scripts, against a ledger on disk |
| `2c0b014` | chore(task): record the readings script test and what it found |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 715 tests, 713 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the only new file is the test.

### Status

[OK] **Completed**

### Next Steps

- Running the turn, which needs a Pi host; and a drift test for the guide against the schema, recorded rather than bundled.


## Session 53: Executing the names: a drift check for the declaration and the guide
<!-- trellis-session: v=2 fp=f3418522fbb4920c -->

**Date**: 2026-09-28
**Task**: Executing the names: a drift check for the declaration and the guide
**Branch**: `master`

### Summary

Two documents name things - the declaration embedded list names symbols, and the turn guide names tool calls with fields - and nothing kept either claim true. Both are now checked by executing them: the module is imported and its symbols asserted to be exported functions, and the mapper is called with exactly the fields the guide lists.

### Main Changes

- the typed form of the question matters: a text scan checks what a pattern can match, which is how the withdrawn behaviour map ended, so where a check can import or call, it does
- status refusing as read-only is asserted, because the guide tells a reader to run a status read and a read is what it must stay
- the doc comment states the two limits rather than leaving them to be assumed: operation=applied is not mapped - the tool execute handles it, and the host tests exercise its refusals - and the guide prose is not checkable at all
- and the first run failed on an assumption of mine rather than on a document drift: the test asserted the guide quotes all four readings, and it quotes three, because the SSM axis compares runs rather than describing a step of a turn - a check that encodes an unstated assumption is caught by running it, which is the whole point of writing one

### Git Commits

| Hash | Message |
|------|---------|
| `cd701eb` | test(docs): execute the names the declaration and the guide rely on |
| `214e886` | chore(task): record the drift check and the assumption its first run caught |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 719 tests, 717 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and no document changed - the only new file is the check.

### Status

[OK] **Completed**

### Next Steps

- Running the turn, which needs a Pi host; the loop specification still has its 262 bytes for whenever a contract needs them.
