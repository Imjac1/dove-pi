# Design: cause before status, and evidence beside the decision

## 1. Boundaries - three layers, one job each

The chain a provider failure travels is already split three ways, and the split is what this design leans on.

| Layer | Where | Its one job |
|---|---|---|
| **Reading** | `classifyAssistantProviderFailure`, `src/pi-adapter/extension.ts:353-383` | Turn the host's message into **evidence**: a status, a code, a named category. It must not decide retryability. |
| **Deciding** | `classifyProviderFailure`, `src/core/request-lifecycle.ts:384-396` | Turn evidence into `{kind, reason}`. The **only** place `transient` vs `terminal` is decided. |
| **Reporting** | `terminalForFailure` (`extension.ts:604-612`), `appendProviderRequestCompleted` (`src/core/execution-ledger.ts:563`), `failure-reading.ts:251-259` | Say what happened, what to do, and with what evidence. |

**The rule this task adds between the layers:** *a named cause decides, the evidence is recorded, and a terminal
carries the fix.* Each half is already a lesson this file holds:

- **Cause before status** is stated at `extension.ts:378-379` for the stopReason fallback - "a message that
  says `429`, `Connection error.` or `aborted by the user` is classified above and never reaches here". A
  message naming a cause beats a message naming an event. The 429-with-`insufficient_quota` body is that
  sentence's counter-example: the cause was named, and the status rule above ran first.
- **A terminal must name the fix** is the lesson of `extension.ts:367-371` (the `aborted` history): a terminal
  whose `nextAction` pointed at a provider error the ledger did not hold is the defect that session was
  written to remove. So a new terminal reason without a matching envelope is an incomplete change - it would
  land on `extension.ts:611` and read *"The provider request ended with account-unpaid"* plus *"Inspect the
  provider error and adjust the request."*, which points at the provider instead of at the bill.

## 2. Contracts

### 2.1 A new cause, not a reused one

`ProviderFailureInput["category"]` (`request-lifecycle.ts`) gains **`account-unpaid`**.

`authorization-denied` is deliberately not reused, although it is also a provider-side account problem and
also `terminal`. The two need different fixes and the record must not merge them: `authorization-denied`'s
envelope says *"Check provider credentials and retry."* (`extension.ts:608`), and for the measured case that
instruction is wrong - **both credentials authenticated**, answering `200` on `GET /v1/models` while every
completion was refused. A reader sent to check valid credentials pays the session this task exists to prevent.

### 2.2 The precedence order

`classifyAssistantProviderFailure` gains one rule position, and the order is the contract:

1. transport codes (`ECONNRESET`, …) - unchanged, first, so a real transport failure is never masked;
2. **account vocabulary (new)** - the provider's own words, matched as tokens;
3. HTTP status from the text allow-list - **now including `402`**;
4. auth text; 5. invalid-configuration text; 6. cancellation text; 7. transient text;
8. the host's failed-stream `stopReason`; 9. `unknown`.

2-before-3 is the whole point: a status is how the call went, a cause is why.

Inside `classifyProviderFailure` the order stays `cancelled > category > status > code > unknown`, and the
status table gains one entry: **`402` -> `account-unpaid`**. A 402 has one meaning (payment required), and it
is the only route available when the body is unreadable - so both routes reach the same reason, and the
evidence fields say which route it was.

### 2.3 The vocabulary is closed and enumerable

Two tokens, both measured verbatim on 2026-10-16:

| Token in the provider's own words | From |
|---|---|
| `insufficient_quota` | `api.atria-asi.ai`: `{"message":"Token quota exhausted.","code":"insufficient_quota"}` |
| `insufficient_balance` | `maas-api.antdigital.com`: `{"message":"Insufficient balance: apikey status is overdue","code":"insufficient_balance"}` |

Matched as tokens in the flattened message text - the idiom `extension.ts:359` already uses for statuses -
rather than by parsing the embedded JSON body. Rationale: the body arrives as prose with JSON inside it, may
be truncated, and a bounded JSON extraction is more machinery than the measured need. The cost is named in
§4.

### 2.4 Evidence flows with the decision

`ProviderFailureClassification` (`{kind, reason}`) extends to carry the evidence that produced it, because
the ledger and the reader need the raw materials and the classifier is the only place that has them:

```ts
export interface ProviderFailureClassification {
  readonly kind: "transient" | "terminal";
  readonly reason: string;
  readonly providerCode?: string;   // the matched provider token, verbatim
  readonly httpStatus?: number;     // the status the decision was taken from
}
```

Additive to an interface with two readers (`retryDecision`, `terminalForFailure`); both ignore what they do
not use. `appendProviderRequestCompleted` writes `providerCode` / `httpStatus` beside
`failureKind` / `failureReason`, and `failure-reading.ts:251-259` reads them back.

