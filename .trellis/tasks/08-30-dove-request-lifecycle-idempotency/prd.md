# Dove request lifecycle idempotency

## Goal

Represent one user submission once even when startup, provider, compaction, or continuation machinery performs multiple attempts.

## Requirements

- Assign `logicalRequestId` at the Pi input boundary before `RequestPlan` creation.
- Keep attempt/provider/tool identifiers separate from logical identity.
- Reuse the logical ID until `agent_settled` or a structured terminal transition.
- Coalesce host redelivery of an in-flight request without relying only on prompt hashes.
- Persist one request plan and one current guidance record per logical request.
- Retry only classified transient provider failures with bounded attempts/backoff.
- Never automatically retry cancellation, startup conflict, invalid configuration, authorization denial, or non-idempotent effects.
- Preserve legacy session readability and add structured terminal reasons.

## Acceptance Criteria

- [x] Five automatic attempts produce one logical request/user entry and distinct attempt records.
- [x] Repeating the same text after settlement creates a new request.
- [x] Steering/follow-up is not mistaken for automatic retry.
- [x] Cancellation and startup failure do not replay.
- [x] Request, provider, capability, and tool records retain one correlation chain.
- [x] Existing request planning, budget, continuation, and recovery tests pass.

## Out of Scope

- Deduplicating intentional completed repeats or replaying non-idempotent capabilities.
