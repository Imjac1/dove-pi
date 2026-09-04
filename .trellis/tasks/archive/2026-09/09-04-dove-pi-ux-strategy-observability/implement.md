# Implementation Plan: Dove Pi UX and Strategy Observability

## Phase 0: Baseline And Scope

- [ ] Confirm this task is the active planning target and keep parallel dirty
      files out of its change set.
- [ ] Run the existing source black-box harness in a temporary project for
      chat, lookup, inventory, and a forced policy-stop case; archive the
      redacted baseline under `research/`.
- [ ] Record current event names, status surfaces, and missing snapshot fields.

## Phase 1: Shared Projection Contract

- [x] Add a typed `StrategySnapshot` projection at a core/diagnostics boundary
      that has no Pi imports and no policy side effects.
- [x] Populate it at the request boundary from `RequestPlan`, active mode,
      thinking policy, tool profile, budget counters, context guard, and cache
      diagnostics.
- [x] Keep unavailable usage values unknown and ensure resource observations do
      not feed convergence or hard-stop decisions.
- [x] Add focused unit tests for projection stability and schema compatibility.

## Phase 2: Terminal And Classification UX

- [x] Route all terminal paths through one specific envelope and prevent later
      shutdown callbacks from overwriting it.
- [x] Expose the envelope in interactive notification, headless RPC, status,
      and bounded ledger diagnostics.
- [x] Refine request-plan precedence for inventory/read-only and explicit
      plan-plus-implementation prompts; preserve lifecycle actions.
- [x] Add Chinese/English classification matrix tests, including negation,
      mixed clauses, continuation, and ordinary fast-lane requests.

## Phase 3: Public Black-Box Matrix

- [x] Extend `scripts/real-dove-blackbox.mjs` or a companion script to run all
      matrix cases through `python dove_pi.py --offline --mode rpc`.
- [ ] Add deterministic cases for duplicate/unchanged reads, repeated
      questions, provider 401/429/503, context-budget rejection,
      provider-round exhaustion, progress guard, cancellation, and session
      replacement.
- [x] Assert strategy snapshot, tool names/count, event order, terminal cause,
      redaction, and fast-lane artifact isolation for every case.
- [ ] Add a clearly labelled optional real-provider command; never claim model
      quality A/B without credentials and captured provider evidence.

## Phase 3a: Context-budget ownership correction

- [x] Remove Fast/Standard fixed total context budgets from the core compiler;
      an explicit `maxChars` is accepted only as a provider-window preflight
      result.
- [x] Remove the Pi adapter's percentage-of-window project-context cap and
      document the remaining estimate as provider-window-derived evidence.
- [x] Preserve the final `ModelGateway` complete-payload validation and its
      fail-safe context omission when the actual model window cannot fit.
- [x] Update context tests and black-box evidence to prove large-window Fast,
      Standard, and Ultra requests are not truncated by Dove mode ceilings,
      while a genuinely insufficient provider window still omits context.

Implementation note: the provider-window estimate is marked in the strategy
snapshot with `budgetSource`; unknown model usage remains `unknown`. The final
payload gate is still the only request-level hard safety decision.

Verification note: the focused context, adapter, strategy-snapshot, spec-budget,
and typecheck checks pass. The full Node suite is 280/282; the two failures are
pre-existing parallel task-convergence CLI wiring (`task.py convergence` is not
registered in the concurrently modified checkout) and are outside this scope.
Doctor, Pi smoke, and installer tests also pass (105/105). The focused public
RPC black-box suite now passes 3/3 with the isolated faux provider.

## Phase 3b: Real-path context calibration

The next implementation slice is limited to evidence collection and harness
support. It must not introduce a new budget or resource policy.

- [x] Add an isolated black-box case descriptor for each context state: unknown
      usage, known large-window usage, known near-exhausted usage, and a final
      provider payload rejection.
- [x] Keep every case on the public `python dove_pi.py --offline --mode rpc`
      path. If deterministic provider behavior cannot be injected at that
      boundary, add a documented local/fake provider seam below the launcher;
      do not call `ContextCompiler`, `ModelGateway`, or adapter internals from
      the black-box test.
- [x] Assert that Fast, Standard, and Ultra use the same unbounded compiler
      behavior for the same matching documents; only an explicit provider
      capacity may bound the result.
- [x] Assert snapshot evidence separately from policy outcome: a numeric
      provider-window-derived budget when Pi reports model usage, and
      `omitted=true` only after the final payload gate rejects the complete
      request. The adapter unit path separately preserves `unknown` when the
      host omits usage/window data.
- [x] Record the full redacted event/ledger correlation for each case and
      compare RPC terminal code with ledger terminal code. A mismatch is a
      blocker for this slice, not a reason to weaken the assertion.
- [x] Measure document-level compaction independently using one oversized
      document. Do not change per-document extraction unless the measurement
      shows semantic loss and a separate decision approves it.

### Calibration decision gate

