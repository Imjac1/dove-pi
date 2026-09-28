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
