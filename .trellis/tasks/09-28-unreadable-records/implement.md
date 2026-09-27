# Implementation plan: unreadable records

## Before writing code

Load `trellis-before-dev`; read the axis guard and the round reading own parse. Curate `implement.jsonl` / `check.jsonl` and start
the task in this same turn.

## Ordered checklist

- [x] **1. The axis**: count the unclassifiable terminals, print them beside the classes, keep the ratio over what it classified.
- [x] **2. The axis test**: the sum invariant, with the unknown-reason fixture.
- [x] **3. The turn reading**: decode through `decodeTaskConvergenceSnapshot`, keep the skip, print how many were skipped.
- [x] **4. The reading test**: `changes` that is not an array, asserting exit 0 and no fabricated count.
- [x] **5. Both contracts**, and the gate.

## What the round turned into, and the fixture it repaired

**The axis half was withdrawn**: the core counts the unclassifiable terminals, the printer prints them, the suite asserts them, and
the "hole" was a line my own filter hid. The round is the turn reading, and one thing the fix exposed:

```text
before: changes: "none" -> four characters counted as four changes -> exit 1
after:  the decoder refuses the record -> exit 0 -> "a task record exists that this build cannot read"

and the fixture the reading was tested against since round 19 was **not a valid record**:
  acceptanceRevision was the literal "a", the criteria list was empty, and a criterion state carried no evidenceRefs.
  It passed for two rounds because the reading cast instead of decoding - a test validating a fiction.
after: acceptanceRevision from computeAcceptanceRevision(CRITERIA), one criterion with evidenceRefs, and the assertions pass.
```

**That is the fix arguing for itself**: a decoder is what makes a test fixture have to be real.

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/harness-axes.test.ts tests/harness-readings.test.ts
```

## Risky files

| File | Risk | Mitigation |
|---|---|---|
| The axis output | Its shape is asserted by its own suite and read by people. | The change is additive: one line, and a zero for a ledger that has nothing unclassifiable. |

## Recorded, not built

1. **A fifth terminal class**, which would claim knowledge this build does not have.
2. **Widening the axis to report the unknown reason strings**, which would put arbitrary ledger text into a reading.