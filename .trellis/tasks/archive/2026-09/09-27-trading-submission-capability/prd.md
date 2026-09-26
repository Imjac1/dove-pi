# Trading Submission Capability

> **Dropped 2026-09-27, before implementation. Nothing here was built.** The user asked whether the task was
> necessary; the answer was no, and the scope was replaced by `09-27-mode-declared-capability` - the smaller, real
> defect this investigation turned up. See *Why this was dropped* at the end. The confirmed-facts inventory below is
> kept on purpose: it is the evidence anyone who does build this later would otherwise have to re-derive.

## Goal (as scoped, before the decision)

Make `order.submit` a capability the agent can actually invoke, carrying a **client order id derived from the
framework's effect identity**, so that a resume or a retry cannot double-execute. `modes/trading/MODE.md` already
states this as a requirement on whoever writes the capability; nothing implements it, so the trading mode is a set of
controls around an action that does not exist.

## Background

`modes/trading/MODE.md:23-25` says it outright: *"**Not yet produced by the framework** (2026-09-26).
`toClientOrderId` exists in the framework and has **no runtime caller**, so no submission carries a derived id today.
Until the submission capability calls it with the effect key, this section is a **requirement on whoever writes that
capability** rather than something the harness supplies."* This task is that capability.

## Confirmed facts (repository inspection, 2026-09-27)

**What the mode already requires, in its own words:**

- `modes/trading/MODE.md:10-15` — every order passes the pre-trade limits first; a limit that cannot be evaluated is a
  **block**, never a pass (SEC Rule 15c3-5, applied before entry).
- `modes/trading/MODE.md:17-21` — every order carries a client order id derived from the framework's effect identity;
  never invent a fresh id for a retry, "a new id is a new order".
- `modes/trading/MODE.md:27-31` — a submission whose outcome is unknown is **ambiguous, not failed**; do not resubmit
  on your own initiative; report the ambiguity and let the operator decide.
- `modes/trading/MODE.md:33-35` — sandbox or testnet only; a production endpoint is out of scope for this mode.

**What the mode declares around it:**

- `modes/trading/governance.yaml` — `gate.limits` = `notional` (max 100000 USD) and `quantity` (1..10000), both
  scoped `tools: [order.submit]`; `authority.capabilities: [market.read, order.submit]`;
  `evidence.artifacts: [orders.jsonl]`; `stop.on: [budget-exhausted, ambiguous-submission, emergency-stop]`.
- `modes/trading/permissions.yaml` — `always_allow: [market.read]`, `ask_before: [order.submit]`,
  `never_allow: [order.withdraw_funds, production.*]`.

**What already exists and is tested (the mechanism, not the capability):**

- `src/core/effect-ledger.ts:231` `toClientOrderId(effectKey, options)` — maps an effect identity onto a
  venue-safe id (36-char ceiling, `[A-Za-z0-9_.:-]+`); `:411` `dispatchOnce(ledger, record, fn)` — executes at most
  once and refuses after a completed or ambiguous outcome; `EffectOutcome` includes `unknown`.
- `src/core/loop-runner.ts:135` — the effect claim sits at the dispatch line, the only site that runs a tool.
- `tests/trading-mode.test.ts` — the mechanism is **already unit-tested** against a test-local `createSandboxVenue()`
  that rejects a duplicate client order id and makes **no network call**: stable id, no double-execute on resume, the
  venue as last line of defence, and no auto-retry after an ambiguous outcome.
- `modes/trading` is loaded and gated by the host today: the limit gate refuses an over-limit order and
  `ask_before: [order.submit]` now asks the operator (verified end to end in `tests/host-work-mode.test.ts`).

**What is missing:**

- No runtime capability. `src/capabilities/` holds `code-audit.ts`, `development.ts`, `runtime.ts`,
  `web-access.ts` — there is no trading registration, and `src/` has no `trading/` module. `code-audit` is the
  pattern: a vertical registers its capabilities with `createDoveRuntime()` and the mode's `authority.capabilities`
  list is what governs them.
- Nothing calls `toClientOrderId` outside tests, so `deriveEffectKey` → `toClientOrderId` is never on a real
  dispatch path.
- Nothing writes `orders.jsonl`, though the mode declares it as the run's evidence artifact.

## Requirements

- **R1** `order.submit` is registered in the shared runtime and reachable through the host's capability tool, so the
  mode's limits, scope, permission lists and `ask_before` all have an action to act on.
- **R2** The submission's client order id is **derived** from the effect identity (`deriveEffectKey` →
  `toClientOrderId`), never invented, and the same order yields the same id.
- **R3** The dispatch is at most once from the harness's own resumption paths, through the existing claim at the
  dispatch line rather than a second mechanism.
- **R4** An unknown outcome is reported as **ambiguous**, not as failure, and is not resubmitted automatically; the
  run's typed stop reason is the mode's `ambiguous-submission`.
