# Implementation plan: the installer parameters

## Ordered checklist

- [x] **1. The param block**: every switch `install.ps1` declares.
- [x] **2. The documents**: every switch the contract and both READMEs name.
- [x] **3. The comparison, both directions.**
- [x] **4. Fix what is wrong, at the side that is wrong.**
- [x] **5. The gate.**

## The comparison, and the two mistakes on the way to it

```text
install.ps1 param block:  Profile, Verify, NoPath, NoFont, NoExtensions, Proxy
the contract named:       NoPath, NoFont, NoExtensions, Proxy
both READMEs named:       NoPath, NoFont, NoExtensions   (and powershell own -NoProfile in a command line example)

finding: the bootstrap accepts -Profile and -Verify and passes them through (line 428), and no document named them.
```

**Two of my own readings were wrong before the answer was.** The first regex over both READMEs matched PowerShell own `-NoProfile`
flag in a command-line example and reported it as a documented installer switch - the recurring class, a pattern matching more than the
claim. Then the contract line was first written with the parameter values inside the backticks, so the test regex - looking for a bare
`-Name` - did not see them, and the test reported the prose as missing something it said.

**Both are the same lesson twice in one round**: a pattern is not a claim, and a check whose pattern is stricter than the prose it
reads will report the prose as wrong.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
```

## Recorded, not built

1. **Running the installer**, which writes outside the repository.
2. **The first real turn**, which needs a Pi host.