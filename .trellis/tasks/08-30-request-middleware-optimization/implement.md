# Implementation Plan

## Change Boundary

Expected product-code changes:

1. `src/core/request-plan.ts` — improve bilingual negation, response-only probe handling, and fix/repair execution classification.
2. `src/pi-adapter/tool-profile.ts` — replace the broad core set with intent-owned tiers and narrow domain add-ons.
3. `src/pi-adapter/extension.ts` — make the Auto stage Dove-authoritative, pass `RequestPlan.intent`, stop Chat-time v2 deletion, suppress empty wrappers, and deliver current-turn workflow guidance.
4. `src/core/model-gateway.ts` — estimate actual serialized provider tool schemas.
5. `dove_pi.py` — route `cache` and `token` to the finite TypeScript CLI.
6. Focused tests and Chinese/English README sections — lock the real behavior and explain the lean Auto stages.
7. `.trellis/spec/backend/personal-agent-runtime.md` — update the executable contract after implementation and verification.

Explicitly not changing: extension installation catalog, Trellis provider storage, GitHub release publication, OpenRouter policy, or Pi core.

## Ordered Checklist

1. Add the request-intent regression matrix before changing classification.
2. Implement planner fixes and verify no mutation phrase can be downgraded by a response-only or explicit-intent hint.
3. Define Chat/Lookup/Project Work/Execution tool tiers and update `selectDoveToolNames()` to receive the planner intent.
4. Replace `applyAutoTools()`'s host-active union with a Dove-owned request-exact set applied once per user turn; retain drift reassertion, explicit core/full/reset, and hashline behavior.
5. Add a representative 57-tool adapter test, including third-party reactivation between `session_start` and `before_agent_start`.
6. Refactor context emission so empty retrieval is omitted, current-turn guidance is delivered, and the context hook preserves v2 ordering across project/chat/project.
7. Add actual provider tool-schema extraction/estimation and use it in the final budget gate; add small- and large-window tests.
8. Add `cache` and `token` to Python launcher routing and cover both with mocked finite CLI tests.
9. Update README wording to describe zero-tool Chat, read-only Lookup, staged escalation, and diagnostic commands.
10. Run focused tests, then the complete quality gate.
11. Perform one isolated real Pi E2E: fresh `hi`, response-only cache probe, read-only package lookup, and an execution request stopped before mutation. Record provider-visible tool count, payload/schema size, stop reason, and cache usage.
12. Update the backend runtime spec with the verified contracts.

## Validation Commands

```powershell
npm run typecheck
node --import tsx --test tests/request-plan-model-gateway.test.ts tests/pi-adapter.test.ts
python -m unittest tests.installer_test
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
git diff --check
```

## Review Gates

- The Core still imports no Pi API.
- One intent classifier owns safety tier selection.
- Lookup exposes no mutation-capable tool in the representative catalog.
- No current v2 context message is removed or reordered by an intent change.
- Final budget accounting reads the actual provider schema when present.
- Unknown launcher arguments still reach Pi.
- Tests do not touch real Pi settings, managed install state, project tasks outside this task, or GitHub releases.

## Rollback Points

- Revert request classification independently if an intent regression appears.
- Revert tool-tier selection independently while retaining schema accounting.
- Revert context emission independently while retaining legacy cleanup.
- Revert Python routing independently from all TypeScript changes.

## Start Review Checklist

- PRD contains observable acceptance criteria and no unresolved product decision.
- Design preserves the Pi/Core/Trellis boundaries.
- Scope does not include release publication or local managed-install migration.
- User explicitly approves this final planning summary before `task.py start`.

## Validation Evidence (2026-08-30)

- Request-middleware focused TypeScript suite: 35/35 passed (planner/model gateway, Pi adapter, and 57-tool tier matrix).
- Focused Python launcher suite: 15/15 passed (finite `cache`/`token` routing plus unknown-Pi-argument passthrough).
- Full Node suite: 168/168 passed.
- Installer suite: 78/78 passed.
- TypeScript, doctor, and Pi 0.84.3 smoke passed; the smoke reported `Dove Pi 0.1.0 (Pi 0.84.3)`.
- Representative host catalog: 57 tools; Chat selects 0, Lookup excludes browser automation/MCP/background/mutation tools, and Execution owns those surfaces.
- Request-exact transition matrix: Lookup -> Chat = 0, Execution -> Chat = 0, and Execution -> Lookup drops every mutation/browser/MCP/background schema; consecutive equal sets avoid redundant host updates.
- Final context regressions verify that empty or budget-omitted snapshots remain retryable at the same revision, provider-budget recovery removes only the exact Dove-derived message, marker-bearing user text is preserved, and relevant snapshot plus current-turn workflow guidance are emitted together.
- Paid live-provider E2E was not run. Pi hook integration verifies the provider-bound payload shape without incurring a provider call.
