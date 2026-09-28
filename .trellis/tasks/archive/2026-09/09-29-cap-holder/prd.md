# A case that holds the cap wiring

## Goal

Hold the turn cap through the adapter handler, which the previous round wired and left unheld.

## Background: holdable, unlike the notice beside it

The previous round wrote down why this one *can* be held: **the count is an argument a case controls**, where the
fuse notice depends on a miss reason the entries have to encode. **That difference is what this case spends.**

## And why it is its own case rather than a step in the existing one

The case that holds the fuse already fires the *fraction* guard on every turn, because its context reports
220000 tokens against a 128000 window - **and every notice shares one `guardNotified` flag, which is one-shot.**
So a cap notice added there could never fire. **A case of its own, with a small prefix on purpose, is the only way
to assert the cap rather than whichever adviser spoke first.**

## What the case stages

```text
DOVE_PI_MAX_MESSAGES = 3, restored in a finally
context reports 1000 tokens against a 1000000 window, so neither the fraction nor the token guard can fire

3 entries   quiet          the comparison is >, so at the cap is not past it
5 entries   one notice     naming /compact and a new session, and the count it saw: 5 条对话
            and the assertion that the *other* two guards stayed silent, so the notice is the cap
5 entries   nothing        the control: the flag is one-shot
```

**The third assertion in the middle step is the one that matters**: that nothing else fired. **Without it, a case
asserting a notice appears would pass if a neighbour raised it**, which is the failure this line of work keeps
recording.

## Acceptance criteria

- [x] **AC1** The cap is held through the handler, not through the guard directly.
- [x] **AC2** The boundary is asserted at the cap as well as past it.
- [x] **AC3** The case proves the notice is the cap by asserting the others stayed silent.
- [x] **AC4** The gate passes, and the adapter suite is one case longer.