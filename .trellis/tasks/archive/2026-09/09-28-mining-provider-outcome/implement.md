# Implementation plan: the provider outcome on a failure record

## Before writing code

Load `trellis-before-dev`; read `.trellis/spec/backend/personal-agent-harness-loop.md` (where the finding goes) and
`.trellis/spec/backend/quality-guidelines.md`. Curate `implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [x] **1. The field.** `failure-reading.ts`: `ProviderOutcome`, the optional `provider` on `FailureRecord`, and the
      collection of the request provider records by id - last one wins, omitted when it is not an error.
- [x] **2. The tests.** `tests/failure-reading.test.ts`: the two-vocabularies case, the absent case, the rejected
      diagnostic, and the successful-provider case.
- [x] **3. The prints.** `scripts/harness-failures.mts` and `scripts/harness-corpus.mts` show the provider outcome
      beside the mechanism.
- [x] **4. The specification**: the second place the mechanism lives, the two vocabularies, and the observable boundary
      that keeps this class of edit unjudgeable for now.
- [x] **5. Run both scripts - DONE.** The real corpus has no failure, so the record was demonstrated on a ledger built to the measured shape (a preflight failure with a provider error): and paste what they show into this record.

```text
  req_preflight  startup-failed / host-shutdown-preflight (session)
    summary:    The request never reached the agent loop.
    provider:   error (http 401)
    refusals:   (none)
    component:  unattributed
    because:    the records do not determine a component
```

**Dove own name and the provider own account, side by side, neither translated into the other** - which is the whole
point: a reader can now see that a request failed at preflight *and* that the provider rejected it with a 401, without
the record having picked one for them. The attribution stays `unattributed`, honestly: no refusal preceded it and no
convergence origin is involved, so the records do not name a component of ours.

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
| `failure-reading.ts` | A field added to a record type could change what the reading reports about existing evidence. | The field is optional and additive; the existing suite is the regression net, and a failure with no provider record must read exactly as before. |

**Rollback** removes the field and two print lines.

## Recorded, not built

1. **Widening the manifest observables** so an instrument improvement is judgeable by the loop, which is the question
   this task finding raises.
2. **The preservation gap**, still measured by the corpus reading and still not decided.
3. **The first real turn**: after this round the mining names a preflight failure correctly, but the corpus still has to
   contain one for the loop to be seen doing it.