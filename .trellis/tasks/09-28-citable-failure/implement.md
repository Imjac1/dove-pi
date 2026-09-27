# Implementation plan: a citable failure

## Before writing code

Load `trellis-before-dev`; read `.trellis/spec/backend/personal-agent-harness-loop.md` and
`.trellis/spec/backend/quality-guidelines.md`. Curate `implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [x] **1. The reference.** `failure-reading.ts`: collect the terminal step id and emit `evidenceRef`, documented as taken
      from the record rather than reconstructed.
- [x] **2. The tests.** The reference equals the record step id with the prefix; a failure always carries one.
- [x] **3. The prints.** Both scripts print it, since a person copies it.
- [x] **4. The resolve.** The change branch resolves `failureEvidenceRef` through `unresolvedAcceptanceEvidence` and
      refuses an unresolved one, naming it. **Check first what the existing host test cites**, so the regression net is
      known rather than assumed.
- [x] **5. The host test**: a manifest citing a failure the ledger does not hold is refused; the existing manifest
      assertions still pass.
- [x] **6. The specification**: the reference form, the resolve rule, and why the rule lives one path over already.

## What the negative case taught, which is worth more than the change

The first version of the negative test **did not exercise the rule it named**: it spread the manifest without
`predictedFixes`, so the call was refused a layer earlier by the shape rule - and `assert.rejects` then reported a
mismatch that read like the evidence rule was missing. Diagnosing it took longer than writing the feature, and the
lesson is the one this project keeps re-learning: **a test that asserts a refusal must first prove which refusal it is
asserting.** The case now carries a prediction, and the refusal it names is the evidence one.

A second observation from the same session, recorded rather than dismissed: the full suite reported one failure on one
run and none on the next, and the failing test was not captured. The suite has spawned-process cases that are
timing-sensitive; nothing in this change touches them, and the observation stands on its own.

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
| The change branch | Adding a resolve could refuse manifests that record today. | The existing host test cites a real ref; the suite is the regression net, and a reference that does not resolve is a manifest naming a failure that never happened. |

**Rollback** removes the field and the resolve.

## Recorded, not built

1. **A formal task in this workspace**, without which no turn can be recorded here at all - that is the Pi host state.
2. **The observable boundary**, still open, and now the only thing between the loop and its first real turn.