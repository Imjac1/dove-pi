# Acceptance Report

## Scope

Implemented workspace modes and centralized model-context isolation. The
dedicated pentest workflow is intentionally deferred.

## Acceptance Results

| Criterion | Result | Evidence |
|---|---|---|
| AC1 workspace mode selection and persistence | PASS | `workspace-policy` tests; CLI `workspace status|set`; `/dove-workspace` |
| AC2 launch lens policy without global settings mutation | PASS | installer launcher regression tests for default, persisted, and one-shot modes |
| AC3 oversized custom/background diagnostics are bounded | PASS | `tests/context-projection.test.ts` |
| AC4 normal development diagnostics remain available | PASS | model projection and Pi adapter tests |
| AC5 dependency/vendor diagnostics are classified | PASS | context projection metadata tests |
| AC6 repeated background failure projection remains bounded | PASS | existing Pi adapter failure-loop regression coverage |
| AC7 intensity/context/tool authority remain independent | PASS | Pi adapter, request-plan, and tool-profile tests |
| AC8 help/status explain orthogonal controls | PASS | README/help updates and Pi smoke |

## Validation

- `npm run typecheck` — passed
- `npm test` — 311 passed, 0 failed
- `npm run test:installer` — 111 passed, 0 failed
- `npm run doctor` — passed; workspace defaults to `development`
- `npm run pi:smoke` — passed
- `node --check bin/dove-pi.cjs` — passed
- `python -m py_compile dove_pi.py` — passed
