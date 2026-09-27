# Implementation plan: the behaviours a fix must not regress

## Before writing code

Load `trellis-before-dev`; read `.trellis/spec/backend/personal-agent-harness-loop.md` and
`.trellis/spec/backend/quality-guidelines.md`. Curate `implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [x] **1. The declaration.** `.trellis/harness-surface.yaml`: `verifiedBy`, with the suites that exist for each
      component. Verify each path before writing it, not after.
- [x] **2. The loader.** `harness-surface.ts`: the second mapping, its validation (declared component, resolvable path -
      one rule with the component paths), and it stays optional.
- [x] **3. The record.** `failure-reading.ts`: `preserve`, from an option the caller supplies; empty for `unattributed`.
- [x] **4. The tests**: the map refusal cases, the carried list, the empty case.
- [x] **5. The prints.** Both scripts load the declaration and print the list.
- [x] **6. The specification**: the field, its source, the empty case, and that it is neither a test run nor derived from
      the fix.

## The live reading, and the empty case it showed

The real failure in the corpus is `unattributed` - the evidence names no component - so its `preserve` is **empty**, and
the corpus reading prints no list for it. That is the honest state rather than a gap: the failure reading was run on a run
whose cause is upstream of the ledger entirely, and there is no component whose suites could be named. The field earns its
keep on the cases where a refusal or a convergence origin *does* point somewhere, which the unit tests cover.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
node --import tsx --test tests/spec-context-budget.test.ts
node --import tsx scripts/harness-corpus.mts
```

## Risky files

| File | Risk | Mitigation |
|---|---|---|
| `harness-surface.yaml` | A second mapping could drift from the components it names. | The loader refuses an undeclared key, and the loading test reads the real file. |
| The record | A list that looks authoritative but came from an unattributed failure. | Empty, with the reason already beside it. |

**Rollback** removes the field and the mapping.

## Recorded, not built

1. **Stating `verifiedBy` for every component.** Two may stay unstated, and that is the honest state.
2. **Running the list as part of a round**, which is the loop procedure step a person performs.