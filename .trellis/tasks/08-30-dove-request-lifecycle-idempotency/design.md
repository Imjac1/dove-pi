# Design: Dove request lifecycle idempotency

## Controller

A host-independent `RequestLifecycleController` owns leases and terminal transitions. Pi creates a lease from `input`, consumes it in `before_agent_start`, associates provider/tool continuations, and closes it at `agent_settled`.

Use a host submission identity when available. The fallback combines an adapter sequence, source, and in-flight state; content digest is evidence only. A settled request is never deduplicated against a later deliberate repeat.

## Persistence

`RequestPlan.requestId` becomes the logical ID. Provider calls keep independent IDs. Ledger fields are additive. Provider-visible context retains only the guidance required by the current logical request contract.

## Retry Matrix

- transient transport/rate-limit/service errors: bounded retry if no non-idempotent effect began;
- cancellation/supersession: terminal;
- startup/extension/configuration failure: terminal before provider dispatch;
- authorization denial: terminal blocked result;
- process recovery: record recovered, never replay unknown effects.
