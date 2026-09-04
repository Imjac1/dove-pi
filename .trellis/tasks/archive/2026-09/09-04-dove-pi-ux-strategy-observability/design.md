# Technical Design: Dove Pi UX and Strategy Observability

## Change Boundary

This task adds a projection and evidence layer around existing request planning,
Pi adapter policy, lifecycle, cache diagnostics, and ledger records. It does
not become a new authority. Existing request budgets, Pi tool selection,
convergence reducer semantics, installer behavior, and native task persistence
remain owned by their current components.

Context ownership is intentionally narrower than the other policy surfaces:
Dove does not reserve a fixed per-mode or percentage-based project-context
budget. It may derive a temporary remaining-character estimate only from a
known active model window and observed usage, and the shared `ModelGateway`
remains the final authority for the complete transmitted payload. Unknown
window/usage data stays unknown; it is never converted into a guessed small
budget.

Likely implementation surfaces:

- `src/core/request-plan.ts`: clarify and test intent/lane/workflow-action
  precedence; expose stable classification evidence.
- `src/core/request-lifecycle.ts` and `src/core/contracts.ts`: normalize one
  terminal envelope per logical request and expose a projection-safe terminal
  record.
- `src/pi-adapter/extension.ts`, `progress-guard.ts`, and
  `cache-diagnostics.ts`: collect the effective policy snapshot and bounded
  observation fields without changing policy decisions.
- `src/commands/*`, `src/adapters/local-rpc.ts`, and doctor/status projections:
  expose the snapshot through status and RPC events with graceful degradation
  when Pi UI APIs are unavailable.
- `src/core/execution-ledger.ts` and diagnostics projection: correlate the
  snapshot/terminal evidence and redact prompt/tool payloads.
- `scripts/real-dove-blackbox.mjs` plus new fixtures/tests: drive the public
  source RPC path in temporary directories and assert observable outcomes.
- `README.md`, `README.en.md`, and the relevant runtime spec: document the
  model and recovery table after behavior is verified.

## Effective Strategy Contract

Use one versioned read-only projection, for example:

```text
StrategySnapshot {
  schemaVersion: 1
  logicalRequestId?: string
  intent: chat | lookup | project-work | execution
  lane: fast | formal
  interactionMode: auto | chat | work
  workflowAction?: continue | create-task | start-task | finish-task | archive-task
  executionMode: fast | standard | ultra
  executionModeSource: auto | user | inherited
  thinkingPolicy: auto | off | low | medium | high | max
  thinkingPolicySource: auto | user | pi
  toolProfile: auto | core | full
  toolProfileSource: auto | user | pi
  activeToolCount: number
  providerRound: { used: number; limit: number; source: string }
  readOnlyBudget: { used: number; warning?: number; hardStop?: number }
  context: { contextWindow?: number; observedTokens?: number; doveBudgetChars?: number; budgetSource?: "provider-window" | "unknown"; omitted: boolean; compacted: boolean }
  cache?: { lastHitRate?: number; recentRequestHitRate?: number; fullMisses: number; lastMissReason?: string }
  terminal?: { origin: string; code: string; retryable: boolean; nextAction?: string }
}
```

Fields with unavailable provider/host data are omitted or explicitly marked
unknown; they are never inferred from cumulative totals. The snapshot is
append-only evidence for a request boundary and may be returned in a status
view, RPC event, and ledger details.

## Terminal Envelope Flow

1. Request planning assigns one logical request ID.
2. Policy/provider/host code proposes a terminal envelope with the most
   specific origin and code.
3. Lifecycle settlement accepts the first terminal for that logical request;
   later shutdown/cancel callbacks may add evidence but cannot replace it.
4. The adapter emits a concise user notification and RPC event. The ledger
   stores the full bounded envelope and correlation IDs.
5. A recovery formatter maps each code to exactly one next action, without
   exposing raw prompts, provider payloads, or internal stack traces.

## Classification Contract

`intent` answers what the turn is doing; `lane` answers whether durable formal
context is needed; `workflowAction` answers a lifecycle command. Classification
is ordered as follows:

1. Explicit negation and response-only language remove non-actions.
2. Inventory/read-only detection wins when no actionable mutation remains.
3. Explicit lifecycle action is retained as `workflowAction`.
4. Explicit plan plus multi-file/cross-layer implementation selects `formal`.
5. Remaining turns map to chat, lookup, project-work, or execution.

The matrix must include mixed clauses, Chinese/English equivalents, lifecycle
words inside questions, and continuation followed by a mutation.

## Black-Box Harness

Extend the existing harness rather than creating a second launcher. Each case
gets a temporary project, `DOVE_PI_STATE_DIR`, `PI_CODING_AGENT_DIR`, and
session directory. The harness sends JSON-RPC commands, captures stdout/stderr,
then requests state/stats before exit. Provider failures and deterministic tool
responses use a fake/local provider boundary; no real API key is required for
classification, lifecycle, redaction, or terminal-attribution assertions.

Every case writes a redacted JSONL record containing case ID, prompt digest,
strategy snapshot, event type/counts, tool names (not arguments), terminal
envelope, and ledger summary. A separate optional real-provider run may measure
quality, but is clearly labelled unavailable when credentials are absent.

## Compatibility And Rollback

- Additive fields use schema versioning; old ledger/session records remain
  readable.
- Status/RPC consumers tolerate missing snapshot fields and old terminal
  records.
- If a projection causes regressions, disable only the new status/event
  projection while leaving request execution and existing guards unchanged.
- No `.trellis` or global managed-release files are written by black-box runs.
