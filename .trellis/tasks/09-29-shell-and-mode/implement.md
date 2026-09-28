# Implementation plan: the shell boundary and the mode change

## Ordered checklist

- [x] **1. The file list.**
- [x] **2. The shell boundary item.**
- [x] **3. The mode-change item.**
- [x] **4. The native-absence item, then the gate.**

## The shell boundary: five behaviours implemented, one asserted

```text
exit code     PowerShellResult.exitCode          HELD       windows-runtime.test.ts:13 asserts it is 0
stderr        PowerShellResult.stderr            field only
timeout       PowerShellOptions.timeoutMs        passed at :12, never asserted
cancellation  options.signal + result.interrupted  implemented, never exercised
fallback      executableCandidates()             pwsh then powershell, implemented, never exercised
```

**The vocabulary named all five before any test was read**, which is the method working: `PowerShellResult` carries `exitCode`, `stderr` and
`interrupted`; `PowerShellOptions` carries `timeoutMs` and an `AbortSignal`; and a private `executableCandidates()` returns `pwsh` and then
`powershell` as the fallback.

**One of the five is asserted.** The other four are implemented and unexercised, which is a different finding from unheld and is recorded that
way - the behaviours exist, and nothing would go red if three of them stopped working.

## Two items named as unchecked

**The mode-change item and the native-absence item were not reached.** The round spent its calls on the shell boundary, which turned out to have
a five-part claim worth measuring precisely rather than a yes-or-no one. Both are named here rather than left to look done.

## And one lead worth carrying forward

`PowerShellResult.interrupted` and `PowerShellOptions.signal` are the cancellation half, and the suite never passes a signal. **That is a
candidate unheld promise of the same shape as the CLI approval flag** - implemented, and nothing to make it go red.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The other four items.**
2. **The first real turn.**