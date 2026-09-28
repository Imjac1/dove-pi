# Implementation plan: a guard for the kill

## Ordered checklist

- [x] **1. The abort path, read.**
- [x] **2. The guard.**
- [x] **3. The restored case and its control.**
- [x] **4. The gate.**

## The fix, at the smallest size

```text
before   const abort = () => { interrupted = true; child.kill(); };
after    the same, with the kill in a try/catch and a comment saying why:
         a pre-aborted signal reaches here immediately after spawn, killing a process that
         has not started raises EINVAL on Windows, and the throw escapes asynchronously
         rather than as a rejection. `interrupted` is already recorded, which is what the
         caller reads, so a failure to signal is not worth throwing.
```

## The reproduction became the regression test

```text
the case           passes a pre-aborted AbortSignal and expects interrupted === true
before the guard   Error: kill EINVAL, and asynchronous activity after the test completed
after the guard    the case passes, and so does its control
the planted control  flipping the expectation fails with CONTROL: this must fail
```

**The case is now worth more than it was when it failed**, because it pins the behaviour the defect broke rather than the behaviour the code
lacked.

## And the timeout walks the same path

The guard covers `abort`, and `abort` is what the timeout calls. **The existing case at the top of the suite passes `timeoutMs: 10_000` and
still passes**, so the shared path is exercised - though the *timeout firing* is not separately tested and is named in the record rather than
implied.

## Validation commands

```powershell
node --import tsx --test tests/windows-runtime.test.ts
npm test
```

## Recorded, not built

1. **The timeout behaviour.**
2. **The first real turn.**