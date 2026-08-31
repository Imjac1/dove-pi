# Technical Design: Request Flow Logic Audit

## Boundary

The smallest behavior gap is that the task-creation confirmation is a stateful workflow boundary, but the cancellation branch returns before updating the state machine. The same boundary also lets an existing current task override an explicit create action and drops the collected scope at the Trellis handoff. Separately, token-audit computes a per-project reasoning value but drops it at the aggregate boundary and applies its time filter inconsistently. The implementation remains limited to the existing owners:

- `src/core/planning-session.ts` owns planning states and legal transitions.
- `src/pi-adapter/extension.ts` maps native confirmation outcomes into those transitions and returns workflow details.
- `src/project-provider/**` owns operation-specific task identity/reconciliation and the provider mutation contract.
- `src/commands/token-audit.ts` owns project and aggregate token accounting.
- Existing focused tests and a new adapter-level replay own regression evidence.

## State Contract

Add explicit cancellation and re-collection transitions to `PlanningSession` rather than mutating internal fields from the adapter. The cancelled state must be observable in the snapshot and guidance, must not satisfy `questionDecision()` as `awaiting-create`, and must allow a later question to collect fresh input. Explicit `create-task` must win over an unrelated current task. The snapshot carries the collected title plus a bounded goal/scope value so the adapter can pass it through the existing Trellis description/PRD creation fields. A new request ID still replaces the snapshot; a repeated request ID remains idempotent and preserves its state.

The adapter calls the cancellation transition immediately after a negative native confirmation and returns `cancelled: true` plus the resulting workflow state. The create path resolves the newly created task from operation output and/or a before/after identity comparison, never by blindly preferring the old `currentTask`. It passes the bounded goal/description to the provider through a typed operation payload. Mutation errors do not call the success transitions.

Mutation recovery must use operation-specific evidence. Revision change is only a signal to refresh; it is not a success proof. A create intent is observed only when the requested new task identity is found and was absent from the recorded pre-state. Start/finish/archive are observed only when the selected task is found and has the operation's terminal status. Ambiguous or externally changed state remains unknown. Mutation IDs use collision-resistant IDs so concurrent calls cannot collapse into one ledger intent.

## Accounting Contract

Keep the existing per-project accumulation and add the same reasoning amount to `totals.reasoning` within the same filtered sample loop as input/cache/output. Make output extraction accept the same `sinceHours` filter and count a session only when it contributes at least one included usage sample. This preserves the intended filter semantics and makes the aggregate a mathematical sum of the emitted project rows. Add assertions for raw totals, filtered output, and formatted aggregate.

## Data Flow

```text
native confirmation
  -> cancel/execute result
  -> PlanningSession transition
  -> structured workflow result
  -> next tool_call decision

session JSONL
  -> collectCacheUsageSamples
  -> project reasoning
  -> aggregate reasoning
  -> formatted audit
```

## Compatibility and Rollback

- Existing state names remain valid; the new cancelled state is additive and only affects the post-cancellation branch.
- Existing successful creation and explicit `/task` command behavior remain unchanged.
- Historical token audit files are read-only; only the computed aggregate changes.
- Rollback is local: revert the state transition and adapter mapping independently from the one-line accounting fix if either regression appears.
