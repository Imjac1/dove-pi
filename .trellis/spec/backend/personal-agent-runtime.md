# Personal Agent Runtime Contract

This file is the stable entry point for Dove runtime specifications. Select the smallest ownership-oriented specification that covers the work; do not inject every runtime file by default.

## Runtime specification routes

| Specification | Use for |
|---|---|
| [Request runtime](./personal-agent-request-runtime.md) | Core Agent contracts, Pi adapter coordination, request planning, stable provider schemas, provider request budgeting, and stop-reason normalization |
| [Capability runtime](./personal-agent-capability-runtime.md) | Capability Protocol, external adapters, transactional workspace operations, and reusable development capabilities |
| [Project context](./personal-agent-project-context.md) | Dove Native Workflow state, bounded context, and read-only legacy compatibility |
| [Extension runtime](./personal-agent-extension-runtime.md) | Optional Pi extension profiles, doctor behavior, Dove extension identity, trust, authority, and registration |
| [Managed installation](./personal-agent-managed-install.md) | Managed installation, release manifests, launcher behavior, updates, repair, rollback, and installation diagnostics |
| [Framework core](./personal-agent-framework-core.md) | Execution loop ownership, the gate boundary, the authority grant graph, effect identity and exactly-once, the evidence plane, context admission, and capability scoping |
| [Mode format](./personal-agent-mode-format.md) | Work-mode layout and validation, the fields a mode declares, and the boundary controls whose claims are kept at the tool boundary |
| [Code audit vertical](./personal-agent-audit-vertical.md) | Deterministic seed scanning, the coverage receipt, and the finding claim schema |
| [Bounded harness improvement](./personal-agent-harness-loop.md) | The instruments the harness uses to improve itself from its own evidence, and the boundaries that keep that improvement bounded |
| [Convergence record](./personal-agent-convergence-record.md) | The convergence contract for a formal native task, and the records around it: observations, manifests, terminal classification, decisions and applied commits |
| [Field run](./personal-agent-field-run.md) | Running Dove against a real provider on purpose: the invocation, its preconditions, the reading it records, and what that reading does and does not prove |
| [Use-time architecture](./personal-agent-use-time-architecture.md) | Who is called when while a person actually uses the harness: the loop's owner, the eighteen host mount points, the gate's live enforcement point, the process boundaries, and the trust ladder |

## Selection rules

- Read this router first when the owning runtime area is not yet known.
- Inject only the routed specification or specifications required by the task boundary.
- Use request runtime for provider calls and Pi lifecycle behavior; use capability runtime for reusable execution and adapter protocols.
- Use project context for native goal state and legacy data discovery; use extension runtime for Pi plugins and Dove extension authority.
- Use managed installation for installer, release, launcher, update, and repair work.
- Use framework core for the loop, the gate boundary, authority contracts, effect identity, evidence, context admission, and capability scoping.
- Use mode format for a mode's three files, the fields it declares, and what a declaration is allowed to claim.
- Use bounded harness improvement for the SSM reading, the failure reading, the change manifest and its verdicts, the recorded decisions, and the declared editable surface.
- Use convergence record for what a formal native task freezes and what its requests record: criteria and findings, the observation, the manifest, the terminal classification, the decisions and the applied commit.
- Use field run for a real-provider session run on purpose: the invocation, the preconditions a person supplies, the reading format, and the boundary of what such a run proves.
- When a change crosses ownership boundaries, include each affected routed specification explicitly in the task manifest.

- Use use-time architecture when the question is who runs when from the user's seat: the loop's owner, the host events the adapter attaches to, where the gate actually blocks, the process boundaries, and how far each party can be trusted.

## Context budget contract

- This router must remain at or below 8 KiB.
- Each routed specification must remain at or below 24 KiB, leaving headroom below Trellis' default 32 KiB per-file injection limit.
- Measure budgets from UTF-8 text normalized to LF so Git checkout line endings do not change the context contract.
- Executable scenario bodies belong in the routed specifications, not in this router.
- The regression test in `tests/spec-context-budget.test.ts` enforces route existence, budgets, router shape, and migrated-heading coverage.