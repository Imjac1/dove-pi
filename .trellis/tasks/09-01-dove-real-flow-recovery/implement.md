# Implementation Plan

## 1. Freeze Regression Evidence

- Add a redacted fixture for the four September 1 user turns and 15 question
  variants.
- Add failing tests for intent classification, short-reply inheritance,
  question budgeting, third-party tool reconciliation, and cache-prefix churn.

## 2. Goal Continuity

- Implement the host-independent bounded goal state.
- Extend request planning for save/export/record imperatives and effective-plan
  inheritance from an exact pending action.
- Integrate lifecycle resets and ledger correlation in the Pi adapter.

## 3. Remove Dove's Pi Permission Layer

- Remove capability allow-lists and approval tiers from `RequestPlan`; intent
  remains context and accounting metadata only.
- Make Auto mode observe Pi's active tool set without calling
  `setActiveTools`; keep `core`/`full` only as explicit compatibility controls.
- Remove the extra Dove confirmation from Pi-hosted task and capability tools.
  Preserve validation, read-only mode, ledger, reconciliation, and rollback.

## 4. Stable Tool Schema

- Keep the provider-visible schema stable across ordinary intent transitions by
  leaving Pi's selected schema untouched.
- Diagnose host/plugin schema churn from the final provider payload without
  resetting or narrowing Pi's tools.
- Add final-payload/tool-drift evidence and interop coverage for the installed
  ask-user and plan-mode extensions.

## 5. Hard Progress Bounds

- Add per-goal structured-question and repeated-confirmation counters.
- Keep semantic fingerprints for diagnostics only.
- Apply provider/tool budgets and deterministic no-tool paths without resetting
  question state incorrectly.

## 6. Honest Diagnostics

- Add goal-level cache/efficiency aggregation and display.
- Add doctor hook-order/final-tool-set probe.
- Reconcile active/unflushed optimizer shards with session-authoritative usage.

## 7. Validation

Run, in order:

1. Focused unit tests for request planning, goal state, stable tool schemas,
   progress guard, cache diagnostics, and doctor.
2. `npm test`
3. `npm run typecheck`
4. `npm run test:installer`
5. `npm run doctor`
6. `npm run pi:smoke`
7. `python .trellis/scripts/task.py validate 09-01-dove-real-flow-recovery`
8. Replay the September 1 fixture against current source.
9. Run clean-session real-provider A/B: direct Pi+Trellis, managed baseline,
   source candidate, installed managed candidate.
10. Verify release ID, implementation digest, first-call prefix evidence, goal
    success, uncached tokens, provider rounds, tools, questions, and stop reason.

## Review Gates

- No cache improvement may disable tools that Pi would otherwise make usable.
- No question-loop test may rely on exact wording.
- No source-only replay may satisfy installed-release acceptance.
- Do not modify `C:\Users\rebot\Desktop\code`; use an isolated fixture project.

## Rollback Points

- Goal-state changes are independently revertible before tool-schema changes.
- Stable-schema rollback selects the retained managed release rather than a
  second request-exact selector in the same runtime.
- Managed installer retains the previous release for immediate launcher rollback.
