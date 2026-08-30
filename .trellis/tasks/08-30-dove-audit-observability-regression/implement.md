# Implementation plan: Dove audit observability and regression

- [ ] Define additive evidence and redaction contracts.
- [ ] Extend maintenance logs with run identity, timing, decision, release, path, extension, and sync summaries.
- [ ] Correlate lifecycle records from the first three children.
- [ ] Implement read-only audit summary text/JSON output.
- [ ] Add legacy, malformed, incomplete, and secret-bearing fixtures.
- [ ] Build the isolated archived-scenario E2E replay.
- [ ] Validate repeated maintenance explanations and incomplete-session reporting.
- [ ] Run full Node, installer, doctor, Pi smoke, and diff checks.

## Risky Files

- `dove_pi.py` maintenance logging
- installer state/result contracts
- `src/core/execution-ledger.ts`
- CLI routing/audit command
- session/audit fixtures
