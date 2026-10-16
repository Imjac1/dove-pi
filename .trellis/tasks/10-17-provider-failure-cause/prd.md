# A permanent provider failure must not read as transient: the record carries the provider's own code

## Goal

`failureKind` exists to answer one question - **should this request be retried?** - and it is the only input to
that answer (`retryDecision`, `src/core/request-lifecycle.ts:295`: `if (failure.kind !== "transient") return
{ retry: false, ... }`). On 2026-10-16 it answered `transient` for two provider states that no amount of
retrying can change, and in both cases the field that would have corrected it was in the response body and
absent from the ledger.

**User value.** The cost is measured, not imagined: **seven attempts across roughly five hours** on one
credential, and then most of a session spent diagnosing a broken credential that was never broken. Both
recorded reasons - `http_429` and `reviewed-provider-message` - read as "wait, it will lift", so the record
sent its reader to wait for a window that a quota state never opens.

## Background (measured 2026-10-16, on the shipped build, `0.2.6+f019a8d`)

- **Two credentials, two permanent states, one classification each.**

  | Provider's answer to a 25-token request | Ledger `failureKind` | Ledger `failureReason` |
  |---|---|---|
  | `429 {"message":"Token quota exhausted.","code":"insufficient_quota"}` | `transient` | `http_429` |
  | `402 {"message":"Insufficient balance: apikey status is overdue","code":"insufficient_balance"}` | `transient` | `reviewed-provider-message` |

  Neither ledger entry carries the provider's `code`, and neither carries the status it was inferred from.
- **Where the decision is made.** `classifyAssistantProviderFailure` (`src/pi-adapter/extension.ts:353`) reads
  the host's message, then `classifyProviderFailure` (`src/core/request-lifecycle.ts:384`) turns it into
  `kind` + `reason`.
- **Why the 429 came out transient.** The extractor at `extension.ts:359` pulls the status out of the message
  text with the allow-list `401|403|408|425|429|500|502|503|504|524`, and `request-lifecycle.ts:381` lists
  **429** in `TRANSIENT_HTTP_STATUSES`. The status alone decides; the body naming `insufficient_quota` is
  never read.
- **Why the 402 came out `reviewed-provider-message`.** **402 is not in the extractor's allow-list**, so no
  status is extracted; no text rule matches `insufficient balance` / `quota` / `overdue`; and the last resort
  at `extension.ts:381` - the host's failed-stream `stopReason`, all four spellings - returns
  `{kind: "transient", reason: "reviewed-provider-message"}`. **The reason string asserts a review of a
  message that matched nothing.** It is an event kind wearing the name of a cause.
- **The existing rule already states the principle this task applies.** `extension.ts:378-379` says the
  stopReason fallback "stays after the text rules on purpose: a message that says `429`, `Connection error.`
  or `aborted by the user` is classified above and never reaches here" - *a message that names a cause beats a
  message that names an event*. Both of this task's defects are cases where a cause was named and not read.
- **No trace of this vocabulary exists yet.** `402`, `quota`, `insufficient_quota`, `insufficient_balance` and
  `overdue` appear **nowhere** in `src/` or `tests/`, so nothing today holds a behaviour for them.
- **What holds the current behaviour**, and what a fix must re-hold:
  - `tests/pi-adapter.test.ts:1492-1526` - the classifier, including `HTTP 429: operation aborted` ->
    `transient/http_429` and bare `{stopReason: "error"}` -> `transient/reviewed-provider-message`.
  - `tests/pi-adapter.test.ts:1578`, `:1629` - those two values asserted end-to-end through a driven run.
  - `tests/request-lifecycle.test.ts:93` - `classifyProviderFailure({httpStatus: 429})` -> `transient/http_429`.
  - `tests/failure-reading.test.ts:172-185` - the reader that surfaces `failureKind`/`failureReason`
    (`failure-reading.ts:251-259`).
- **The record drops the raw materials too.** `appendProviderRequestCompleted`
  (`src/core/execution-ledger.ts:563`) writes `failureKind`/`failureReason` only.

## Requirements

- **R1 A named cause is read before a status.** A provider response whose body names a cause must be
  classified from that cause rather than from the HTTP status, and the rule must sit before the status rule,
  for the reason `extension.ts:378-379` already gives.
- **R2 A permanent account state is `terminal`, and it says so.** A provider answer naming an exhausted quota
  or an unpaid account classifies `terminal`, the retry loop stops, and the terminal carries a summary and a
  next action that name the fix instead of pointing at a provider error. **Decided 2026-10-16** (option A of
  the planning question): the retry loop may trust a cause the provider states, and the residual risk - a
  quota window that would have reset - is answered by recording the raw evidence beside the decision rather
  than by declining to decide at all.
- **R3 The record carries the provider's own words.** The ledger's provider-call entry carries the provider's
  error code and the HTTP status the decision was taken from, or an explicit absence, so that a reader can
  disagree with the classifier instead of having to re-derive it. The reader (`failure-reading.ts`) surfaces
  them.
- **R4 `402` is recognized as an HTTP failure** by the extractor, so that a payment failure reaches the
  classifier as a status at all rather than falling through to the stopReason fallback.
- **R5 A reason string must not assert a check that did not happen.** `reviewed-provider-message` is returned
  where nothing was reviewed and nothing matched.
- **R6 The behaviour is held by a case, and the rule by the repository's rule table**, whose `Enforcer`
  grammar requires a real `test:<file>#<case>` name that exists.

## Acceptance Criteria

- [ ] A provider answer of `insufficient_quota` / `insufficient_balance` is classified **`terminal`** and not
      `transient`, held by a case in `tests/pi-adapter.test.ts` whose input is the measured response body
      verbatim, `code` included.
- [ ] A genuine rate limit is **still** `transient`: a `429` whose body names a rate limit does not become
      terminal, so the fix does not trade one wrong answer for another. Held by a case beside the one above.
- [ ] `classifyProviderFailure({httpStatus: 402})` has a decided classification, held by a case; today the
      catch-all happens to return `terminal/http_402` and nothing asserts that.
- [ ] The ledger's provider-call entry for both measured bodies carries the provider's `code` and the status,
      asserted end-to-end through a driven run as `tests/pi-adapter.test.ts:1578` already does for `http_429`.
- [ ] `failure-reading.ts` surfaces the added fields, held by a case beside `tests/failure-reading.test.ts:172`.
- [ ] `AGENTS.md`'s rule table has a row for R1/R5 whose `Enforcer` names an existing case, and
      `tests/document-drift.test.ts` is green with it.
- [ ] The full suite and the repository's own gates are green.

## Out of Scope

- **Retry policy beyond the classification.** `retryDecision`, `#maxAttempts` and the attempt-limit machinery
  are untouched; the classifier decides only what it already decides. A run that stops earlier is a
  consequence of R2, not a change to the loop.
- **Any provider-specific configuration.** No new setting, no per-provider table in config, and nothing that
  makes a copy of an operator's `models.json` part of the product.
- **A general HTTP-status taxonomy.** Only what the measured bodies require.
- **The two-project reading itself.** Its passes stay with `10-16-two-project-reading`; this child neither
  unblocks it nor depends on it.
