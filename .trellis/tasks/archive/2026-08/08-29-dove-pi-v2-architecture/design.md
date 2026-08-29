# Dove-Pi V2 technical design

## Design principles

1. The model is an untrusted planner. Only deterministic runtime code can mutate state or execute side effects.
2. Prompt text is a derived artifact. State, policy, context, and capability metadata live in typed records.
3. Every provider request is budget-checked as a whole before dispatch.
4. Safety-critical orchestration is host-independent; host-specific UX and lifecycle behavior may be specialized for Pi.
5. Every material decision is observable and recoverable.

## Logical components

### Dove Kernel

Pure TypeScript modules for identifiers, request state machines, policy decisions, approval state, capability contracts, and event schemas. The Kernel accepts normalized inputs and emits commands/events; it has no filesystem, network, Pi, Trellis, or provider imports.

### Request Planner

Consumes the user message, session mode, project availability, and explicit interaction level. Produces an immutable `RequestPlan`:

```ts
type RequestPlan = {
  requestId: string;
  intent: 'chat' | 'lookup' | 'project-work' | 'execution';
  mode: 'fast' | 'standard' | 'ultra';
  contextClasses: string[];
  capabilityIds: string[];
  approval: 'none' | 'confirm' | 'elevated';
  deadlineMs?: number;
  outputBudget: number;
};
```

Hard rules handle obvious cases; an auditable score may refine ambiguous cases but cannot override safety policy.

### Context Service

Builds a typed context graph from provider projections, conversation state, runtime state, and verified memory. Each node carries source, trust class, freshness/version, sensitivity, and estimated token cost. Retrieval, deduplication, compaction, and budget allocation happen here.

### Prompt Compiler

Compiles ordered segments (`invariant-policy`, `request-policy`, `context`, `capabilities`, `user`) and returns both provider messages and a segment manifest. Policy text is referenced by stable IDs so tests can detect duplicate ownership. The compiler never accepts an unbounded required segment.

### Capability Runtime

Resolves versioned capability schemas, validates arguments, evaluates preconditions and side effects, obtains approval, runs the executor, verifies results, and emits evidence. Non-idempotent operations require an intent record before the side effect.

### Model Gateway

Normalizes provider/model metadata, computes input plus reserved output/reasoning/tool overhead, builds the final payload, rejects unsafe overages, and maps provider stop reasons to runtime outcomes.

### Event Ledger

Append-only local records keyed by request/session/task/execution/provider IDs. Events are sufficient to inspect a run and reconcile incomplete provider or project mutations. Sensitive fields are redacted at the boundary.

### Pi-first host integration and provider adapters

The Pi integration maps lifecycle hooks, commands, tools, status, streaming,
cancellation, and approvals to runtime contracts. It may keep Pi-specific
orchestration and UX close together where that improves correctness or user
experience; it must still delegate budget validation, approval policy,
capability execution, provider mutations, and recovery bookkeeping to shared
runtime modules. The Trellis adapter exposes normalized project reads and
provider-mediated mutations. A lightweight provider can expose no-project mode
without pretending to be Trellis.

## Request flow

1. Host submits a user turn.
2. Planner creates and persists `RequestPlan`.
3. Context Service retrieves only plan-approved context classes.
4. Prompt Compiler emits payload plus manifest.
5. Model Gateway performs final budget validation and dispatches.
6. Model output is parsed as a proposal; capability runtime validates/authorizes any calls.
7. Runtime executes approved calls, records evidence, and streams normalized events to the host.
8. Stop reason, usage, and recovery status are finalized in the ledger.

## Budget contract

`availableInput = contextWindow - reservedOutput - reservedReasoning - toolSchemaOverhead - providerOverhead`.

The gateway rejects payloads where estimated input exceeds `availableInput`, even if individual context nodes were marked required. Compaction is deterministic and reports what was removed. Provider-reported usage is retained separately from estimates.

## Recovery and migration

Project mutations use `intent-created → provider-call → intent-finalized` records. Startup scans incomplete intents and asks the provider for status before retrying. Existing Trellis task IDs and evidence references are imported into normalized projections; old prompt strings and internal command names are not migrated.

## Testing strategy

- Kernel contract tests run without host/provider dependencies.
- Compiler tests assert segment ownership, trust labels, deduplication, and budget behavior.
- Gateway tests use a fake provider with small windows and explicit stop reasons.
- Adapter contract tests run Pi and Trellis fakes against the same normalized interfaces.
- Recovery tests simulate process death around non-idempotent calls.
- One end-to-end fixture verifies that an ordinary `hi` does not load active PRD context and completes within budget.
