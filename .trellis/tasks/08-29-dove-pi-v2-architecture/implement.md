# Dove-Pi V2 implementation plan

This is an execution plan for a clean-slate rewrite. Do not start `task.py start` until the final planning summary is explicitly approved by the user.

## Ordered checklist

1. Inventory current contracts and freeze a migration map for task IDs, approvals, rollback records, evidence references, and security policy only. *(complete)*
2. Create the host-independent Kernel package with identifiers, `RequestPlan`, policy decisions, capability contracts, runtime state machines, and event schemas. *(complete)*
3. Add the Event Ledger with redaction, correlation IDs, append-only writes, and incomplete-intent reconciliation. *(complete)*
4. Implement the Model Gateway with provider capability discovery, conservative budget accounting, payload validation, and stop-reason normalization. *(complete; billing precision intentionally deferred)*
5. Implement Context Service and Prompt Compiler with trust labels, relevance selection, policy ownership IDs, deduplication, compaction, and segment manifests. *(complete for V2 MVP slice)*
6. Implement Request Planner hard rules for chat, lookup, project work, and execution; add approval/deadline/mode snapshots. *(complete)*
7. Implement Capability Runtime with schema validation, approval gates, cancellation, timeout/retry semantics, verification, and evidence separation. *(complete)*
8. Build the Trellis provider adapter as normalized reads plus provider-mediated mutations; add lightweight no-project mode. *(complete for V2 MVP slice)*
9. Refactor the current Pi extension only where it improves correctness: keep Pi-specific lifecycle/UX specialization, but route budget, approval, capability execution, provider mutation, and recovery decisions through shared runtime modules. *(complete for V2 MVP slice)*
10. Add vertical-slice behavior: ordinary `hi`, read-only lookup, one approved deterministic capability, and one recoverable failure path. *(complete)*
11. Migrate only approved data/evidence identifiers and provide a visible degraded mode for unsupported versions. *(read-only degraded switch complete; data migration remains future work)*
12. Remove obsolete prompt assembly, duplicated policy blocks, and direct Trellis access after the vertical slice is validated. *(complete for V2 MVP slice; chat isolation and read-only policy are covered by regression tests)*

## Validation commands and gates

- Unit and contract tests for Kernel, compiler, gateway, capability runtime, and adapters.
- An end-to-end fake-provider test with a 12,800-token window and reserved output headroom.
- A fixture proving active PRD/context isolation for ordinary chat.
- Static dependency check proving Kernel imports no Pi/Trellis/provider modules.
- Type-check and lint for all packages.
- Recovery test that kills execution between intent creation and provider completion.
- Manual Pi smoke test for streaming, approval, cancellation, and status rendering.

## Risk points and rollback

- Keep the old adapter behind a temporary feature flag until the vertical slice passes.
- Land Kernel/contracts and gateway before deleting old prompt code.
- Preserve ledger/evidence export before migration changes.
- Roll back by disabling the new adapter path; never roll back by deleting task or evidence data.

## Follow-up checks before implementation

- Confirm exact package boundaries against `.trellis/spec/` before code changes.
- Decide the first fake/local provider and tokenizer/estimation strategy in design review.
- Verify the current Pi public API surface used by the thin adapter.
- Define redaction tests for secrets, credentials, and sensitive workspace paths.
- Re-run the final planning review after any material scope change.
