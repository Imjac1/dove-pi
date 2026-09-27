# Implementation plan: the corpus as a reading

## Before writing code

Load `trellis-before-dev`; read `.trellis/spec/backend/personal-agent-harness-loop.md` (where the contract goes, 9.4 KiB
of headroom) and `.trellis/spec/backend/quality-guidelines.md`. Curate `implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [x] **1. Export the refusal rule.** `harness-axes.ts`: `gateRefusalCounts(records)` out of `safetyAndStability`, with
      the axis using it. Run the axis suite immediately; it is the regression net.
- [x] **2. The summary.** `src/core/harness-corpus.ts`: `CorpusLedger`, `CorpusSummary`, `summarizeCorpus`, reusing
      `classifyTerminal`, `readFailures` and the exported refusal counts.
- [x] **3. The tests.** `tests/harness-corpus.test.ts`: one of each terminal class; a composite refusal split; a
      refusal with no id counted unrefused; an empty corpus; and the preservation note appearing with no failures and
      **not** appearing when a failure is present.
- [x] **4. The script.** `scripts/harness-corpus.mts`: the walk, the per-root counts, the summary, the notes, exit 0 in
      every case.
- [x] **5. Run it against the real corpus - DONE. It agrees with the hand count: and paste the output into this record: it has to agree with the hand count
      from this round research (174 ledgers, 0 failures), or one of the two is wrong.
- [x] **6. The specification**: the reading, its three reused rules, and the preservation gap it reports.

```text
Harness corpus

  roots walked:
    C:\Users\<user>\AppData\Local\Temp  (174 ledger(s))
    C:\Users\<user>\.pi\agent\dove\workspaces\ab9cd15fe95ad3ee  (0 ledger(s))

  ledgers ......................... 174
  records ......................... 1564
  requests ........................ 173

  terminals by class:  clean 173, recovered 0, interrupted 0, failure 0
  refusals by control label: (none recorded)
  failures: 0

  records by kind:
    runtime.phase.completed....... 519
    task.convergence.observed..... 178
    request.received/planned/attempt.started/attempt.completed/terminal ... 173 each
    change.applied................ 1
    change.decided................ 1

What this corpus does not contain:
  - no failure record in the corpus: the paths that produce one are driven by host tests whose state directories are
    not preserved, while the blackbox runner keeps the ledgers of runs that did not fail
```

The hand scan this round found 174 ledgers and no failure; the reading found 174 ledgers and no failure, and the two
agree on the split too (173 blackbox ledgers with a clean terminal, plus the fixture a previous round wrote, which has
no terminal at all). **A reading that disagreed with the hand count would have meant one of them was wrong, and that is
why the record is here rather than in a summary sentence.**

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
| `harness-axes.ts` | Extracting the refusal counts could change what the axis reports. | The helper is the same code moved, and the axis suite runs before anything is built on it. |
| The walk | Reading every ledger under a temporary directory could be slow or hit a file it cannot parse. | Roots are bounded, the walk skips `node_modules` and `.git`, and an unparseable ledger counts as empty. |

**Rollback** deletes the module and the script; nothing else imports either.

## Recorded, not built

1. **Preserving the ledgers of the paths that fail.** The measurement is in the summary now; whether a host test should
   leave state behind, and where, is a decision about the tests.
2. **A blackbox scenario that fails on purpose**, which would put real fuel in the preserved corpus. It needs the
   scenario runner and a real provider, and the reading is what says whether the corpus needs it yet.
3. **The first real turn**, which now has a way to *show* that it has no evidence rather than to assume it.