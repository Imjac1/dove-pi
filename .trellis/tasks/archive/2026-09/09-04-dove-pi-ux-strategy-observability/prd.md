# Dove Pi User Experience and Strategy Observability

## Goal

Make Dove Pi understandable and diagnosable during normal use. A user must be
able to see which strategy actually took effect, why a request stopped, and
what the next action is, without learning several overlapping commands or
reading raw ledger records. Real black-box runs must exercise the same public
RPC/CLI path as a user and produce evidence that can distinguish classification
errors, context growth, provider failures, and deliberate policy stops.

## User Value

- Fewer unexplained `Operation aborted` outcomes.
- One consistent explanation when `/mode`, `/dove-mode`, thinking, and tool
  profiles interact.
- Complex requests are treated as formal work reliably; inventory/read-only
  requests are not accidentally promoted into execution.
- Long sessions expose context/cache pressure as observations and recovery
  suggestions, not as arbitrary extra stops or a Dove-owned context ceiling.
- A maintainer can reproduce a reported UX problem in an isolated temporary
  project without touching the user's managed release or Pi state.

## Confirmed Evidence

- The repository exposes multiple independent controls: `/mode`,
  `/dove-mode`, `/dove-thinking`, and `/dove-tools` (`README.md:132-249`).
- `RequestPlan` already computes intent, lane, interaction mode, context
  classes, output budget, and workflow action (`src/core/request-plan.ts`).
- `RequestTerminalEnvelope` and request-level ledger records already carry
  structured origins such as provider, model budget, provider-round,
  progress-guard, convergence, and session (`src/core/request-lifecycle.ts`,
  `src/core/contracts.ts`).
- Cache diagnostics, context-budget guards, read-only budgets, and provider
  round budgets exist, but their effective values and sources are not exposed
  together in one user-facing snapshot (`src/pi-adapter/cache-diagnostics.ts`,
  `src/pi-adapter/extension.ts`).
- Real session evidence contains very large prompt prefixes, occasional full
  cache misses, zero capability/recipe executions, and rare dispatch use. The
  dominant cost is repeated input/context, not generated output.
- A source black-box harness exists (`scripts/real-dove-blackbox.mjs`) and can
  use `python dove_pi.py --offline --mode rpc` with isolated state directories.
- The current worktree contains unrelated parallel changes. This task must not
  reset, clean, globally install, or commit those changes.

## Requirements

### R1. One effective strategy snapshot

Expose a typed, read-only snapshot for the current logical request and session
that includes:

- `intent`, `lane`, `interactionMode`, `workflowAction`;
- effective `executionMode`, `thinkingPolicy`, and `toolProfile`, with source
  (`auto`, user command, Pi host, or inherited task state);
- provider-round budget and usage;
- read-only budget warning/hard-stop values and usage;
- context-window observation, Dove context budget, and whether context was
  omitted/compacted;
- cache observations when available;
- terminal origin/code, retryability, and one next action.

The snapshot is a projection, not a second policy authority. It must not change
existing ceilings or override Pi's tool selection.

### R2. Consistent terminal attribution

Every logical request has at most one final terminal envelope. The envelope
must be available through the Pi UI notification/status path, headless RPC
events, and the execution ledger. The most specific cause wins over generic
shutdown/abort wording. User cancellation, provider failure, model budget,
provider-round, progress guard, convergence, and session replacement remain
distinct codes.

### R3. Stable request classification

- Inventory/read-only queries take precedence over lifecycle words when no
  mutation is requested.
- A request that explicitly combines planning with multi-file or cross-layer
  implementation enters the formal lane.
- `intent`, `lane`, and `workflowAction` have documented non-overlapping
  meanings and are emitted in the snapshot.
- Classification changes are covered by a matrix of Chinese and English
  examples, including negation and mixed requests.

### R4. Real black-box regression matrix

Provide an isolated harness/test matrix using the public source RPC path and a
fake/local provider where deterministic behavior is required. Cover:

- chat, lookup, inventory, complex formal execution, and continuation;
- duplicate reads, unchanged reads, repeated questions, and normal progress;
- provider 401/429/503, context-budget rejection, provider-round exhaustion,
  progress-guard stop, user cancellation, and session replacement;
- strategy commands changing one dimension at a time.

