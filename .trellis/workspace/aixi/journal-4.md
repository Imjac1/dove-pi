# Journal - aixi (Part 4)

> Continuation from `journal-3.md` (archived at ~2000 lines)
> Started: 2026-09-29

---



## Session 158: The three answers and the client account
<!-- trellis-session: v=2 fp=1b98f886491a0634 -->

**Date**: 2026-09-29
**Task**: The three answers and the client account
**Branch**: `master`

### Summary

Held the three answers where they live: inside and unresolved are asserted in harness-readings.test.ts against the printed output, and outside-with-offenders-named is four cases in harness-surface.test.ts calling unresolvedSurfaceEntries and asserting the exact entries it returns.

### Main Changes

- and the reading suite documents a fourth answer it cannot reach - applied with a surface declared - because the decoder validates a surface against the union the code carries; so the item asks for three answers and there are four
- the answering names were found by reading exports: unresolvedSurfaceEntries names what does not resolve, and the module vocabulary has unparseable for the commit nobody could read
- and the client-account lead was a homonym: the only hit was the word account inside a comment about an honest account of why the inside answer is not here. That item is still not located, and this is the fifth false positive from word searching

### Git Commits

| Hash | Message |
|------|---------|
| `b15b233` | chore(task): hold the three answers, and find the client-account lead was a homonym |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 748 tests, 746 pass, 0 fail, 2 skipped.

### Status

[OK] **Completed**

### Next Steps

- The client-account item, still unlocated, and the request-runtime lists.


## Session 159: The request ledger and the client account
<!-- trellis-session: v=2 fp=0b0a1addbc19385b -->

**Date**: 2026-09-29
**Task**: The request ledger and the client account
**Branch**: `master`

### Summary

Held the four request-runtime items verbatim: one plan and one terminal record, coalesces in-flight redelivery but not the same text after settlement, steering and follow-up deliveries associated with the active logical request, and additive ledger records parsed by correlation. And found the client account in failure-reading.ts, where a lookup keyed by request id is the item own phrase.

### Main Changes

- the record kinds are not where a client lives: thirty-four kinds and none is a client or an account. That was asked because the item is about a ledger, and the answer moved the search to the code rather than repeating the word
- and the two holders are verbatim: carries a client account when the caller supplies one and never merges it into the mechanism, and leaves the other failures alone when a ledger holds more than one
- so the item that survived two word-searches and produced a homonym was found by asking a vocabulary, then moving to the code - the names live in the implementation and the tests only call them

### Git Commits

| Hash | Message |
|------|---------|
| `efafd1b` | chore(task): hold the request ledger items, and find the client account in the code rather than the tests |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 748 tests, 746 pass, 0 fail, 2 skipped.

### Status

[OK] **Completed**

### Next Steps

- The rest of the first request-runtime list, seven items, and the lists still unheld elsewhere.


## Session 160: The shell boundary and the mode change
<!-- trellis-session: v=2 fp=d285244e8f7ec74d -->

**Date**: 2026-09-29
**Task**: The shell boundary and the mode change
**Branch**: `master`

### Summary

Measured the shell boundary and found five behaviours implemented with one asserted: exitCode is asserted, while stderr, timeoutMs, the cancellation signal and result.interrupted, and the pwsh-then-powershell fallback are all implemented and unexercised. The vocabulary named all five before any test was read.

### Main Changes

- one asserted out of five is recorded as its own finding rather than as unheld, because the behaviours exist and nothing would go red if three of them stopped working
- the mode-change and native-absence items were not reached and are named as unchecked rather than left to look done
- and one lead: PowerShellResult.interrupted and PowerShellOptions.signal are the cancellation half, and the suite never passes a signal - the same shape as the CLI approval flag

### Git Commits

| Hash | Message |
|------|---------|
| `b6d19a5` | chore(task): measure the shell boundary, and find five behaviours implemented with one asserted |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 748 tests, 746 pass, 0 fail, 2 skipped.

### Status

[OK] **Completed**

### Next Steps

- The signal and interrupted cancellation half, the mode-change item, and the native-absence item.


## Session 161: The cancellation half of the shell boundary
<!-- trellis-session: v=2 fp=6aee6899df7ff04d -->