- **R5** A duplicate the local ledger cannot see is still refused by the venue's own client-order-id check, which is
  why the id has to be the framework's.
- **R6** A production endpoint stays unreachable: the venue is constructed from the mode's declared scope
  (`sandbox-venue`, `environment: non-production`), and `never_allow: production.*` still refuses by name.
- **R7** The run writes `orders.jsonl` as the mode declares.

## Acceptance Criteria

- [ ] **AC1** Observed through the host, not a unit test: an `agent_run_capability` call for `order.submit` inside
      its limits reaches the venue once, and the fill carries a client order id equal to
      `toClientOrderId(deriveEffectKey(...))` for that order.
- [ ] **AC2** The same call replayed within one process and across two processes does not reach the venue twice; the
      second attempt is refused and reported. (The cross-process case is the one the in-memory store cannot express,
      and `tests/fixtures/harness/claim-in-second-process.ts` is the existing way to drive it.)
- [ ] **AC3** A submission whose outcome is unknown stops the run with the mode's `ambiguous-submission` reason and
      is **not** resubmitted; the operator sees the ambiguity.
- [ ] **AC4** An order outside the declared limits is refused by the limit gate **before** any venue call, and an
      order requiring consent runs only after the operator confirms.
- [ ] **AC5** A venue that rejects a duplicate client order id does so through the framework's id, asserted against a
      venue that has never seen the ledger.
- [ ] **AC6** `orders.jsonl` exists after a run, in the location and shape the mode declares.
- [ ] **AC7** No production endpoint is contacted, and `production.*` is still refused by name.
- [ ] **AC8** `npm run typecheck` is clean and `npm test` is green.

## Open question (moot - the task was dropped)

**What is the venue?** Was put to the user 2026-09-27 and not answered; it became moot when the task was dropped.
Recorded so a future attempt knows where the fork was: a **local, injectable venue** (verifiable here) versus a
**real testnet over the network** (credentials, and this environment has no working outbound access).

## Out of scope

- `market.read`. The mode's `always_allow` names it, but nothing in `MODE.md` requires it, and the vertical's point
  is submission.
- Withdrawals, transfers, or any funded action: `never_allow: [order.withdraw_funds]` states the boundary.
- A production venue or live capital, at any point.
- Re-deriving the effect identity or the claim store: both exist and are tested; this task consumes them.

## Notes

- Complex task: `design.md` (venue boundary, capability contract, ambiguity path) and `implement.md` before
  `task.py start`.
- Depends on nothing in `09-27-mode-gate-no-gate`: trading declares `limit` **with** limits, so the vacuous-declaration
  rule does not touch it.
- The recorded follow-up this comes from: `09-26-dove-agent-harness-capabilities`, which left `toClientOrderId` with
  no runtime caller and the verticals' form explicitly out of scope.

## Why this was dropped

Asked whether the task was necessary, the honest answer was no. Four reasons, in order of weight:

1. **The user had already recorded the verticals' form as undecided.** `09-26-dove-agent-harness-capabilities`'s PRD
   lists "Deciding the verticals' form" as out of scope because *the user stated it is undecided*. Building a venue and
   a submission capability decides part of that form unilaterally. The gap note this task was derived from
   (`modes/trading/MODE.md:23-25`) was written to be **honest about what the framework supplies**, not as a backlog
   item; treating it as a mandate was an inference, not a requirement.
2. **No framework guarantee depends on it, and the guarantees are already verified.** At-most-once and
   "an ambiguous outcome is not retried" are covered by `tests/harness-effect-claim.test.ts` (including the
   cross-process fixture) and exercised through the host in `tests/host-work-mode.test.ts` with `order.submit` as the
   action. What was missing is the work *behind* the action, not the contract around it.
3. **Its headline value is the one thing this environment cannot verify.** The point is a client order id that a
   *real* venue rejects as a duplicate. Outbound access is unavailable here (the search tool fails on fetch, and
   github.com times out), so the deliverable would either be self-certified against our own sandbox or become a claim
   about code - the class of claim this project has spent its budget withdrawing.
4. **The cost is not small**: a venue port, a sandbox adapter, capability registration, `orders.jsonl`, the
   ambiguity-to-stop path, and host-level tests, for a mode nothing runs.

**What replaces it:** `09-27-mode-declared-capability`, which fixes the concrete defect this investigation found -
`modes/trading` declares `authority.capabilities: [market.read, order.submit]` and nothing registers either, while the
mode-versus-registry agreement is only checked in one direction (`registered -> declared`). The user-visible effect
today is that an order gets an approval prompt, the operator confirms, and then execution throws
`Unknown capability: order.submit` (`src/core/capability-registry.ts:23`). Fail-closed, but the operator is asked
about an action that cannot run.

**Not dropped, and still true:** `toClientOrderId` has no runtime caller. That is now a *known dead export* rather
than an unrecorded one; if the capability is never built, the honest alternatives are to delete the export or to mark
it as an API awaiting a caller.
