# Hook Guidelines

## Overview

No React hooks or browser data-fetching hooks are used. Stateful behavior is represented by explicit core controllers and Pi lifecycle callbacks.

## Custom Hook Patterns

Do not add a hook abstraction for a single Pi callback. Put reusable state transitions in a core controller or provider interface and expose a thin adapter callback.

## Data Fetching

Refresh Trellis context at session start and before context-sensitive operations. Use provider revisions/mtime/hash checks; do not fetch or update remote state implicitly during startup.

## Naming Conventions

If a future UI framework is added, follow its native `useX` convention only inside that frontend package; it must not leak into core contracts.

## Common Mistakes

- Treating transient conversation state as permanent project memory.
- Reading `.trellis` files directly from a UI handler.
