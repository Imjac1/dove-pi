# Quality Guidelines

## Overview

The project uses strict TypeScript, Node's test runner through `tsx`, and focused boundary tests. The current quality gate is typecheck, unit/contract tests, installer tests, doctor, and Pi smoke.

## Forbidden Patterns

- Pi imports in `src/core`.
- Direct `.trellis` file mutation outside the provider.
- Arbitrary shell strings where a registered capability or structured PowerShell executor applies.
- Silent last-write-wins synchronization or silent provider downgrade.
- Plaintext secrets in tests, fixtures, logs, snapshots, or public docs.

- **A count of something the code declares.** "The three observables are X, Y and Z" is worse than "the observables are
  X, Y and Z", because the second cannot be wrong about a number the reader can count. A count is a claim with no reader: the
  code changes, the sentence does not, and nothing connects them. That is how `GATE_LABELS` came to be documented as ten labels
  when the tenth plus the intensity ceiling made eleven. **Name the declaration, or name the members.**
  - **This one is a convention, not a control, and it is the only entry here that is.** Prose cannot be checked: the labels are
    kept true by the typecheck, the surface by its loader, the citations by a prohibition, and this is what remains. A
    convention that read as a control would be the defect the other entries exist to prevent.
  - **Structural numbers stay.** "One path may belong to two components" is a rule about the map rather than a count of an
    enumeration, and deleting the number would delete the rule.

## Required Patterns

- Use typed contracts at layer boundaries.
- Keep provider-qualified task IDs and execution IDs correlated but separate.
- Make mutations recoverable and lock concurrent provider writes.
- Add tests for mode boundaries, degraded paths, and failure/recovery behavior.
- Real RPC replay harnesses must allocate a private project, state directory,
  Pi session directory, provider capture, and logical session key per scenario.
  Do not infer a scenario's current request from a shared parent ledger.
- Treat an RPC host that reaches final evidence and exits after stdin EOF as a
  clean completion. Reserve forced termination for an explicit harness timeout.
- Black-box evidence is a diagnostic projection: retain digests, event types,
  and bounded counters, but never persist raw prompts, tool arguments,
  credentials, or absolute local paths.

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
CLI integration fixtures that spawn child processes must pass temporary environment overrides through the child `env` option; do not mutate the test runner's `process.env` when parallel files may observe it.

## Code Review Checklist

- Does the change preserve the Pi/core/Trellis boundary?
- Are paths bounded and secrets excluded?
- Are failures and interrupted mutations visible and recoverable?
- Are docs, contracts, tests, and compatibility ranges updated together?

## Formal Convergence Quality Gate

Formal task checks are bounded by the reducer-owned acceptance state. Findings
must be classified and tied to an existing `AC-*`; only blocking/regression
findings are fixed in the current scope. Follow-ups are recorded without
expanding the task, while scope changes and serious risks checkpoint. After
two semantic no-progress reviews, persist one criterion-bound checkpoint.
When the reducer reports `ready_to_finish`, stop product mutation and perform
only final verification and wrap-up. Tool calls, provider rounds, elapsed time,
and token usage are observation-only until a separately approved threshold task
defines calibrated limits.