**Date**: 2026-09-29
**Task**: The cancellation half of the shell boundary
**Branch**: `master`

### Summary

Wrote the case for the cancellation half and it found a defect instead of passing. A pre-aborted AbortSignal fails with kill EINVAL and generated asynchronous activity after the test completed, so the run settles and an unhandled error escapes after the test is over.

### Main Changes

- the abort path read before the case was written: abort sets interrupted and calls child.kill unguarded, a pre-aborted signal calls it immediately after spawn, and the timeout shares the same path - so it kills a process that has not started, which on Windows raises EINVAL
- the case was removed rather than left failing, because it asserts a behaviour the code does not have, and the tree is unchanged at five cases
- the round produced a defect report with a reproduction and did not produce a fix: a one-line guard deserves its own round with its own evidence, and this finding is stronger than the test would have been

### Git Commits

| Hash | Message |
|------|---------|
| `fe8cbaf` | chore(task): the cancellation case found a defect, and the round recorded it instead of leaving a failing test |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 748 tests, 746 pass, 0 fail, 2 skipped, unchanged.

### Status

[OK] **Completed**

### Next Steps

- The guard for child.kill in the abort path, which is a one-line robustness fix in a path a timeout also walks.


## Session 162: A commit path that missed the file it changed
<!-- trellis-session: v=2 fp=3ca874780fa49d69 -->

**Date**: 2026-09-29
**Task**: A commit path that missed the file it changed
**Branch**: `master`

### Summary

A follow-up to the cancellation round, because its journal entry said the tree was unchanged at five cases - true of the working tree, and false of HEAD. The removal of the failing case was committed with a path that named only the task directory, so the repository carried a failing test until this commit.

### Main Changes

- the same class the session keeps meeting: a selector that does not cover what it claims. Here it was git add with a task-directory path instead of the changed test file
- it was caught by reading git status after the journal rather than by assuming the tree was clean, which is the check that has caught the index and ref locks all session
- and the correction is a new entry rather than an edit, because the journal is not rewritten; the earlier entry is incomplete rather than untrue

### Git Commits

| Hash | Message |
|------|---------|
| `aab09bc` | fix(test): commit the removal the previous commit left staged |

### Testing

- [OK] git status is clean and tests/windows-runtime.test.ts is five of five, so HEAD and the working tree agree again.

### Status

[OK] **Completed**

### Next Steps

- The guard for child.kill in the abort path, which is still the round after this one.


## Session 163: A guard for the kill that throws EINVAL
<!-- trellis-session: v=2 fp=b5f1580907222bbe -->

**Date**: 2026-09-29
**Task**: A guard for the kill that throws EINVAL
**Branch**: `master`

### Summary

Guarded child.kill with a try/catch and a comment saying why: a pre-aborted AbortSignal reaches abort immediately after spawn, and killing a process that has not started raises EINVAL on Windows, escaping asynchronously. interrupted is already recorded, so a failure to signal is not worth throwing.

### Main Changes

- the reproduction became the regression test: the case that found the defect passes now, its control passes with it, and flipping the expectation fails with CONTROL: this must fail
- and the timeout calls the same abort, so the guard covers that path - the existing case passing timeoutMs still passes, though the timeout firing is not separately tested and is named rather than implied
- the changed files were named in the git add rather than the task directory alone, which is what the previous round got wrong and had to fix in a follow-up commit

### Git Commits

| Hash | Message |
|------|---------|
| `e873a60` | fix(shell): guard the kill that throws EINVAL when a signal is already aborted |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 749 tests, 747 pass, 0 fail, 2 skipped. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The timeout firing itself, which shares the abort path and is not separately tested.


## Session 164: The timeout that fires
<!-- trellis-session: v=2 fp=7ca912da922749fd -->

**Date**: 2026-09-29
**Task**: The timeout that fires
**Branch**: `master`

### Summary

Held the timeout path with a case that proves itself: a three-second sleep with a one-millisecond timeout asserts both that the run was interrupted and that it lasted under a second and a half. The duration is the part that matters, because a completed sleep would report three seconds and the boolean alone would not tell them apart.

### Main Changes

