# Implementation plan: the verifier, declared in two parts

## Before writing code

Load `trellis-before-dev`; read `.trellis/spec/backend/personal-agent-harness-loop.md` (the boundary contract the three
states amend) and `.trellis/spec/backend/quality-guidelines.md`. Curate `implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [x] **1. The declaration**: `verifier.paths` and `verifier.embedded`, naming the symbols that were read out of the source
      rather than remembered.
- [x] **2. The loader**: the new block, its shape refusals, and its paths resolved by the same rule as everything else.
- [x] **3. The check**: `verifierFit` in `harness-round.ts`, reusing `declaredPrefixHit` and `workspaceRelativeTarget`.
- [x] **4. The reading**: `scripts/harness-rounds.mts` prints the answer beside the surface fit.
- [x] **5. The tests**: the three answers, the refusals, and the real declaration resolving.
- [x] **6. The specification**: the three states, the two relations, and the extraction prerequisite.

## The live answer, on a real commit

```text
    applied:    4b45f99   outside tool-implementation
    verifier:   possible - src/pi-adapter/extension.ts (unresolvedAcceptanceEvidence, countGateRefusals, changeObservables, convergenceObservables)
```

Last round this was a reader judgment ("the map cannot decide which edits are verifier changes"). It is now a reading that
names the symbols at stake - and the answer is honest about its own strength: **possible**, not definite, because that code
lives inside a file that is mostly harness.

## A defect this round produced, and how it was found

The verifier block was added to the loader and **the function closing brace was dropped** by the edit - the file no longer
compiled. `tsc` reported only "expected a brace at the end", which names a line rather than a place; a per-line brace-depth
script located it in one run, and the missing brace was restored. Worth recording because the failure mode was silent to
the eye: a 130-line insertion that looks complete.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
node --import tsx --test tests/spec-context-budget.test.ts
node --import tsx scripts/harness-rounds.mts
```

## Risky files

| File | Risk | Mitigation |
|---|---|---|
| The declaration | A third mapping to keep in step; each is a relation that a test reads from the real file. | The loader validates shape and resolution, and the loading test reads the real file. |
| `harness-round.ts` | A second fit alongside `surfaceFit` could drift from it. | Both call the same prefix rule and the same normalisation, and the test pins the directory case in both. |

**Rollback** removes the mapping and the check.

## Recorded, not built

1. **Extracting the read paths** out of the adapter, which would turn `possible` into `definite` for those files.
2. **The Pi-hosted turn**, unchanged.