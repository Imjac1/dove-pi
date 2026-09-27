# Implementation plan: the declared limit on a failure record

## Before writing code

Load `trellis-before-dev`; read `.trellis/spec/backend/personal-agent-harness-loop.md` (the over-broad sentence to
correct) and `.trellis/spec/backend/quality-guidelines.md`. Curate `implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [x] **1. The field and its rule.** `failure-reading.ts`: `unseen`, populated for a `startup-failed` terminal with no
      provider outcome, and the module documentation corrected where it over-claimed.
- [x] **2. The tests.** Preflight without a provider outcome; preflight with one; a provider failure and a convergence
      refusal - neither carries the limit.
- [x] **3. The print.** `scripts/harness-failures.mts` shows it.
- [x] **4. The specification**: the corrected sentence and the limit as a rule.
- [x] **5. Run the corpus reading - DONE, and it is the first time it had a failure to aggregate: and confirm the first real failure appears with its limit, then run the failure
      script over that ledger and paste both.

```text
Harness corpus ... ledgers 179, requests 178
  terminals by class:  clean 177, recovered 0, interrupted 0, failure 1
  failures: 1
    req_4845941e-...  startup-failed / host-shutdown-preflight  -> unattributed
      because: the records do not determine a component

Failures - <the preserved ledger of the run this round made>
  req_4845941e-...  startup-failed / host-shutdown-preflight (session)
    summary:    The request ended with host-shutdown-preflight.
    unseen:     the request ended before the agent loop started: whatever rejected it did so upstream of every
                recording hook, so this ledger cannot name the cause
    component:  unattributed
```

**The first real failure the corpus has ever held**, and the first time the mining half read one. The run that produced it,
reproducible:

```powershell
node scripts/real-dove-blackbox.mjs --launcher source --cwd <a small project> \
  --output %TEMP%\dove-pi-blackbox\run.jsonl --case-id provider-auth --timeout-ms 180000
```

**And the run refuted what the previous round claimed.** Its ledger holds **two records** and **no provider record at
all** - so for a preflight rejection the mechanism is *not* in the ledger, and the previous round verified its change
against a fixture built to the shape it expected. The claim is corrected in the specification, and the reading now
declares the limit instead of leaving the terminal name to be read as a cause.

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
| `failure-reading.ts` | A limit on a record where none belongs would be a false absence. | The rule is narrow on both halves, and the tests assert the three cases that must not carry it. |

**Rollback** removes the field and one print line.

## Recorded, not built

1. **Whether Pi exposes the preflight rejection to an extension at all** - the only way the ledger could name that cause.
2. **The preservation decision**, unchanged: the failing run this round made is preserved only because it was run by
   hand with an output path under the temporary directory the corpus walks.
3. **Widening the manifest observables**, still open.