- the mirror control is a hundred-millisecond sleep with a five-second timeout, which completes and asserts the field stays false - a race won and a race allowed are the two halves
- and the case says what it does not hold: not cancellation, which has its own case, and not a timeout that fires mid-output, since the script produces nothing before the timeout
- the changed file was named in the git add, which the previous rounds learned to do the hard way

### Git Commits

| Hash | Message |
|------|---------|
| `6ef4a61` | test(shell): hold the timeout that fires, and prove it with the duration |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 750 tests, 748 pass, 0 fail, 2 skipped. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The request-runtime items still unheld, and the lists left elsewhere.


## Session 165: The core that must not import Pi
<!-- trellis-session: v=2 fp=bce890545daa832b -->

**Date**: 2026-09-29
**Task**: The core that must not import Pi
**Branch**: `master`

### Summary

Measured the layer claim and found it true and unheld: 45 files in src/core, 106 import statements, none reaching Pi, and no test walks the directory - the 141 hits for src/core are imports by tests, not a read of it. A holder now walks every file, takes each specifier, and refuses any naming a Pi module.

### Main Changes

- the control is a real one: it writes a temporary module into src/core with a Pi import, runs the same walk, asserts the planted specifier is found, then removes the file - and both cases pass with the planted file gone
- and the holder says what it does not cover: a dynamic await import is not an import statement and is not seen, a re-export is not seen either, and it does not decide why an import would be wrong
- the measurement answered the first half before a holder was looked for, and the second half needed a different question - not who imports Pi but who reads the directory

### Git Commits

| Hash | Message |
|------|---------|
| `9b65587` | test(layer): hold the claim that core does not import Pi, with a control that plants one |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 752 tests, 750 pass, 0 fail, 2 skipped. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The other request-runtime items, and the mode-format claim of the same shape, which the round now suspects is also unheld.


## Session 166: The mode id that must not appear in core
<!-- trellis-session: v=2 fp=dc0e27146dc9a51e -->

**Date**: 2026-09-29
**Task**: The mode id that must not appear in core
**Branch**: `master`

### Summary

Found a test item that could not be satisfied as written. The mode-format principle is that a vertical adds no core code and that a mode id in executable code under src/core is a framework defect; the item restated it as a string absence, and the string is there because a workspace mode is also called pentest.

### Main Changes

- by the principle own words that would be a framework defect, and it is not - the hits are a workspace lens sharing a name with a vertical, which has nothing to do with needing core code. So the item was the defect
- the item now states the principle it was standing in for and says why a string search cannot stand in for it, and no test was added because none can hold the principle and a proxy check is what made the item wrong
- what can be held is that a mode is loaded from modes rather than built in, which is where the loader is tested

### Git Commits

| Hash | Message |
|------|---------|
| `98324c9` | docs(spec): qualify a test item that could not be satisfied as written |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 752 tests, 750 pass, 0 fail, 2 skipped.

### Status

[OK] **Completed**

### Next Steps

- The other mode-format items, and the lists left elsewhere.


## Session 167: The mode format list, with the checkability question
<!-- trellis-session: v=2 fp=f1fb9e2c2ab3c228 -->

**Date**: 2026-09-29
**Task**: The mode format list, with the checkability question
**Branch**: `master`

### Summary

Accounted for every mode-format item and answered whether each can be checked. Seven of eight are held and checkable because they are behavioural: a well-formed mode loads, unknown fields are rejected in five places by five cases, each required field by four, the gate matrix by five, and ask_before and unlisted actions by three.

### Main Changes

- one is not checkable and it is the one qualified last round, and the difference is the one that round drew - a behaviour can be exercised, and a statement about the shape of a codebase can only be approximated
- several case names carry the item own words, which is the strongest form here: loads a well-formed three-file mode, and answers an unlisted action with the stance the mode declared and with nothing else
- so the list is finished: seven held, one qualified, none left as a count

### Git Commits

| Hash | Message |
|------|---------|
| `bb159eb` | chore(task): account for every mode-format item, and answer whether each can be checked |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 752 tests, 750 pass, 0 fail, 2 skipped.

### Status

[OK] **Completed**

### Next Steps

- The remaining lists in the other specifications, and the request-runtime items still unheld.
