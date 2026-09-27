# Implementation plan: each arm names its target its own way

## Before writing code

Load `trellis-before-dev`. Curate `implement.jsonl` / `check.jsonl` and start the task in this same turn.

## Ordered checklist

- [x] **1. The decoder**: the arm decides the field, and the refusal names it.
- [x] **2. The union comment**: the field name belongs to the arm.
- [x] **3. The test**: both directions, with the message asserted.
- [x] **4. The suite**: nothing this build wrote is refused.
- [x] **5. The gate.**

## What the tightening found, which is the interesting part

```text
npm test with the stricter decoder: 726 tests, 724 pass, 0 fail - unchanged except for the new case
```

**No stored record in this repository ever carried the wrong field for its arm**, so the rule cost nothing to enforce: it closes a
tolerance that only a hand-written record (or a hand-written fixture) could ever have needed. That is the shape of a good
tightening - it says what the writer already means.

**And the comment it fixes was already claiming the guarantee.** `storedMovements` said it would "let the shared validator refuse a
mismatch by naming what that observable accepts", while the code read `to ?? direction` and offered both names with an `or` - a
declaration describing a refusal that did not exist, which is the defect class this repository keeps finding in its own files.

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/change-verdict.test.ts tests/harness-readings.test.ts
```

## Recorded, not built

1. **A general extra-field strictness pass**, with its own blast radius.
2. **The first real turn**, which needs a Pi host.