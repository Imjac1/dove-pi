# The client own account

## Goal

Answer the question round 7 left open, and act on the answer: for a preflight failure **no hook fires**, so Dove ledger
can never name that cause - and the name that reaches a person comes from the boundary that saw it. Let the failure
record carry that account, **attributed to whoever produced it**.

## Background: the answer, and how it was established

1. **Pi lifecycle has no hook in the window.** Its own extension documentation
   (`@earendil-works/pi-coding-agent/docs/extensions.md:285-291`) shows `input` going straight through skill expansion
   to `before_agent_start`; nothing fires between them. The failing run agrees: its ledger holds `request.received` and
   `request.terminal` and nothing else, so `before_agent_start` never ran.
2. **Dove authorization branch never runs for it.** `terminalForFailure`
   (`src/pi-adapter/extension.ts:570`) would produce `provider-authorization-denied`, and the ledger holds
   `host-shutdown-preflight` instead: the branch is unreachable on this path because the extension never saw a provider
   failure.
3. **The name is the client own.** `scripts/real-dove-blackbox.mjs:374` has `classifyRpcFailure`, a **regex over the
   provider error text** (`/api key|authentication|authorization/`), and that is where
   `provider-authorization-denied` in the summary comes from. Pi does not know the string; the runner decided it.

So the honest record has three accounts of one failure, each from a different boundary: Dove terminal
(`host-shutdown-preflight`), the provider records when they exist, and the client classification. **They must not be
merged into one name**, and the client one must not be presented as if the ledger had made it.

## Requirements

- **R1 - The record can carry the client account, attributed.** `FailureRecord.client` carries the code **and the source's
  own description of how it decided** - a regex over an error text is not the same kind of evidence as a recorded status
  code, and the record says which it is.
- **R2 - It is supplied by the caller, never guessed.** The reading takes an optional account for the ledger it is
  reading; it does not go looking for a summary file, and it never pairs by guesswork inside `core`.
- **R3 - The failure script takes the summary explicitly** (`--client-summary <run.jsonl.summary.json>`), so pairing is a
  decision the caller makes and can see.
- **R4 - The corpus reading pairs them by layout and says so**, because it walks the runner output directory where the
  layout is a fact: the summary sits beside the output path and the ledger under the scenario root derived from it.
  When the layout does not hold, the failure simply has no client account.
- **R5 - The client name never replaces the mechanism.** The record still reports what Dove observed; the client account
  rides beside it, like the provider one.

## Acceptance Criteria

- [ ] **AC1** A failure with a supplied client account carries the code and the source description, and its mechanism is
      unchanged.
- [ ] **AC2** A failure with no account carries no `client`, and every existing case reads exactly as before.
- [ ] **AC3** The failure script accepts `--client-summary` and prints the account when the file names this run; with no
      flag, or with a summary that does not match, it prints nothing extra and exits 0.
- [ ] **AC4** The corpus reading attaches the account for the run this round made, and reports the failure as before
      when it cannot.
- [ ] **AC5** The loop specification records the answered question, the three accounts, and the rule that they are never
      merged.
- [ ] **AC6** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.

## Out of scope

- **Making Dove see the preflight failure.** No hook exists in that window; the only way would be for the launcher -
   which does see the RPC error - to tell the extension, and that is a different design with its own cost.
- **Trusting the client classification.** It is a regex over a message; the record says so rather than promoting it to
   evidence.
- **Fixing the two classifiers into one.** Dove own branch and the client regex answer the same question from different
   sides; merging them would hide which boundary a name came from.
