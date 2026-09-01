# Implementation Plan

## 1. Separate Task And Request Identity

- [x] Extend provider-neutral contracts with formal task metadata, phase, and
  artifact references.
- [x] Keep request ledger IDs independent from the current formal task ID.
- [x] Stop silently creating a formal task for every execution request.
- [x] Add explicit continuation and formal-lane resolution without semantic
  over-classification.

## 2. Add Native Formal Artifact Store

- [x] Add bounded task-directory and artifact read/write helpers under `.dove`.
- [x] Reuse the existing lock, atomic write, malformed-state, and rollback rules.
- [x] Create and validate `task.json`, `prd.md`, `design.md`, `implement.md`, and
  `acceptance.md`.
- [x] Keep `state.json` as a compact index rather than a document store.

## 3. Implement Non-Blocking Lifecycle

- [x] Add a single reducer for phase and status transitions.
- [x] Record next step, decisions, verification, and acceptance evidence from
  observed execution records.
- [x] Preserve explicit finish/archive operations without adding approval gates.
- [x] Ensure incomplete artifacts never prevent direct Pi execution.

## 4. Refine Context Projection

- [x] Inject compact task metadata by default only for relevant requests.
- [x] Add on-demand artifact retrieval with bounded excerpts and stable revisions.
- [x] Preserve append-only context ordering and avoid context rebuilds on tool
  continuations.
- [x] Add tests for unrelated requests and fresh-process continuation.

## 5. Preserve Legacy Compatibility

- [x] Keep `.trellis` parsing read-only and untrusted.
- [x] Materialize selected legacy tasks into native metadata and writable
  document copies.
- [x] Add byte-preservation tests for legacy task, spec, workflow, and journal
  files.

## 6. Validate Real Experience

- [x] Add fast-lane, formal-lane, cross-session, missing-artifact, failed-test,
  unrelated-task, and legacy-import fixtures.
- [x] Replay the September 1 question-loop and cache-prefix scenarios.
- [x] Run focused tests, full TypeScript tests, typecheck, installer tests, doctor,
  Pi smoke, and the real-provider matrix.
- [x] Compare questions, uncached input per completed request, provider rounds,
  warm first-call cache rate, and acceptance evidence coverage.

## Current Validation

- [x] Focused request-plan, ledger, and Pi adapter tests: 65 passed.
- [x] Full TypeScript test suite: 235 passed.
- [x] Typecheck, installer tests (92), doctor, and Pi smoke passed.
- [x] Real Provider smoke passed for `chat`, `auto`, and `work` with zero tools and zero
  questions; evidence is in `research/interaction-mode-validation.md`.
- [ ] Run a longer multi-turn real-provider comparison for cache and model
  quality after the updated managed release is installed.

## Validation Run

- `npm test`: 235 passed.
- `npm run typecheck`: passed.
- `npm run test:installer`: passed.
- `npm run doctor`: passed with native provider health reported.
- `npm run pi:smoke`: passed.
- Pi adapter replay: fast lookup created no `.dove/state.json`; formal request
  created all four artifacts and `agent_end` appended observed evidence.
- Latest isolated real Provider run: Chat and Auto completed in 892/892/914
  input tokens; Work formal completed in 1,802 input tokens. All had zero
  questions and tools; the provider reported zero cache reads and writes.
- User-like coding A/B: Native Pi and Dove each completed 12 Provider rounds
  and 10 tool calls with zero questions; Dove used 51,505 uncached input tokens
  versus 47,366 for Native Pi and had one extra full cache miss after a process
  restart. Both fixture suites passed 3/3. Details are in the interaction-mode
  validation evidence.
- Remaining measurement: compare real provider cache/question metrics against
  the September 1 baseline on an upstream that exposes cache usage; unit tests
  cannot prove model quality or upstream cache behavior.

## Risk And Rollback

- Risk: automatic formal-lane selection creates unnecessary documents. Mitigate
  with explicit-language preference and conservative promotion.
- Risk: task documents inflate context. Mitigate with compact default projection
  and per-artifact retrieval budgets.
- Risk: evidence reducer claims success too early. Mitigate with typed
  `passed/failed/pending/unknown` states and command-result evidence.
- Risk: legacy import mutates user data. Mitigate with source hashes and tests
  asserting `.trellis` byte preservation.
- Roll back by disabling formal-lane promotion or selecting the retained prior
  managed release; do not rewrite legacy files.
