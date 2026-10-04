# Directory Structure

## Overview

This is a single-package TypeScript project. Runtime boundaries are explicit: the core must not import Pi or Trellis implementation details.

## Directory Layout

```text
src/
├── core/                 # L0  contracts, mode, context, capabilities, dispatch, ledger, gate policy, instruments
├── windows-runtime/      # L1  PowerShell process and transactional workspace runtime
├── jailer/               # L1  the ACL + restricted-token boundary (mechanism; the host script it drives lives in windows-runtime/)
├── project-provider/     # L1  provider firewall and normalized project contract
├── trellis-adapter/      # L1  Trellis-specific context and lifecycle bridge
├── context/              # L1  interoperable context projection between the native and legacy records
├── capabilities/         # L1  reusable capability definitions (currently development)
├── code-audit/           # L1  deterministic seed scanning and the finding claim schema
├── skills/               # L1  skill discovery
├── web-access/           # L1  web-search readiness and configuration
├── pi-adapter/           # L3  Pi host registration and UI/command integration
├── extensions/           # L3  optional Pi extension catalog, installer, and doctor
├── commands/             # L3  the commands that host registers
├── adapters/             # L3  reference adapters for a loop the host owns
├── runtime.ts            # L3  composes the runtime the host starts
├── project-status.ts     # L3  the project-status reading the host prints
├── managed-install-status.ts  # L3  the managed-install reading the doctor and the CLI share
└── cli.ts                # L3  small diagnostic and project-management CLI
tests/                    # contract and behavior tests; mirror source boundaries
bin/                      # user-facing launcher
```

The layer marker on each line is defined under [Layering and the allowed direction](#layering-and-the-allowed-direction).

## Layering and the allowed direction

**Four layers, and the arrows only point down.** A module may import from its own layer or from any layer below it.

| Layer | Where | May import |
|---|---|---|
| **L0** contract and machinery | `src/core/` | node built-ins, and itself |
| **L1** mechanism | `windows-runtime/` · `jailer/` · `project-provider/` · `trellis-adapter/` · `context/` · `capabilities/` · `code-audit/` · `skills/` · `web-access/` | L0 |
| **L2** authority | `plane-b/` — **not built yet**; when it exists it belongs here, because the party that judges must sit above the party being judged | L1, L0 |
| **L3** host | `pi-adapter/` · `extensions/` · `commands/` · `adapters/` · the four root modules · `cli.ts` | L2, L1, L0 |

**A `core/` module importing anything above it is a defect, not a style choice.** The reason is the one in `personal-agent-framework-core.md`: the loop and the gate live at the bottom so that every action passes them *by construction*, not because a caller remembered to route it.

**Measured 2026-10-02**: 113 source files, 29 of which import across a layer; **95 point down** (allowed) and **one points up** — `src/core/workspace-policy.ts:4` takes `withProjectMutationLock` from `src/project-provider/lock.ts`. That lock is 50 lines over node built-ins and has nothing to do with the provider, so the repair is to move it down into `core/`; it is tracked as an architecture-refresh item.

**The counts move, and this sentence has already rotted once** — a day earlier it read 111 files, 26 importing across a layer, 22 down. What is load-bearing is the **rule** above and the **one upward arrow**, which the same walk reports by name; a reader who needs current numbers should re-run the walk rather than trust a number written here.

## Module Organization

- Put stable cross-layer types in `src/core/contracts.ts` or the owning boundary's `contracts.ts`.
- Keep host-specific code in `src/pi-adapter`; core modules must not import `@earendil-works/pi-coding-agent`.
- Route native goal reads and mutations through `src/project-provider`; legacy `.trellis` access is read-only.
- Keep deterministic PowerShell/workspace behavior in `src/windows-runtime`.
- Add a test beside the boundary it verifies in `tests/` rather than creating end-to-end tests for every capability.

## Naming Conventions

- Files and directories use kebab-case (`action-policy.ts`, `project-provider/`).
- Public factories use `createX`; predicates use `isX`/`hasX`; command handlers use imperative verbs.
- Use explicit provider-qualified IDs such as `native:<goalId>` and keep Pi session, legacy task, native goal, and Dove execution IDs distinct.

## Examples

- [src/core/action-policy.ts](../../../src/core/action-policy.ts)
- [src/project-provider/native-provider.ts](../../../src/project-provider/native-provider.ts)
- [src/pi-adapter/extension.ts](../../../src/pi-adapter/extension.ts)
