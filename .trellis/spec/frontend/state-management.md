# State Management

## Overview

State is intentionally split by authority rather than held in a frontend store.

## State Categories

- Pi owns host/session/UI state.
- Dove core owns mode, policy, capability, dispatch, ledger, and runtime state.
- Trellis owns project tasks, specs, journals, workflow, and long-term memory.
- The provider exposes a normalized, refreshable read model between them.

## When to Use Global State

Add a shared core state object only when multiple commands or tools need the same domain state. Do not introduce a frontend-global copy of Trellis tasks or specs.

## Server State

There is no server-state cache in the first release. Startup is offline-first; explicit update/migration commands own network or CLI maintenance behavior.

## Common Mistakes

- Keeping a second hidden task database in Pi settings.
- Allowing a mode change to mutate an already-running step.
- Using stale provider context after a revision change.
