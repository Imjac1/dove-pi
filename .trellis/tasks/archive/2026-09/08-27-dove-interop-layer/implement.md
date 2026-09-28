# Implementation Plan

## Phase 1: Protocol and measurement

1. Inventory current Core contracts and identify fields that must become the public Capability Protocol.
2. Add schema/version fixtures and adapter conformance tests.
3. Add a small benchmark harness for context size, provider refresh time, and capability execution overhead.
4. Project reviewed Pi plugin packages into observable host capabilities without registering duplicate Core executors.

## Phase 2: Reference adapters

5. Extract a reusable host-neutral capability invocation service from the Pi adapter.
6. Implement MCP discovery/execution with bounded arguments and ledger correlation.
7. Implement CLI/RPC invocation for local scripts and gateway-style callers.
8. Add doctor output for adapter, provider, runtime, permission, plugin capability, and version compatibility.

## Phase 3: Context interoperability

9. Add normalized readers for `AGENTS.md`, `CLAUDE.md`, Agent Skills metadata, and MCP resources.
10. Define authority precedence and conflict diagnostics alongside the existing Trellis provider.
11. Reuse progressive-disclosure retrieval and compaction for all providers.

## Phase 4: Validation and documentation

12. Run Pi plus external-adapter fixture smoke tests without requiring vendor accounts.
13. Verify secret exclusion, approval denial, timeout/cancellation, failure recovery, and correlation IDs.
14. Update Chinese and English README sections with the adapter and plugin-reuse model plus integration examples.

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
