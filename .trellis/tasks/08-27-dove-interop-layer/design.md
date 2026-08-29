# Technical Design

## Architecture

```text
Pi / Claude Code / Codex / Hermes
              ↓ host adapter
        Dove Interop Boundary
              ↓
      Dove Core Protocols
       ├─ capability registry
       ├─ policy / approval
       ├─ dispatch
       ├─ execution ledger
       └─ evidence store
              ↓
       Windows / local runtime

Trellis / AGENTS.md / CLAUDE.md / Skills / MCP resources
              ↓ provider adapters
       Normalized ProjectContext
```

Core owns execution semantics and never imports a host or project implementation. Adapters translate external calls
into the same typed capability and context contracts.

## Data Flow

1. Host receives a user request and asks Dove to discover or execute a capability.
2. Dove validates the versioned request, policy, scope, preconditions, and approval state.
3. Dove executes through the local runtime, writes `execution.started`, and persists raw output outside the model
   prompt.
4. Dove verifies the result, writes normalized summary/evidence and `execution.completed` or `execution.failed`.
5. The host receives a compact result with correlation IDs and source references.
6. Context providers expose indexes first; targeted reads compile bounded excerpts with source boundaries.

## Adapter Order

1. Pi reference adapter (existing).
2. MCP server for capability discovery/execution and normalized context lookup.
3. CLI/RPC adapter for scripts, CI, and Hermes-style gateway callers.
4. Claude Code/Codex integration fixtures and documentation; live vendor-specific behavior remains optional.

## Pi Plugin Reuse Strategy

Pi plugins are first-class host providers, not code to be copied into Dove Core.

- The extension catalog declares the host capabilities supplied by each reviewed plugin (for example TUI telemetry,
  code diagnostics, MCP client access, web access, browser automation, structured questions, planning, and background
  work).
- Dove projects configured plugin packages and their registered Pi tools into an observable host-capability report.
- Host capabilities are not registered as Core capabilities. Plugins keep their native Pi UX and lifecycle, while Dove
  Core remains authoritative for Dove capability approval, execution state, ledger correlation, and evidence.
- Missing or partially loaded plugins produce a visible degraded capability instead of triggering a duplicate Dove
  implementation.
- Dove may directly depend on a mature plugin for Pi-specific behavior when the catalog pins and doctors its compatible
  version. Portable protocol behavior still requires a host-neutral Core contract.

## Context Strategy

- Use a single provider firewall and explicit authority manifest.
- Load project indexes/current task by default.
- Load full documents only for explicit intent or a relevance hit.
- Compact oversized documents around headings/query matches and retain source references.
- Never merge conflicting project authorities automatically; report the conflict and require binding/reconciliation.
- Record context character/token estimates for diagnostics, while provider usage remains authoritative.

## Compatibility and Safety

- Every adapter declares a contract version and supported host/provider range.
- Unsupported versions enter visible degraded/read-only mode.
- Tool arguments are schema-bounded; no generic arbitrary shell field is introduced.
- Plugin tools do not become an alternate path around Dove approval or project/provider boundaries.
- Sensitive paths remain excluded from context, snapshots, and evidence by default.
- Network/cloud operations are explicit and independently approved.

## Rollback

- Disable an adapter without changing Core contracts.
- Disable a capability by lifecycle status while retaining ledger/evidence.
- Fall back to Pi-only and Trellis/lightweight provider operation.
