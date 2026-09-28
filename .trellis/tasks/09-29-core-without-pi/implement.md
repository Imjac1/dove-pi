# Implementation plan: the core that must not import Pi

## Ordered checklist

- [x] **1. The imports of src/core.**
- [x] **2. The holder, or its absence.**
- [x] **3. A holder, if warranted.**
- [x] **4. The gate.**

## The claim is true, and it was unheld

```text
files in src/core      45
import statements     106
imports reaching Pi     0
tests that walk src/core  none - the 141 hits for src/core are all imports *by* tests, not a walk of the directory
```

**Measured before a holder was looked for, and the measurement is the answer to the first half.** The second half needed a different
question: not *who imports Pi* but *who reads the directory*, and nobody did.

## The holder, and its control is a real one

**`tests/core-layer.test.ts` walks every `.ts` file under `src/core`, takes each import specifier, and refuses any that names a Pi module.**
The second case is the control and it writes a temporary module into `src/core` with a Pi import, runs the same walk, and asserts the planted
specifier is found - then removes the file. **Both cases pass and the planted file is gone.**

## What the holder does not cover, and it says so

```text
covered     import ... from "" and export ... from "" specifiers, including type-only imports
not covered a dynamic await import("..."), which is not an import statement
not covered a re-export, though src/core carries none today
not covered why an import would be wrong - a deeper module Pi also imports is still a violation by this rule
```

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **The other items.**
2. **The first real turn.**