Each case records the effective snapshot, tool availability, event sequence,
terminal envelope, and redacted ledger evidence. Tests must assert that fast
lane cases do not create formal/convergence metadata.

### R5. Resource observations remain non-blocking

Record tool calls, provider rounds, elapsed time, cache hit/miss details, and
provider-reported token fields at request scope when available. Unknown data is
explicitly unknown. These metrics may trigger a warning or suggested recovery
action, but never abort, checkpoint, or alter convergence state in this task.

### R5a. Context budget ownership

Dove must not impose a fixed application-level context budget by mode, request
type, or percentage of the model window. The effective project-context budget
is unbounded until the active model/provider window is known; when it is known,
Dove may perform only a conservative preflight calculation for the actual
remaining window and the final transmitted payload must still pass the shared
provider-window validator. If the provider window or usage is unknown, the
snapshot reports `unknown` rather than guessing a small budget. Context may be
omitted only when the final provider safety check proves the complete payload
cannot fit.

### R6. Documentation and recovery UX

Update `README.md` and `README.en.md` with one concise strategy model, the
status/diagnostic entry points, and a recovery table for terminal codes. Avoid
requiring users to understand internal ledger names. Explain managed-release
source drift as a diagnostic condition and point to the public repair action;
do not modify the managed release as part of this task.

## Acceptance Criteria

- [ ] **AC-001 Strategy projection:** `/status full`, `agent_doctor` or the
      equivalent RPC status event exposes one coherent effective strategy
      snapshot with values and sources for mode, thinking, tools, intent, lane,
      budgets, context, and terminal state.
- [ ] **AC-002 Terminal visibility:** every forced stop in the black-box matrix
      emits one specific terminal envelope in RPC and ledger output; generic
      `Operation aborted` text never replaces a more specific cause.
- [ ] **AC-003 Classification matrix:** inventory/read-only, formal
      plan-and-implement, lifecycle-only, negated, and mixed Chinese/English
      prompts produce the expected intent/lane/action without extra questions.
- [ ] **AC-004 Fast-lane isolation:** chat and lookup cases create no formal
      task/convergence files, mutation blocks, or workflow confirmation.
- [ ] **AC-005 Resource observation:** large prompt/context and cache-miss
      cases record bounded observations and a recovery suggestion while the
      semantic request remains eligible to continue.
- [ ] **AC-006 Real-path replay:** the isolated RPC harness runs all matrix
      cases through `python dove_pi.py --offline --mode rpc`; no case relies on
      calling internal functions instead of the public path.
- [ ] **AC-007 Redaction and compatibility:** diagnostics omit secrets, raw
      prompts, and raw tool arguments; existing session/ledger/state fixtures
      remain readable and unrelated Pi extensions remain available.
- [ ] **AC-008 Documentation:** both README files describe the effective
      strategy model, terminal recovery actions, black-box diagnostic command,
      and managed source-drift handling.
- [ ] **AC-009 Quality gate:** focused tests, full Node tests, installer tests,
      typecheck, doctor, Pi smoke, and `git diff --check` pass without touching
      the real managed release or user Pi state.

## Out Of Scope

- Raising tool-call, elapsed-time, provider-round, or token limits.
- Adding new resource thresholds or policy limits while context ownership is
  being corrected.
- Turning resource totals into convergence or request hard-stop conditions.
- Replacing Pi's tool authority, adding a second permission/approval system, or
  disabling third-party Pi extensions.
- Changing the fixed Pi `Operation aborted` text.
- Implementing capability/recipe auto-rewriting, subagent scheduling, or cache
  keepalive before the black-box evidence proves a need and a separate plan is
  approved.
- Updating the global managed release, Python, Node, or user project files.
- Mixing installer fixes, convergence reducer changes, or native workflow
  migrations into this task.

## Risks And Deferred Decisions

- A provider may expose incomplete usage data; the snapshot must show unknown
  rather than infer values.
- Pi host APIs differ between interactive and RPC modes; the contract must be
  additive and tolerate unavailable UI surfaces.
- Automatic compaction/continuation may improve cost but can change cache
  behavior; defer implementation until this task has measured the current
  black-box baseline.
- Capability/recipe and subagent routing are promising but currently unused;
  measure discoverability and model choice first rather than forcing them.

## Open Questions

None blocking for planning. The next implementation approval should cover only
the scope and acceptance criteria above; any threshold change requires a new
task after real-run calibration.
