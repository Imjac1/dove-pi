# Implementation plan: the readings, exercised as scripts

## Before writing code

Load `trellis-before-dev`; read the four script headers for their usage forms. Curate `implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [x] **1. The fixture**: one ledger with a request, a refusal, a failed terminal, an application and a decision; one
      convergence record with the change those records describe.
- [x] **2. Four invocations**, each asserting the reading it should print rather than its exit code alone.
- [x] **3. Four missing paths**, each asserting exit 0 and a sentence saying what was not found.
- [x] **4. No script changes**, confirmed by `git status` rather than by intention.
- [x] **5. The gate**: the suite, the budget test, and the three readings still running.

## What it found, which is the answer a test written after the code wants

**Both cases passed on the first run.** The four scripts work against a fixture they have never seen: the failure reading
prints the mechanism, the `cite:` reference **and the `preserve:` list** - which means the declaration `verifiedBy` reaches
the mining half through the component attribution, a link that had never been exercised end to end. All four missing-path
invocations exit 0 and say what they did not find.

**And no script changed**, which `git status` shows rather than a sentence claiming it - the check that makes this a
verification of the layer rather than a fitting of it.

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/harness-readings.test.ts
```

## Risky files

| File | Risk | Mitigation |
|---|---|---|
| The new test | It spawns processes, which is the slow and occasionally flaky shape. | Four spawns in one case and four in the other, a two-minute timeout each, no network, and the temp tree removed in a `finally`. |

**Rollback** deletes the test file.

## Recorded, not built

1. **A drift test for the guide** against the schema, which is a real idea and a different one.
2. **Rehearsing the seven steps through the host tools**, whose mechanics `tests/pi-adapter.test.ts` already exercises.