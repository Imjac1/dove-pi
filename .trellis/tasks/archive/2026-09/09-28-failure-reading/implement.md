# Implementation plan: the failure reading

## Before writing code

Load `trellis-before-dev`; read `.trellis/spec/backend/personal-agent-project-context.md` (where the contract goes)
and `.trellis/spec/backend/quality-guidelines.md`. Curate `implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [x] **1. The producer gap.** `src/pi-adapter/extension.ts`: `requestId: currentRequestPlan?.requestId` at the four
      `appendGateRefused` sites (`:2546`, `:2639`, `:2684`, `:2702`). The ledger contract already accepts the field;
      verify each site has the plan in scope rather than assuming it.
- [x] **2. The reading.** `src/core/failure-reading.ts` (pure): group records by request id, keep the terminals whose
      `classifyTerminal` is `failure`, and build the record from the refusals, the convergence decisions and the
      observation that share that id. `unrefused` counts refusals with no id. `corpus` collects what the ledger does
      not contain - no `tool.observed` record at all is the first such observation.
- [x] **3. The tests.** `tests/failure-reading.test.ts`: each mechanism (`provider-attempt-limit`,
      `retry-refused-after-effect`, `model-budget-rejected`, `provider-authorization-denied`); a refusal attributed
      by id; a refusal with no id counted in `unrefused` and **not** attributed; the attribution table's rows,
      including `unattributed` for a provider outage and for `model-budget`; an unfamiliar `code` still emitted; and
      an empty corpus printing the count plus the observation rather than nothing.
- [x] **4. The reading script.** `scripts/harness-failures.mts`: an optional ledger path, the printed records, the
      corpus section, and exit 0 in every case including "no ledger found".
- [x] **5. The contract.** `.trellis/spec/backend/personal-agent-project-context.md`: the record, the
      attribution-by-id rule, the component table, and the two corpus gaps - including that a failing tool leaves no
      record and why that is a decision rather than an oversight.
- [x] **6. Run it on the real corpus - DONE. Both outputs, the corpus and a constructed failure: and paste what it printed into the task record: the number of requests, the
      zero failures, and the corpus observations. A reading nobody has run against the only corpus we have is a claim
      about a reading.

```text
Real corpus (a blackbox ledger): 1 request examined, 0 failures, 0 refusals without an id.
  No request in this ledger ended in a failure class.
  What this corpus does not contain:
    - no tool.observed record in this ledger: no tool ran, so a failure cannot name one
    - no request ended in a failure class across 1 request(s)

Constructed failure (a fixture, because the corpus has none):
  req_demo1  failed / provider-attempt-limit (provider, retryable)
    summary:     Dove stopped after the transient provider retry limit was exhausted.
    refusals:    fence: write outside the declared fence: src/core/action-policy.ts | sandbox: path outside the sandbox root
    convergence: {"state":"working","acceptanceId":"AC-001"}
    cost:        {"toolCalls":4,"providerRounds":3,"elapsedMs":51200,"inputTokens":92000,"outputTokens":3100}
    component:   middleware
    because:     a gate refused this request (fence, sandbox), and the policy that refuses is src/core/action-policy.ts,
                 which the surface declares under middleware
```

**Three things the implementation found that the plan did not know**, all recorded where they belong:
1. **A convergence refusal is a terminal, not a gate refusal.** It aborts the request rather than refusing one tool
   call, so it writes no `gate.refused` record at all - which is why the attribution table needs its `convergence`
   row, and why an assertion that looked for a refusal there was wrong and not the code.
2. **`host-work-mode.test.ts` writes one ledger across all its tests.** The first `gate.refused` record in it belongs
   to an earlier test that drove no request; filtering by this test gate is what made the assertion mean anything.
3. **The reachability gate refused the new module**, as it refused the axis: a reading nothing in the harness reaches
   is listed with the reason, because a reading the harness acted on would be a control.

**And one budget fact for whoever comes next**: `personal-agent-project-context.md` is at 24,030 of 24,576 bytes after
this contract. The next addition there needs a split, not a trim.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
node --import tsx --test tests/spec-context-budget.test.ts
node --import tsx scripts/harness-failures.mts
```

## Risky files

| File | Risk | Mitigation |
|---|---|---|
| The four refusal sites | They are on the tool-call path; a bad edit there refuses or records the wrong thing. | The change adds one field to an existing call, and the host test drives a refusal through one of them and asserts the id. |
| `failure-reading.ts` | A reading that attributes a failure to the wrong component would point an edit at the wrong file. | The table is stated, the evidence is carried in the record, and evidence that does not determine a component yields `unattributed`. |

**Rollback** removes the module, the script and four lines; records already written stay readable.

## Recorded, not built

1. **A record for a failing tool** (`appendToolObserved` is called only when the tool did not error), with the
   citation consequence that comes with it: an errored tool id would become citable by a pass.
2. **A corpus that contains a failure**, so the reading has something real to read.
3. **Clustering** failure patterns, which needs the above two before it can mean anything.
4. **The map's granularity**: `tool-implementation: [src]` is too coarse to attribute a failure; naming the tool files
   is its own change to the declaration.