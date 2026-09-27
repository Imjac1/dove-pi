# Implementation plan: the drift check

## Before writing code

Load `trellis-before-dev`; read `tests/fence-drift.test.ts` for the house shape and the guide for the fields it lists.
Curate `implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [x] **1. The declaration check**: parse the real file, import the module each embedded entry names, assert each symbol
      is an exported function - and fail loudly for an entry this test cannot import, rather than skipping it.
- [x] **2. The mapper check**: `freeze` with `criteria`, `change` with the eight guide fields plus a runtime baseline, and
      `status` refusing as read-only.
- [x] **3. The scripts**: each exists, and the guide quotes it.
- [x] **4. The doc comment**: the two stated limits.
- [x] **5. The gate**, and a check that no document changed.

## What the check caught on its first run

**A wrong expectation of mine, in the test rather than in the documents.** The script case asserted that the guide quotes all
four readings, and it quotes three: `harness-axes.mts` is a ruler for comparing runs - a variant comparison - rather than a
step of a turn, so the guide does not mention it (confirmed: zero mentions). The test asserted an assumption about the guide
design, and said so once it was corrected.

That is the value of writing the check: the three executed claims (the embedded symbols, the mapper fields, the read-only
status) all passed, and the one that failed was the one encoding an unstated assumption.

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/document-drift.test.ts
```

## Risky files

| File | Risk | Mitigation |
|---|---|---|
| The new test | A drift test that fails for the wrong reason gets disabled. | Assertions name the symbol, the field or the script at fault, and the two limits are stated so a failure is not read as broader coverage than it is. |

## Recorded, not built

1. **Checking the guide prose**, which is not checkable.
2. **`operation=applied`**, whose refusals the host tests exercise.