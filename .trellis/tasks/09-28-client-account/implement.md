# Implementation plan: the client account

## Before writing code

Load `trellis-before-dev`; read `.trellis/spec/backend/personal-agent-harness-loop.md` (the three accounts go there) and
`.trellis/spec/backend/quality-guidelines.md`. Curate `implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [x] **1. The option and the field.** `failure-reading.ts`: `ClientAccount`, the `client` field, and the optional second
      argument keyed by request id.
- [x] **2. The tests.** AC1-AC2, including a two-failure ledger where only one carries an account.
- [x] **3. The failure script.** `--client-summary <file>`: read it, match its `ledgerTerminal.terminal.code` against the
      terminal records, build the map, print the account - and print nothing when the match is not exactly one.
- [x] **4. The corpus script.** Pair by the layout it already walks.
- [x] **5. The specification**: the answered question, the three accounts, and the never-merge rule.
- [x] **6. Run both scripts - DONE, on the real failing run: on the real failure and paste the output.

```text
Failures - <the preserved ledger>
  req_4845941e-...  startup-failed / host-shutdown-preflight (session)
    unseen:     the request ended before the agent loop started: whatever rejected it did so upstream of every
                recording hook, so this ledger cannot name the cause
    client:     provider-authorization-denied  (the black-box client classified the provider error text)

Harness corpus ... ledgers 180, requests 179
  terminals by class:  clean 178, failure 1
  failures: 1
    req_4845941e-...  startup-failed / host-shutdown-preflight  -> unattributed
      client:   provider-authorization-denied  (the black-box client classified the provider error text)
      unseen:   the request ended before the agent loop started: ...
```

**Three accounts of one failure, side by side, each attributed**: what Dove observed, what the ledger cannot see, and
what the client called it. The corpus reading produced its client line **without any flag**, having paired the ledger with
the run summary by the layout the runner itself defines; the failure script takes the summary explicitly, because pairing
two artifacts is a decision the caller makes.

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
| `failure-reading.ts` | A second optional argument could change what existing callers see. | It defaults to absent, and the suite asserts the unchanged cases run; the field is optional. |
| The pairing rules | A wrong pairing would put one run account on another run failure. | Keyed by request id, matched on a terminal code, attached only when the match is exactly one. |

**Rollback** removes the option and the field.

## Recorded, not built

1. **Telling the extension about a preflight failure** - the only route to the ledger naming it, and it needs the
   launcher, which is the layer that sees the RPC error.
2. **The two classifiers**, Dove own branch and the client regex, which answer the same question from different sides.
3. **The observable boundary**, still open.