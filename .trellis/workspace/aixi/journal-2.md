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


## Session 54: One vocabulary for the refusal labels, and the eleventh the compiler found
<!-- trellis-session: v=2 fp=20bc0eadda140b3c -->

**Date**: 2026-09-28
**Task**: One vocabulary for the refusal labels, and the eleventh the compiler found
**Branch**: `master`

### Summary

GATE_LABELS is the closed set a manifest prediction is validated against, and the producers shared no type with it - so a label a producer wrote and the set did not carry meant a refusal class nobody could predict. Declared once, with the label a refusal carries typed as a member, the compiler found intensity: a live eleventh label that three earlier hand counts had missed.

### Main Changes

- the vocabulary is one declaration - a tuple, with the union and the set derived from it - so the two cannot disagree, and the parser that validates predictions keeps taking the set
- typing the label a refusal carries turned a producer that invents a label into a compile error, which is how intensity was found: the intensity ceiling refuses with it and the set carried ten
- and the same typecheck refused the wrong coupling: ActionGate.id is not a refusal label, because the loop gate is a general abstraction driven by test doubles while the policy gates are the ones that reach the ledger. That was reverted, with a sentence left where it was tried
- the policy gate list is checked by a test instead, because its entries come from gate objects with wider ids, and a label nobody writes is covered by neither - stated in the contract rather than implied
- a process slip, recorded rather than backdated: this task went to code before its design and implementation artifacts existed and before task.py start ran. The artifacts were written afterwards, the checklist reconstructed, and the slip written into the task file because a task that hides its own sequence teaches the next reader the wrong one

### Git Commits

| Hash | Message |
|------|---------|
| `5aee501` | fix(convergence): one vocabulary for the refusal labels, and the eleventh the compiler found |
| `2a16343` | docs(spec): the label list gains its eleventh name, and the coupling that found it |
| `01df626` | chore(task): record the vocabulary task, the compiler finding and the step that was skipped |
| `6eb91cf` | docs(loop): record why a gate id is not a refusal label, where the coupling was tried and reverted |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 722 tests, 720 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the affected suites - action policy, loop gate, change verdict, 50 tests - pass with the two literal substitutions.

### Status

[OK] **Completed**

### Next Steps

- The rest of the survey: which other vocabularies in this repository have producers that share no type with them.


## Session 55: The vocabulary consumers, typed: the axis keeps printing a number that would have quietly gone wrong
<!-- trellis-session: v=2 fp=f71c5208af1d77c1 -->

**Date**: 2026-09-28
**Task**: The vocabulary consumers, typed: the axis keeps printing a number that would have quietly gone wrong
**Branch**: `master`

### Summary

The survey finished: no live drift is left after the eleventh label, and two couplings were still untyped. The verdict a decision record carries was a string, and the axis isolation set was a set of strings holding sandbox and fence - so a renamed label would have left the reading printing an isolation refusal count that had quietly stopped counting fence refusals, with the axis own test still passing.

### Main Changes

- the second coupling is the one worth finding: the axis test asserts its own two literals, so nothing connected the set to the vocabulary it came from
- both are typed against the vocabulary now, and the check was seen to fire rather than assumed: renaming fence in the vocabulary reports five errors - four in the producers, which is the previous round typing the label a refusal carries, and one in the axis - and zero after the revert
- the reader of a decision record stays a string on purpose: an append-only ledger holds what it holds, and a reader that insists on today vocabulary breaks on yesterday records. The writer is the party that must not invent a value
- and the refusal channel itself must stay a string, which the contract now says: a gate may be a composite such as deny+scope+registered+ask, which the axis splits into atoms, so a typo in a computed label is covered by neither the typecheck nor the reader

### Git Commits

| Hash | Message |
|------|---------|
| `8a08534` | fix(convergence): type the two consumers of the refusal vocabulary |
| `8953cc3` | docs(spec): the typed consumers, the reader that stays a string, and the channel that cannot be typed |
| `22f67df` | chore(task): record the survey, the two typings and the rename that proved them |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 722 tests, 720 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and no test needed changing - which is what a typing that only narrows a channel should look like.

### Status

[OK] **Completed**

### Next Steps

- The survey of vocabularies is answered: the remaining ones are typed or are free text, and the mode file fields have their loader refusals as their check. The first real turn still needs a Pi host.
