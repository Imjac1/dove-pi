# Quality Guidelines

## Overview

The project uses strict TypeScript, Node's test runner through `tsx`, and focused boundary tests. The current quality gate is typecheck, unit/contract tests, installer tests, doctor, and Pi smoke.

## Forbidden Patterns

- Pi imports in `src/core`.
- Direct `.trellis` file mutation outside the provider.
- Arbitrary shell strings where a registered capability or structured PowerShell executor applies.
- Silent last-write-wins synchronization or silent provider downgrade.
- Plaintext secrets in tests, fixtures, logs, snapshots, or public docs.

## Required Patterns

- Use typed contracts at layer boundaries.
- Keep provider-qualified task IDs and execution IDs correlated but separate.
- Make mutations recoverable and lock concurrent provider writes.
- Add tests for mode boundaries, degraded paths, and failure/recovery behavior.

## Testing Requirements

Run:

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
```

Prefer deterministic fixtures and one representative integration smoke over duplicating full end-to-end tests for every capability.

## Code Review Checklist

- Does the change preserve the Pi/core/Trellis boundary?
- Are paths bounded and secrets excluded?
- Are failures and interrupted mutations visible and recoverable?
- Are docs, contracts, tests, and compatibility ranges updated together?