### 2.5 One reason string is split, not renamed

`reviewed-provider-message` is returned from two places in `extension.ts`: the transient text rules
(`:364-366`), where a message really was read and really did match, and the stopReason fallback (`:381`),
where nothing matched and nothing was read. The name is truthful in the first place and false in the second.

So the fallback gets its own reason, **`unread-provider-message`**, and the text-rule value is left alone.
This is deliberately smaller than a rename: it changes only the value that was lying, and leaves the value
that four cases already assert (`pi-adapter.test.ts:1504, 1519-1523, 1629`) meaning what it says.

## 3. Data flow, end to end

```
provider response
  └─ host errorMessage text  ("402: {… \"code\":\"insufficient_balance\"}")
       └─ classifyAssistantProviderFailure      → category: account-unpaid, providerCode, httpStatus
            └─ classifyProviderFailure          → { kind: "terminal", reason: "account-unpaid", …evidence }
                 └─ retryDecision (retry-lifecycle.ts:295)   → { retry: false, reason: "account-unpaid" }
                      └─ terminalForFailure     → { origin: "provider", code: "provider-account-unpaid",
                                                    summary, retryable: false, nextAction }
                           ├─ ledger provider.request.completed  (+ providerCode, httpStatus)
                           ├─ failure-reading.ts                 (surfaces both)
                           └─ operator notice (extension.ts:861)  "[Dove provider-account-unpaid] …"
```

## 4. Trade-offs

| Choice | Taken | Cost, named |
|---|---|---|
| Cause before status | Yes | The runtime trusts a provider's vocabulary. A provider that returns `quota exhausted` for a window that resets would end a run a retry might have saved. Mitigated by recording `providerCode` and `httpStatus`, so a wrong terminal is visible in the record rather than inferred from it. A false `terminal` costs one run; a false `transient` costs the measured five hours and tells the user to wait for a window that never opens. |
| Closed two-token list | Yes | Another provider's payment phrasing is unclassified until measured. Adding one is one line plus one case - the honest price of an allow-list, and preferable to a heuristic that guesses. |
| Token match, not body parsing | Yes | A body that spells its code only in a way the list does not hold falls through - but it then lands on the status rule (402 → `account-unpaid`) for the payment case, so the measured failure is caught twice over. |
| New category, not `authorization-denied` | Yes | One more value in the vocabulary to keep honest. Paid for by the two causes being able to send a reader to the right fix. |
| Split the reason string, not rename | Yes | One more value again; the alternative silently changed the meaning of a value four cases assert. |
| Retry policy untouched | Yes | The loop itself is unchanged: `retryDecision`, `#maxAttempts` and `attempt-limit` are read-only for this task. A run stops earlier only because a failure is now classified as what it is. |

## 5. Compatibility and migration

- **Ledger fields are additive**, in the style the file already uses for `durationMs`; unknown keys are
  ignored by readers. `tests/fixtures/ledger/*.jsonl` stay valid, and no migration or version bump is needed.
- **Behavioural change**: a message carrying either token is no longer `transient`. Nothing asserts the old
  behaviour - `402`, `quota`, `insufficient_quota`, `insufficient_balance` and `overdue` appear nowhere in
  `src/` or `tests/` today (verified) - so this changes no existing case.
- **Two existing cases change**, both for the reason split: `pi-adapter.test.ts:1519-1523` (`{stopReason:
  "error"|"failed"|"failure"}` with no matching text) and `:1629`, which asserts that value through a driven
  run. `:1504` and `:1523`'s `aborted` case carry `errorMessage: "terminated"` and land on the same fallback,
  so they move to the new reason too; the `HTTP 401/429` and `aborted by the user` cases do not move.
- **One specification line changes**: `personal-agent-request-runtime.md:313-332` states "HTTP 408/425/429/5xx
  … are transient" and "401/429 markers outrank cancellation" as the contract. Phase 3.3 rewrites those
  sentences to say *a named cause outranks the status*, and adds `402` and the evidence fields. A spec that
  still says 429 is unconditionally transient would be the same defect one layer up.

## 6. Operational notes and rollback

- **This is testable without a provider.** Every criterion is a pure function of a message text, which is
  why this child is independent of the reading's funding problem: the measured bodies are the test inputs,
  verbatim.
- **Rollback** is `git revert`: three source files, one spec paragraph, the cases, and the `AGENTS.md` row.
  No data migration, no schema version, no state to repair - a ledger written by the new build is readable by
  the old one, since the added fields are the only difference.
- **Risky files**: `src/pi-adapter/extension.ts` (3902 lines, and the file the `AGENTS.md` table's rows cite);
  `src/core/request-lifecycle.ts` (its `retryDecision` is used by every request path). Both are edited at
  named line ranges (§2.2, §2.4) and nowhere else.
