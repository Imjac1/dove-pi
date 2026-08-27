# Implementation Plan

## Phase 1: Protocol and measurement

1. Inventory current Core contracts and identify fields that must become the public Capability Protocol.
2. Add schema/version fixtures and adapter conformance tests.
3. Add a small benchmark harness for context size, provider refresh time, and capability execution overhead.

## Phase 2: Reference adapters

4. Extract a reusable host-neutral capability invocation service from the Pi adapter.
5. Implement MCP discovery/execution with bounded arguments and ledger correlation.
6. Implement CLI/RPC invocation for local scripts and gateway-style callers.
7. Add doctor output for adapter, provider, runtime, permission, and version compatibility.

## Phase 3: Context interoperability

8. Add normalized readers for `AGENTS.md`, `CLAUDE.md`, Agent Skills metadata, and MCP resources.
9. Define authority precedence and conflict diagnostics alongside the existing Trellis provider.
10. Reuse progressive-disclosure retrieval and compaction for all providers.

## Phase 4: Validation and documentation

11. Run Pi plus external-adapter fixture smoke tests without requiring vendor accounts.
12. Verify secret exclusion, approval denial, timeout/cancellation, failure recovery, and correlation IDs.
13. Update Chinese and English README sections with the adapter model and integration examples.

## Validation Commands

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
```

## Explicit Non-Goals

- Do not add live cloud integrations before the local protocol is stable.
- Do not copy vendor-specific prompt formats into Core.
- Do not add a second project database or automatic conversation-to-memory pipeline.
- Do not broaden the capability catalog until conformance tests and evidence semantics are complete.
