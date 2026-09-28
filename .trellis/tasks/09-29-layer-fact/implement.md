# Implementation plan: the layer fact

## Ordered checklist

- [x] **1. The layer check, re-run.**
- [x] **2. The fact, tested directly.**
- [x] **3. Whether it carries both qualifications.**
- [x] **4. The gate.**

## The fact is stronger than the qualifications said

```text
the layer check, re-run    2 of 2, and it is the check that src/core imports nothing from the Pi side
imports reaching modes/    0 - nothing anywhere imports from it
what modes/ holds          10 files: 1 json, 6 yaml, 3 markdown, and no TypeScript at all
```

**So a mode is data.** The principle is not that a search finds no trace of a vertical in the core; it is that **a vertical *has no code to
contribute***. The two qualifications were right and weaker than they needed to be: the mode-id item could not be satisfied as written because
a workspace mode shares the name `pentest`, and **the reason it does not need to be** is that `modes/` cannot import anything, being
data.

## A holder for the fact, since two qualifications lean on it

**`tests/core-layer.test.ts` now walks `modes/` and asserts it holds no executable file**, with a control that the directory was read. **It
says in its own header what it does not hold**: that no string matching a mode name appears in the source, which is the trap the string-search
version fell into.

## And the wart, recorded rather than fixed

**The new case sits outside the file `describe` block**, because the append anchored on the file last `})` and then the case landed after it.
**A move was attempted and turned out to be a no-op** - the script computed a zero-length range and spliced nothing - **and stopped there**:
node:test runs a top-level `it`, the suite went from two cases to three, and the case is in the file that owns the layer claims. **A cosmetic
placement is not worth more calls than the finding that prompted it.**

## Validation commands

```powershell
node --import tsx --test tests/core-layer.test.ts
npm test
```

## Recorded, not built

1. **What the fact cannot cover.**
2. **The first real turn.**