# Implementation plan: the verifier read paths, extracted

## Before writing code

Load `trellis-before-dev`; read `.trellis/spec/backend/personal-agent-harness-loop.md` (the boundary contract the
declaration serves) and `.trellis/spec/backend/quality-guidelines.md`. Curate `implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [x] **1. The move**: one script, one range, asserted start and end markers, brace depth checked after.
- [x] **2. The adapter import**: the adapter imports the three it calls from the new module.
- [x] **3. The two tests import from the new module** - and nothing else about them changes.
- [x] **4. The declaration**: the new module in `verifier.paths`, the five symbols out of `embedded` for the adapter.
- [x] **5. The orphaned doc comment** deleted, and the three remaining blocks each above their function.
- [x] **6. Tests, typecheck, and the live reading** on two fixtures: a commit touching the adapter, one touching the new
      module.

## Two refusals and one correction, which is the shape of a move done safely

1. **The first attempt stopped the block at a parameter line.** The end of a function was found by counting braces from the
   signature, and the signature line `function changeBaseline(` has no brace - so the count returned to zero on the next
   line and the block was cut through the middle of the signature. It was **rolled back from git and redone**, not patched:
   the prior state was committed, which is what makes that the right move.
2. **The second attempt refused before writing anything**, because the signature contains braces in its type annotation and
   the re-armed check saw the depth return to zero there. The fix was to find the line that ends with the body opener and
   count from there.
3. **And the measurement was wrong in a smaller way**: the previous round said two test files use the moved code; the grep
   that said so matched a fixture **string** in one of them, and only one file actually imports it. The blast radius was
   smaller than recorded, which is worth knowing rather than quietly enjoying.

Both files came out at brace depth zero, and the four functions that were module-private are exported - the only change
inside the move, now stated in the module itself.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
node --import tsx --test tests/spec-context-budget.test.ts
```

## Risky files

| File | Risk | Mitigation |
|---|---|---|
| `extension.ts` | A block cut from a 3,300-line file can take a brace with it, as it did last round in the other direction. | The range is asserted at both ends and the brace depth of both files is checked immediately after. |
| The two tests | An import change is small but the tests are the regression net. | Only the import line changes, and the assertions must pass unchanged. |

**Rollback** is a checkout of the three files.

## Recorded, not built

1. **The record module extraction**, R5.
2. **The Pi-hosted turn.**