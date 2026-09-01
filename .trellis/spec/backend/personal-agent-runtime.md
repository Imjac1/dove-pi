# Personal Agent Runtime Contract

This file is the stable entry point for Dove runtime specifications. Select the smallest ownership-oriented specification that covers the work; do not inject every runtime file by default.

## Runtime specification routes

| Specification | Use for |
|---|---|
| [Request runtime](./personal-agent-request-runtime.md) | Core Agent contracts, Pi adapter coordination, request planning, stable provider schemas, provider request budgeting, and stop-reason normalization |
| [Capability runtime](./personal-agent-capability-runtime.md) | Capability Protocol, external adapters, dispatch calibration, transactional workspace operations, and reusable development capabilities |
| [Project context](./personal-agent-project-context.md) | Dove Native Workflow state, bounded context, and read-only legacy compatibility |
| [Extension runtime](./personal-agent-extension-runtime.md) | Optional Pi extension profiles, doctor behavior, Dove extension identity, trust, authority, and registration |
| [Managed installation](./personal-agent-managed-install.md) | Managed installation, release manifests, launcher behavior, updates, repair, rollback, and installation diagnostics |

## Selection rules

- Read this router first when the owning runtime area is not yet known.
- Inject only the routed specification or specifications required by the task boundary.
- Use request runtime for provider calls and Pi lifecycle behavior; use capability runtime for reusable execution and adapter protocols.
- Use project context for native goal state and legacy data discovery; use extension runtime for Pi plugins and Dove extension authority.
- Use managed installation for installer, release, launcher, update, and repair work.
- When a change crosses ownership boundaries, include each affected routed specification explicitly in the task manifest.

## Context budget contract

- This router must remain at or below 8 KiB.
- Each routed specification must remain at or below 24 KiB, leaving headroom below Trellis' default 32 KiB per-file injection limit.
- Measure budgets from UTF-8 text normalized to LF so Git checkout line endings do not change the context contract.
- Executable scenario bodies belong in the routed specifications, not in this router.
- The regression test in `tests/spec-context-budget.test.ts` enforces route existence, budgets, router shape, and migrated-heading coverage.
