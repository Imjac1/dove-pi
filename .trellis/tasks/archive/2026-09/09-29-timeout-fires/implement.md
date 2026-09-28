# Implementation plan: the timeout that fires

## Ordered checklist

- [x] **1. The timeout path.**
- [x] **2. The case and its margin.**
- [x] **3. The duration assertion, and the control.**
- [x] **4. The gate.**

## The margin, which is what makes it a test rather than a race

```text
the case      Start-Sleep -Seconds 3 with timeoutMs: 1        a margin of three thousand
the proof     durationMs < 1500 - a completed sleep would report three seconds
              so the duration is what distinguishes a timeout from a script that finished
the control   Start-Sleep -Milliseconds 100 with timeoutMs: 5000 completes: interrupted false, duration at least 100
```

**The duration assertion is the part that matters.** `interrupted` alone would be satisfied by any kill, and the point of the item is that
*the timeout* ended the run. **A completed three-second sleep and a timeout look the same in the boolean and differ by three orders of
magnitude in the duration.**

## The mirror control, chosen to be fast

**The obvious control - the same sleep with a long timeout - would take three seconds.** The mirror is the other way round: a hundred-
millisecond sleep with a five-second timeout, which completes and asserts the field stays false. **A race won and a race allowed are the two
halves, and both are asserted.**

## What the case does not hold, stated in it

**Not cancellation**, which has its own case. **Not a timeout that fires mid-output** - the script used produces nothing before the timeout, so
the case would not notice a bug in how partial output is reported after an interrupt.

## Validation commands

```powershell
node --import tsx --test tests/windows-runtime.test.ts
npm test
```

## Recorded, not built

1. **The cancellation half.**
2. **The first real turn.**