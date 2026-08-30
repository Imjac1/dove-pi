# Implementation plan: Dove request lifecycle idempotency

- [x] Prove Pi event order for input, persistence, before-agent, abort, retry, and settled.
- [x] Add lifecycle controller and transition tests.
- [x] Wire Pi input/request/provider/settled hooks to one lease.
- [x] Pass stable identity into `createRequestPlan`.
- [x] Add attempt and terminal ledger events with compatible readers.
- [x] Emit request guidance once per logical request.
- [x] Add retry classification and non-retryable abort coverage.
- [x] Replay the six-abort fixture and verify one logical request.
- [x] Run typecheck, core/Pi tests, doctor, and Pi smoke.

## Risky Files

- `src/core/request-plan.ts`
- new lifecycle controller
- `src/core/execution-ledger.ts`
- `src/pi-adapter/extension.ts`
- Pi adapter/session fixtures
