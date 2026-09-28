# Implementation plan: the fallback, observed

## Ordered checklist

- [x] **1. Which executable runs here.**
- [x] **2. Whether both exist.**
- [x] **3. The determinism answer.**
- [x] **4. The gate.**

## The earlier conclusion was wrong, and the machine says so

```text
executable used: powershell.exe
  missing pwsh
  missing pwsh.exe
  found powershell   -> C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
platform: win32
```

**`pwsh` is not installed here.** So `executableCandidates()` returns both names, the first throws, `isMissingExecutable` catches it, and the
second runs - **the fallback fires on every call to this module**. A previous round concluded it was *not checkable from outside*; what was
missing from that conclusion is that **the fallback does not need to be forced to be observed**, on a machine where the first candidate is
absent.

## The case holds the field and its domain, and records which side answered

**It asserts the executable is one of the two candidates** - so the field is pinned to its domain and a caller can tell which answered - and
**it does not claim to hold the fallback as such**, because forcing the second candidate would need the first to be missing, which a test
cannot stage. **What it does instead is record which side of the fallback answered on this machine**, which is the observation the round was
after.

## Five behaviours, five accounted for

```text
exit code     asserted, in the same suite
stderr        asserted, with a control that moves the assertion from stderr to stdout
timeout       asserted, with the duration proving the timeout ended the run rather than the script
cancellation  asserted, with a pre-aborted signal
executable    asserted against its domain, and the fallback recorded as fired on this machine
```

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **A conditional check.**
2. **The first real turn.**