Proceed to documentation only when the matrix demonstrates all of the
following: no mode-owned truncation, unknown capacity remains unknown, a real
provider-window rejection is attributed specifically, and RPC/ledger terminal
evidence agrees. If any case cannot be driven through the public path, record it
as unavailable with the exact missing seam; do not substitute an internal unit
test and call it a black-box result.

## Phase 4: Documentation And Verification

- [x] Update `README.md` and `README.en.md` with the one strategy model,
      diagnostic/status commands, terminal recovery table, and source-drift
      guidance.
- [x] Update the runtime spec only after tests prove the contract; keep limits
      and resource observations explicitly non-blocking.
- [x] Run focused tests, full Node tests, installer tests, typecheck, doctor,
      Pi smoke, and `git diff --check` using isolated state for black-box runs.
      Focused context/adapter/snapshot/black-box coverage passes; the full Node
      suite is 283/285 with only the two known parallel convergence CLI failures
      (`task.py convergence` is not registered in the concurrently modified
      checkout). Installer tests pass 105/105; typecheck, doctor, Pi smoke, and
      diff check pass.
- [x] Review all changed paths against this task and prepare a separate commit
      plan; do not include unrelated parallel work. Current-task-only paths are
      listed below; overlapping tracked files require hunk-level staging.

The real-path calibration is complete for unknown usage, known large-window
usage, near-exhausted windows, final payload rejection, and document-level
compaction. Two repeated black-box runs pass with the faux provider through
`python dove_pi.py --offline --mode rpc`. Remaining matrix cases that need
provider status injection, cancellation, or session replacement stay deferred
until a separate deterministic seam is approved; no resource policy was
changed for them.

### Current-task commit boundary

The intended commit contains the strategy/context projection, its tests, the
public black-box harness and tests, README documentation, the runtime-spec
contract, and this task record:

`src/core/context-compiler.ts`, `src/core/strategy-snapshot.ts`,
`src/pi-adapter/extension.ts`, `src/project-provider/native-provider.ts`,
`scripts/real-dove-blackbox.mjs`,
`tests/context.test.ts`, `tests/pi-adapter.test.ts`,
`tests/strategy-snapshot.test.ts`, `tests/real-dove-blackbox.test.ts`,
`README.md`, `README.en.md`, `.trellis/spec/backend/personal-agent-request-runtime.md`,
and `.trellis/tasks/09-04-dove-pi-ux-strategy-observability/`.

Several tracked files above also contain parallel-task hunks. Stage those files
by hunk or preserve them for a later task; do not commit the whole worktree.
Generated `.tmp-faux-project*` directories and other untracked convergence
artifacts are test/parallel outputs and are outside this commit.

## Validation Commands

```powershell
npm test -- --test-name-pattern="strategy|request plan|terminal|blackbox"
npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
node scripts/real-dove-blackbox.mjs --launcher source --cwd <temporary-project> --output <temporary-output>
git diff --check
```

## Gates And Rollback Points

- Do not expose a new status contract until Phase 1 unit tests pass.
- Do not change classification behavior until the matrix demonstrates no
  regressions for existing lifecycle and fast-lane cases.
- Do not add automatic compaction, cache keepalive, capability rewriting,
  subagent dispatch, or threshold changes in this task; create a follow-up
  plan from measured evidence.
- Do not add new resource ceilings while removing the application-level context
  ceiling; tool, elapsed-time, provider-round, and token policy remains a
  separate planned decision.
- If a black-box failure is caused by an existing runtime/convergence/installer
  task, record it as a finding with the owning task rather than fixing it here.

## Current evidence

- Source black-box startup without provider credentials reproduces a preflight
  failure before `agent_start`; the harness records a redacted provider
  classification, state/stats responses, and the separate queued-lease
  `startup-failed` ledger terminal.
- Classification coverage proves English multi-file planning enters `formal`,
  explanatory continuation questions remain read-only, and mixed
  continuation-plus-mutation prompts remain execution-owned.
- The remaining full matrix cases (deterministic provider status injection,
  cancellation/session replacement, and normal provider-backed execution)
  require a fake/local provider boundary or valid isolated credentials and are
  intentionally not claimed by this iteration.

## Verification record

- `node --import tsx --test tests/real-dove-blackbox.test.ts`: 3/3 passed in
  two consecutive runs, including large and insufficient provider windows.
- Focused suite: task-local context, adapter, snapshot, classification, and
  black-box tests pass. Two failures are isolated to the parallel
  `task-convergence-control` CLI registration.
- Full `npm test`: 283/285 passed. The two failures are the same parallel
  convergence CLI registration failures; all task-local tests, including the
  large-legacy runtime-priority regression, pass.
- `npm run typecheck`: passed.
- `npm run test:installer`: 105/105 passed.
- `npm run doctor`: passed; reports managed source drift without mutation.
- `npm run pi:smoke`: passed.
- `git diff --check`: passed (only CRLF normalization warnings).
