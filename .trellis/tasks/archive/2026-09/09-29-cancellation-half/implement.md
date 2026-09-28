# Implementation plan: the cancellation half

## Ordered checklist

- [x] **1. The signal handling.**
- [x] **2. The case.**
- [x] **3. The control.**
- [x] **4. The gate.**

## The case was written, it found a bug, and it was removed

```text
the case            pass a pre-aborted AbortSignal, expect interrupted === true
the result          Error: kill EINVAL, and "generated asynchronous activity after the test completed"
what that means     the run settles, and an unhandled error escapes after the test is over
what was done       the case was removed, because it asserts a behaviour the code does not have
```

**The abort path, read before the case was written**:

```text
powershell.ts:46-49   const abort = () => { interrupted = true; child.kill(); };
powershell.ts:51      if (options.signal.aborted) abort();      <- called immediately after spawn
powershell.ts:54      the timeout shares the same abort
```

**So a pre-aborted signal kills a process that has not started, and on Windows that raises `EINVAL`** - unguarded, and escaping
asynchronously rather than as a rejection the caller can see. **A timeout that fires very early walks the same path.**

## What the round produced, and what it did not

**It produced a defect report with a reproduction, and it did not produce a fix.** The scope excluded changing the shell module, and a
one-line guard deserves its own round with its own evidence - but the finding is stronger than the test would have been, because a test that
passes records that something works and this records that something does not.

**The tree is clean and the suite is unchanged at five cases**, and the reproduction is recorded here rather than left in the tree as a
failing case.

## Validation commands

```powershell
node --import tsx --test tests/windows-runtime.test.ts
npm test
```

## Recorded, not built

1. **A timing-dependent test.**
2. **The first real turn.**