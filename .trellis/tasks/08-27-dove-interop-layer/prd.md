# Dove Interoperability Layer

## Goal

Make Dove Pi a provider-neutral local execution and governance layer for Pi, Claude Code, Codex, and Hermes.

## Background

Current mainstream agents already provide Windows support, skills, memories, subagents, cloud execution, and plugins.
Dove should not compete by copying those surfaces. Its differentiator is a portable local execution contract with
policy, approvals, evidence, and durable project context that multiple hosts can call.

## Requirements

- Keep Dove Core independent from Pi, Trellis, Claude Code, Codex, and Hermes APIs.
- Define a versioned Capability Protocol for parameters, preconditions, side effects, idempotency, verification,
  evidence, and lifecycle status.
- Expose the same reviewed capability through the Pi adapter first, then MCP/CLI/RPC adapters without duplicating
  execution logic.
- Preserve Trellis as an optional project provider and support interoperable project instructions from `AGENTS.md`,
  `CLAUDE.md`, Agent Skills, and MCP resources through one normalized context interface.
- Use progressive disclosure: indexes and concise summaries first; full skills, specs, and logs only on explicit
  intent or targeted retrieval.
- Keep local Windows/PowerShell execution, approval policy, secret exclusions, rollback, and evidence as Dove-owned
  responsibilities.
- Correlate host session IDs, provider task IDs, and Dove execution IDs without conflating them.
- Make provider and adapter health, compatibility, and degraded/read-only states observable.
- Keep startup local-first and offline-first; network/cloud integrations are explicit adapters, not hidden dependencies.

## Acceptance Criteria

- [x] A reviewed capability can be invoked through Pi and returns the same structured result and evidence record as
      its direct Core invocation.
- [x] The Capability Protocol has a semver contract, schema validation, and fixtures for success, failure, timeout,
      cancellation, approval denial, and unsupported platform cases.
- [x] A minimal MCP adapter exposes capability discovery and execution without importing Pi or Trellis into Core.
- [x] A CLI/RPC adapter can execute the same capability with bounded arguments and the same ledger correlation IDs.
- [x] A project with Trellis, `AGENTS.md`, `CLAUDE.md`, or Agent Skills produces one normalized context projection;
      duplicate authorities are reported instead of silently merged.
- [x] Ordinary turns load only an index/current-task summary; explicit workflow, spec, or memory requests load
      relevance-ranked excerpts and report estimated context size.
- [x] 100% of started executions have a terminal ledger record, and evidence excludes secret-bearing paths by default.
- [x] Adapter doctor reports host/provider incompatibility without preventing lightweight read-only startup.
- [x] The first interoperability smoke matrix covers Pi plus at least one external-host adapter fixture; no product
      claim depends on a live vendor account.

## Acceptance Evidence

- `tests/interop-smoke-matrix.test.ts` runs `workspace.inspect` through Direct
  Core, CLI/JSON-RPC, official MCP in-memory transport, and Pi's registered tool,
  then compares protocol version, capability identity, terminal status,
  evidence projection, and correlation IDs.
- `tests/capability-protocol.test.ts` validates the semver/schema fixtures,
  terminal outcomes, ledger reconciliation, trusted approval boundary, and
  default evidence-reference filtering.
- `tests/local-rpc.test.ts` proves RPC method/argument bounds, shared ledger
  correlation, and denial of payload-forged approval. `tests/mcp-adapter.test.ts`
  proves discovery/context/invocation over the official SDK and confirms MCP
  does not expose an approval field.
- `tests/interoperable-context.test.ts`, context compiler tests, and project
  provider tests cover separately labeled authorities, explicit conflict
  diagnostics, index-first disclosure, targeted excerpts, estimates, and
  lightweight/degraded startup. Doctor output reports protocol/adapter, plugin,
  provider, and context-authority health without using a vendor account.

## Out of Scope

- Reimplementing Claude Code, Codex, Hermes, or Trellis internals.
- Building a new cloud control plane, hosted gateway, or marketplace in this task.
- Automatic bidirectional synchronization or semantic merging of arbitrary Markdown.
- Automatically promoting every conversation into permanent memory or tasks.
- Replacing the Pi TUI or adding a second full chat interface.

## Key Decisions

- Dove is the execution/governance layer; hosts are adapters and Trellis is one project provider.
- Pi is the first reference host because it is already integrated and provides a stable extension boundary.
- Interoperability follows open formats where practical: Agent Skills, MCP, `AGENTS.md`, and `CLAUDE.md`.
- Capability reuse and evidence consistency take priority over a larger tool count.

## Risks / Deferred Items

- Vendor adapters may change quickly; keep them thin and version-gated.
- External hosts may have different permission models; Dove must fail closed when a boundary cannot be represented.
- Live cloud integrations are deferred until the local protocol and replay-ready ledger are stable.
- A future protocol revision must decide one serialized/depth budget for nested Direct/MCP arguments instead of relying
  only on property-count and transport-line limits.
- External adapter responses need an explicit inline-versus-artifact envelope before large capability results can be
  exposed safely; `result`, `error`, and evidence-reference totals are not globally capped in protocol `1.0.0`.
- MCP `ultra` context needs a host-supplied window/budget contract before it can promise the same final provider gate as
  Pi. Hard timeouts for non-cooperative executors require process/worker isolation beyond `AbortSignal` cancellation.
