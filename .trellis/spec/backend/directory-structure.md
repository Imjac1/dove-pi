# Directory Structure

## Overview

This is a single-package TypeScript project. Runtime boundaries are explicit: the core must not import Pi or Trellis implementation details.

## Directory Layout

```text
src/
├── core/               # contracts, mode, context, capabilities, dispatch, ledger
├── pi-adapter/         # Pi host registration and UI/command integration
├── project-provider/   # provider firewall and normalized project contract
├── trellis-adapter/    # Trellis-specific context and lifecycle bridge
├── windows-runtime/    # PowerShell process and transactional workspace runtime
├── capabilities/       # reusable capability definitions (currently development)
├── extensions/         # optional Pi extension catalog, installer, and doctor
└── cli.ts              # small diagnostic and project-management CLI
tests/                  # contract and behavior tests; mirror source boundaries
bin/                    # user-facing launcher
```

## Module Organization

- Put stable cross-layer types in `src/core/contracts.ts` or the owning boundary's `contracts.ts`.
- Keep host-specific code in `src/pi-adapter`; core modules must not import `@earendil-works/pi-coding-agent`.
- Route Trellis reads and mutations through `src/project-provider`; never write `.trellis` files from core code.
- Keep deterministic PowerShell/workspace behavior in `src/windows-runtime`.
- Add a test beside the boundary it verifies in `tests/` rather than creating end-to-end tests for every capability.

## Naming Conventions

- Files and directories use kebab-case (`dispatch-policy.ts`, `project-provider/`).
- Public factories use `createX`; predicates use `isX`/`hasX`; command handlers use imperative verbs.
- Use explicit provider-qualified IDs such as `trellis:<taskId>` and keep Pi session, Trellis task, and Dove execution IDs distinct.

## Examples

- [src/core/dispatch-policy.ts](../../../src/core/dispatch-policy.ts)
- [src/project-provider/trellis-provider.ts](../../../src/project-provider/trellis-provider.ts)
- [src/pi-adapter/extension.ts](../../../src/pi-adapter/extension.ts)
