# Implementation plan: Dove tool-loop and context control

- [x] Add stable input and bounded result fingerprints with redaction tests.
- [x] Extend progress state for success stagnation, batch dedup, and terminal decisions.
- [x] Wire `tool_call`, `tool_result`, turn, and settled hooks.
- [x] Add intent-aware soft/hard budgets and checkpoint reasons.
- [x] Improve/adapt `ls` completion/cursor metadata compatibly.
- [x] Retire/compact obsolete request guidance at a tested boundary.
- [x] Add per-provider-call cache-prefix component diagnostics with cold-start and appended-history attribution.
- [x] Bound large read-only observations before provider-visible history and attach deterministic truncation/continuation metadata.
- [x] Replay same-batch, unchanged-success, changed-result, error, mutation, and user-retry fixtures.
- [x] Replay the exported five-call cache pattern and prove stable system/tool/Dove digests across attempts.
- [x] Bound equivalent repeated confirmation questions after affirmative answers and preserve distinct questions, retries, and mutation behavior.
- [x] Run typecheck, Pi/cache tests, doctor, and Pi smoke (launcher smoke blocked by sandbox child-process `EPERM`; direct doctor and all tests pass).

## Risky Files

- `src/pi-adapter/progress-guard.ts`
- `src/pi-adapter/extension.ts`
- context/cache audit commands
- Pi adapter tests
