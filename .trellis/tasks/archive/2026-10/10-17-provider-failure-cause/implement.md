# Implementation: an evidence-carrying classifier, a cause-driven decision, and a terminal that names the fix

## Manifests

Inline workflow (DeepSeek Harness): Phase 1.3 and the jsonl gate are skipped by the workflow's own list, and
Phase 2 loads context through `trellis-before-dev`. `implement.jsonl` and `check.jsonl` are still curated
beside this file with real entries, so that a sub-agent dispatched later - or a reviewer following the
repository's own habit - has the same context the inline path gets.

## Done when

- [x] A provider answer naming `insufficient_quota` or `insufficient_balance` classifies `terminal`, and the
      provider's token and the HTTP status are in the ledger entry for the same call.
- [x] A genuine rate limit is still `transient`.
- [x] `402` reaches the classifier as a status and does not land on the stopReason fallback.
- [x] The unmatched fallback no longer claims a review; the matched text rule still does.
- [x] `failure-reading.ts` surfaces the evidence.
- [x] A row in `AGENTS.md`'s rule table names an enforcing case, and both doc doors are green.
- [x] `npm run typecheck` and `npm test` are green.
- [x] `personal-agent-request-runtime.md:313-332` no longer says 429 is unconditionally transient.

## What it cost, recorded because it is not visible in the diff

- **The routed page was full before this change.** `personal-agent-request-runtime.md` sat at 24,520 of its
  24,576-byte cap (56 free), and the contract needed ~500 bytes however tersely it was put. The operator chose
  to make room on the page rather than raise the cap, so the retry contract was said more densely and two
  existing redundancies were removed: the same "oversized read/shell/search result is bounded before model
  re-entry" requirement stated twice, and one framing sentence carrying no rule. The page now sits at **16
  bytes of headroom**, which is the fact the next addition here will meet.
- **Ten anchors were repointed, twice.** The edits sit above every `pi.on(...)` registration, so the 18
  mount-point citations in `personal-agent-use-time-architecture.md` and nine prose citations across four
  spec pages moved by one line each time. `tests/spec-anchors.test.ts` caught both shifts; the prose
  citations nothing checks, and a range citation (`3642-3662`) that a naive repoint had already broken once.

## Ordered checklist

Ordered so that each step is independently verifiable and the suite is runnable from step 2 onward.

1. **Deciding layer** - `src/core/request-lifecycle.ts`: add `"account-unpaid"` to the category union, add
   `402` to the status mapping, extend `ProviderFailureClassification` with `providerCode` / `httpStatus`.
   Extend `ProviderFailureInput` to accept them. Run `npm run typecheck` - it names every reader that must
   be touched, which is the point of starting here.
2. **Case: the deciding layer** - `tests/request-lifecycle.test.ts` beside `:93`:
   `classifyProviderFailure({httpStatus: 402})` -> `terminal/account-unpaid`; a real rate limit
   (`{httpStatus: 429}` with no counter-cause) still `transient/http_429`; `{category: "account-unpaid"}`
   -> `terminal/account-unpaid`.
3. **Reading layer** - `src/pi-adapter/extension.ts:353-383`: add the account vocabulary rule **after** the
   transport-code rule and **before** the status rule; add `402` to the status allow-list at `:359`; split
   the fallback reason to `unread-provider-message` at `:381`; return the evidence with the classification.
4. **Case: the reading layer** - `tests/pi-adapter.test.ts`, extending the block at `:1490-1526`, with the two
   measured bodies **verbatim** (quotes and all), plus: a `402` with an unreadable body still terminal; a
   `429` whose text names a rate limit still `transient`; the four fallback cases moved to the new reason.
5. **Reporting layer: the envelope** - `extension.ts:604-612`, a named branch for `account-unpaid`:
   `code: "provider-account-unpaid"`, a summary that says the account cannot pay, `retryable: false`, and a
   `nextAction` that names the fix (settle or top up the account). Add a case that asserts the terminal
   envelope's `code`, `retryable` and `nextAction`, not just the classifier's output.
6. **Reporting layer: the ledger** - `src/core/execution-ledger.ts:563`: write `providerCode` / `httpStatus`
   when present. Extend the driven-run case at `pi-adapter.test.ts:1578` style to assert both.
7. **Reporting layer: the reader** - `src/core/failure-reading.ts:251-259`: surface the two fields, with a
   case beside `tests/failure-reading.test.ts:172`.
8. **Rule row** - `AGENTS.md`: one row naming the enforcing case in the `test:<file>#<case>` grammar, and
   stating what its door holds and what it does not (the table's own convention - several rows say where
   they are narrower than they read).
9. **Spec update (Phase 3.3)** - `personal-agent-request-runtime.md:313-332`: rewrite the transient-status
   sentence to say a named cause outranks the status, add `402`, record the new category, and note the
   evidence fields.
10. **Gates and commit** - the commands below, then `git status` reviewed by hand before the commit.

## Validation

```bash
npm run typecheck                  # the interface change surfaces every reader
npm test                           # node --test tests/**/*.test.ts
npm run test:installer             # the Python installer suite, for the doc/rule-table doors
```

Additionally, the two documentation doors the rule table is held by, which the repository runs through the
same suite: `tests/document-drift.test.ts` (a row naming a case that does not exist fails) and
`tests/spec-anchors.test.ts` (a cited `file:line` that drifted fails). Both must be green **after** the spec
edit in step 9, not before it.

## Review gates

- **After step 4**: the classifier's behaviour is decided and held; stop and read the two measured bodies
  against the new cases before touching the reporting layer, because a wrong classification carried into the
  envelope and the ledger is three places to fix instead of one.
- **After step 6**: check the ledger entry by eye against the shape in `design.md` §3 - the point of the task
  is that a reader who stops at the entry can tell *retry* from *pay*, so the entry is the deliverable.
- **After step 9**: the spec sentence and the code must agree; a spec still saying 429 is unconditionally
  transient is the original defect one layer up.

## Risky files and rollback points

- `src/pi-adapter/extension.ts` - 3902 lines, and the file several `AGENTS.md` rows cite by line. Edits are
  confined to `:359`, `:364-383` and `:604-612`; a row whose citation moves must be repaired in the same
  commit (`spec-anchors.test.ts` will say so).
- `src/core/request-lifecycle.ts` - `retryDecision` at `:295` is on every request path. This task does not
  edit it; if a change there starts to look necessary, the design is wrong and step 1 should be revisited
  rather than the loop edited.
- **Rollback** is `git revert`: design.md §6. No migration, and a ledger written by the new build is readable
  by the old one.

## Follow-up checks before `task.py start`

- [x] `prd.md` has passed its convergence pass: no open questions, no duplicated facts, all anchors kept.
- [x] `design.md` and `implement.md` both present (complex task).
- [x] Manifests curated with real entries.
- [x] The final planning summary presented, and the operator's approval of **that** summary received.
