# Dove Pi runtime reliability and synchronization

## Goal

Make Dove Pi start deterministically, preserve exactly one logical user request across retries, stop stagnant tool loops, and produce enough redacted evidence to explain failures without disabling useful third-party Pi plugins.

## Background

The `dove-pi-audit-20260830` archive proved four coupled defects:

- Managed and project-local Dove entries registered the same `agent_*` tools twice.
- The tactical `Path.exists()` workaround lets any project-local `personal-agent.ts` suppress managed Dove and crosses the trust boundary.
- One logical prompt was persisted six times with six generated request IDs after aborts.
- One audit request executed 63 `ls` calls, including fourteen identical calls in one assistant message and many unchanged successful calls.

Transcript/tool growth, rather than one oversized static system prompt, was the primary observed context-growth mechanism. Maintenance logs could not explain two installs and one repair within a few minutes.

## Requirements

### R1. Extension authority and synchronization

- Managed Dove is the default authority for the managed launcher.
- Project Dove may override it only through explicit developer selection and trust/authorization.
- Preserve unrelated third-party Pi plugins; disabling all project extensions is not acceptable.
- Identity includes extension ID, version, implementation digest, canonical entry path, origin, and trust state. Filename existence is not identity.
- Startup compares and selects only; it never overwrites a checkout.
- `install <source>`, `update`, and `repair` atomically synchronize managed releases under the existing maintenance lock.
- Report `in_sync`, `managed_newer`, `project_newer`, or `diverged`, plus the selected authority.

### R2. Logical request idempotency

- Assign one stable `logicalRequestId` before `RequestPlan` creation.
- Attempts/provider calls have separate IDs and never create another user message or guidance entry.
- Startup/configuration failures and explicit cancellation are terminal and not automatically retried.
- Retry only bounded, classified transient failures.
- Distinguish `user_cancelled`, `startup_failed`, `provider_failed`, `superseded`, `timed_out`, and `shutdown`.

### R3. Tool-loop and context control

- Coalesce or block identical tool calls in one assistant batch before duplicate execution.
- Detect cross-turn stagnation using normalized input and result digests, including unchanged successful reads.
- Give read-only inspection tools bounded budgets and a strategy checkpoint; preserve mutation authorization.
- Prevent unbounded request-guidance accumulation.
- Attribute cache-prefix changes without treating cumulative cache-read tokens as system-prompt size.

### R4. Audit and maintenance evidence

- Correlate session, request, attempt, provider, tool, extension-resolution, and maintenance run IDs.
- Maintenance evidence includes schema, timing, decision, release/manifest identity, paths, no-op/repair reason, extension summary, and bounded failures.
- A local audit-summary command emits redacted aggregates, never secrets, full environments, private prompts, or raw tool arguments.
- Regression fixtures use temporary state and reproduce the archived failures.

## Child Tasks and Order

1. `08-30-dove-extension-identity-sync` — safe startup authority and managed synchronization.
2. `08-30-dove-request-lifecycle-idempotency` — stable logical requests and retry semantics.
3. `08-30-dove-tool-loop-context-control` — duplicate/stagnant tool control and bounded context.
4. `08-30-dove-audit-observability-regression` — correlation, maintenance evidence, and cross-child replay.

Implement in this order so startup failure cannot contaminate request/tool regression tests.

## Acceptance Criteria

- [ ] Source-checkout launch registers each Dove tool once and preserves unrelated Pi extensions.
- [ ] Untrusted or unrelated project `personal-agent.ts` cannot suppress managed Dove.
- [ ] Mismatch selects managed by default and requires explicit trusted developer override for project code.
- [ ] Managed artifacts synchronize atomically without startup writes to a checkout.
- [ ] Five forced attempts persist one user message and one guidance record with distinct attempt records.
- [ ] Fourteen identical calls in one batch execute the underlying operation at most once.
- [ ] Unchanged successful calls checkpoint and terminate within a bound.
- [ ] Request context stays bounded and provider-budget checks remain fail-closed.
- [ ] Redacted audit output explains selection, aborts, stagnation, cache changes, and maintenance decisions.
- [ ] Typecheck, Node tests, installer tests, doctor, Pi smoke, and isolated replay pass.

## Out of Scope

- Provider billing optimization or a second cost-accounting system.
- Disabling all Pi extensions.
- Automatically overwriting/resetting a checkout.
- Remote telemetry or wholesale Pi session/transport replacement.

## Key Decisions

- Managed wins by default; project override is explicit and trusted.
- Synchronization mutations occur only through managed maintenance commands.
- Third-party Pi plugins remain supported.
- Authority ambiguity and mutations fail closed; read-only diagnostics remain available.
