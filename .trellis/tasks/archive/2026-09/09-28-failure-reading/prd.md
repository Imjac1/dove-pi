# The failure reading

## Goal

Turn what an unsuccessful request left behind into a **bounded failure record**, and fix the one producer gap that
makes a refusal unattributable. This is the loop's **mining** half - Self-Harness's "cluster failures into
verifier-grounded failure patterns" - in the smallest honest form this harness can support.

## Background: what the evidence actually holds, verified

**A failure carries a typed mechanism, not just a class.** `terminalForFailure` (`extension.ts:565-573`) builds the
terminal envelope, and its `code` distinguishes causes that the `reason` collapses: `provider-attempt-limit` (the
transient retry limit was exhausted), `retry-refused-after-effect` (Dove refused to replay after a non-idempotent
effect), `model-budget-rejected`, `provider-authorization-denied`, `startup-conflict`, `user-cancelled`. Meanwhile
`reason` is one of the nine `RequestTerminalReason` values, usually `failed`.

That is exactly the distinction Self-Harness requires and says is usually missing: "two runs can share the same
verifier outcome and differ in causal mechanism". Here the **class** is `reason` and the **mechanism** is
`code` + `origin`.

**One gap, and it is a producer gap.** `appendGateRefused` (`execution-ledger.ts:327`) takes `requestId` and writes it
into `correlation`, and **none of its four call sites passes one** (`extension.ts:2546`, `:2639`, `:2684`, `:2702`),
even though the live request id is in scope at each. So a refusal can only be attributed to a request **by ledger
position**, and position is not enough: `issueRequestHostAbort` can settle a previous request's terminal *after* the
next request has been received, so a positional rule would attribute a refusal to the wrong request - the same class of
error the observation producer was repaired for.

**And the corpus has no failure in it.** A survey of the 164 ledgers on this machine found 164 `request.terminal`
records, **all `completed`**, and **no `tool.observed` record at all** - the scenarios drive prompts, not tools. So the
reading's live output here is "no failures", and that is a **finding to print**, not a silent empty list: a reader must
be able to tell "nothing failed" from "the reading found nothing".

## Requirements

- **R1 - A refusal names the request it refused.** The four `appendGateRefused` call sites pass the live request id,
  which the ledger contract already accepts. Without it the reading has to guess from position, and position is
  demonstrably wrong when a previous request settles late.
- **R2 - A failure record is a function of the ledger, and it is bounded.** For each request whose terminal class is
  `failure`, emit: the class, the mechanism (`code`, `origin`, `retryable`, `summary`), the refusals that preceded it
  in that request (label and reason), the tools that errored, the convergence state and acceptance in progress at the
  time, the resources it cost, and a **stated** component attribution or an explicit `unattributed`.
- **R3 - The classification of a terminal is the axis's, not a second one.** `classifyTerminal` from
  `harness-axes.ts` decides which terminals are failures, so the reader and the SSM reading cannot disagree about what
  a failure is.
- **R4 - The attribution is stated, never implied.** One table maps the typed evidence to one of the declared
  components from `.trellis/harness-surface.yaml`, each row with the evidence it rests on; evidence that does not
  determine a component produces `unattributed` with the reason. An invented attribution is worse than none: it would
  point an edit at the wrong component.
- **R5 - "No failures" is a finding, not an empty list.** The reading reports how many requests it examined and what
  the corpus looks like (for example: no `tool.observed` record, so no tool ever ran), so a quiet corpus is
  distinguishable from a broken reader.
- **R6 - The reading is printed, never asserted as a gate.** `scripts/harness-failures.mts`, exit status 0 in every
  case, same disposition as the axis and the behaviour map.

## Acceptance Criteria

- [ ] **AC1** A refusal recorded through any of the four sites carries the live request id, and a test asserts it for
      the paths a host test can drive.
- [ ] **AC2** The reading emits one record per failing request, with the class, the mechanism and the refusals it
      attributes to that request by id.
- [ ] **AC3** A refusal with no request id is **not** attributed by position: it is reported as unattributed with the
      reason, because guessing is what R1 exists to remove.
- [ ] **AC4** The component attribution follows the stated table, returns `unattributed` where the evidence does not
      determine one, and names the evidence in the record.
- [ ] **AC5** An empty corpus prints the count and the corpus observation rather than an empty list (the test asserts
      both the zero-failure and the corpus-note paths).
- [ ] **AC6** No failure class is silently dropped: a terminal whose class is `failure` but whose `code` is unfamiliar
      is still emitted, with the unfamiliar mechanism carried through.
- [ ] **AC7** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.
- [ ] **AC8** The spec records the reading, the attribution table and the producer fix.

## Out of scope

- **Clustering and ranking.** Self-Harness clusters failure patterns; a first version emits records, and clustering is
  a decision about similarity that needs evidence this corpus does not contain.
- **Proposing edits.** The record is the input to a proposal; making one is the loop's next half and needs its own
  bounded context (the surface declaration now supplies part of it).
- **A corpus that contains a failure.** Manufacturing one means changing what the scenarios do; whether the test
  suite should exercise a failing run is a separate question with its own cost.
- **Fixing the causes this reading will find.** It reads; it does not repair.
