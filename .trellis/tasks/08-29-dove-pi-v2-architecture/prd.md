# Dove-Pi Clean-slate V2 architecture

## Goal

Replace the current feature-validation-oriented Dove-Pi integration with a maintainable, host-independent Agent Runtime whose behavior is planned, budgeted, authorized, observable, and recoverable. Pi remains an interactive host adapter; it must not remain the place where lifecycle, prompt assembly, context selection, execution policy, and state coordination are mixed together.

## User value

- A normal conversational turn such as `hi` receives a complete response instead of being truncated by unrelated project/task context.
- The user can run development, Windows/PowerShell, and other authorized workflows through one predictable control surface.
- Context, tools, policies, approvals, model limits, and execution evidence are understandable and auditable.
- Pi can be upgraded or replaced without rewriting the runtime's core behavior.
- Failed or interrupted work can be diagnosed and recovered without guessing what the model saw or what actions ran.

## Confirmed facts and evidence

- `src/pi-adapter/extension.ts` is approximately 1,164 lines and currently combines Pi lifecycle hooks, command/tool registration, prompt assembly, context injection, thinking/model policy, project-provider access, status, progress, and execution coordination.
- `before_agent_start` is a single convergence point for unrelated responsibilities.
- Ordinary turns can receive the active Trellis PRD. `src/trellis-adapter/context.ts` marks active PRD content as required, while `src/core/context-compiler.ts` allows required documents to exceed the nominal `maxChars` budget.
- The configured model has a `12,800` token context window (`C:\Users\rebot\.pi\agent\models.json`). A real `hi` turn produced `input=14,010`, `output=102`, `stopReason=length`, and `rawStopReason=max_tokens`; a subsequent turn still ended with `stopReason=length`.
- Pi displays this provider outcome as `Response was truncated before completion.`
- `C:\Users\rebot\.pi\agent\settings.json` has `hideThinkingBlock: false`, so provider thinking can be exposed directly in the UI.
- The current automated suite has 111 passing tests but no end-to-end assertion over the final provider payload and its context/output-token budget.
- Existing prompt layers repeat trust-boundary, capability, task-confirmation, web, dispatch, and Trellis-policy text. The old Personal Agent OS PRD also repeats several of those policies and contains a malformed residual bullet.
- The user explicitly accepted a clean-slate V2: old internal APIs, prompt structure, and accidental behavior do not need to be preserved. Only data migration, security boundaries, approvals, rollback, and recoverability are retained as compatibility obligations.

## Architecture requirements

### R1. Runtime boundaries

Define a Dove Kernel that contains only host-independent contracts, state machines, and deterministic orchestration. It must not import Pi, Trellis, provider SDKs, or UI code.

Define replaceable boundaries for:

- Host/session events (Pi first; CLI/MCP/RPC later).
- Project/context providers (Trellis first, explicit lightweight fallback).
- Model/provider gateway.
- Execution runtime and platform capabilities.
- Approval and user-interaction surfaces.

### R2. Request planning

Every user turn becomes an immutable `RequestPlan` before prompt compilation. The plan records intent class, interaction level, required capabilities, context classes, approval requirements, mode/model snapshot, and cancellation/deadline policy.

Simple conversation, read-only lookup, project work, and execution work must be distinguishable by deterministic rules. A conversational turn must not create or load a task merely because an active task exists.

### R3. Prompt and context compilation

Prompt text is a compiled request artifact, never the source of truth for state or policy. Compile in explicit layers: invariant safety/policy, request-specific policy, structured context, tool/capability summaries, and user content.

The compiler must:

- Select context by request relevance and trust classification.
- Keep project content visibly bounded and labeled as untrusted data.
- Deduplicate policy and capability guidance so each rule has one authoritative source.
- Exclude active PRDs, Web policy, dispatch policy, background state, and unrelated tools from ordinary chat.
- Enforce a complete provider-payload budget, including input, reserved output, reasoning, tool schemas, and provider overhead, before sending.
- Produce a machine-readable segment manifest with token/character estimates, truncation decisions, and reasons.

Required content may not bypass the final budget check. If the request cannot fit safely, the runtime must compact, ask for clarification, or fail with a diagnostic rather than sending an over-window payload.

### R4. Tool and capability runtime

Capabilities have versioned schemas, preconditions, side-effect declarations, idempotency, approval class, timeout/retry behavior, verification status, and evidence format. The model proposes calls; the runtime validates and authorizes them before execution.

Execution must support cancellation, timeouts, checkpoints, structured results, evidence capture, and recovery of interrupted intents. Raw output, normalized output, summaries, and evidence remain separate.

### R5. State and observability

Maintain an append-only event/ledger model for request plans, compiled prompt manifests, provider calls, tool decisions, approvals, execution transitions, stop reasons, errors, retries, and recovery. Correlate Pi session IDs, project/task IDs, request IDs, execution IDs, and provider call IDs without conflating them.

The runtime must make it possible to replay the decision trail (not necessarily re-execute work) and to explain why context, tools, and policies were included or excluded.

### R6. Model gateway

Centralize model capability discovery, context-window accounting, thinking/reasoning settings, output reservation, provider payload construction, and stop-reason normalization. Provider-specific behavior must not leak into Kernel or prompt policy.

### R7. Pi-first integration

Pi is the primary Dove host. Pi-specific lifecycle handling, shortcuts, tool
profiles, streaming UX, status rendering, and host-version workarounds may stay
in a dedicated Pi integration layer and may be richer than a minimal adapter.
The boundary that must remain independent is the safety-critical runtime:
budget validation, approval decisions, capability execution, provider writes,
and recovery state cannot be implemented only as UI callback conventions.
Other hosts remain future adapters, but their existence must not force needless
abstraction or duplicate Pi behavior today.

## Migration and safety requirements

- Clean-slate internal rewrite is allowed; no promise is made to preserve old Dove command names, internal APIs, or prompt wording.
- Preserve and migrate only project data, task identity, approvals, security policy, rollback/recovery records, and execution evidence where technically meaningful.
- Provider/project mutations are intent-recorded and recoverable across crashes; no silent last-write-wins synchronization.
- Trellis files remain provider-owned. Dove reads normalized projections and routes mutations through a provider boundary.
- Secrets and credential-bearing files are excluded from snapshots, context, and evidence by default.
- Unsupported provider or host versions enter visible degraded/read-only mode rather than guessing.
- Startup remains offline-first; network checks and upgrades are explicit or cached.

## Out of scope for V2 MVP

- Reimplementing Trellis or copying its templates/hooks/CLI into Dove.
- A remote marketplace/control plane or multi-user coordination.
- A full capability catalog for every development, operations, or security task.
- Automatic promotion of conversation into permanent memory/spec/policy.
- Replay UI and automatic re-execution of historical work.
- Supporting every host adapter before the Pi adapter and Kernel contracts stabilize.

## Acceptance criteria

- [x] Kernel package builds and tests without importing Pi, Trellis, or provider modules.
- [x] Pi integration can start a runtime request and render runtime events while keeping safety-critical budget, approval, execution, and recovery decisions in shared runtime modules. Pi-specific UX/orchestration may remain specialized.
- [x] `hi` in a project with an active PRD does not load the PRD or unrelated policy/tools; the independent Model Gateway enforces context-window headroom before transport dispatch.
- [x] An over-budget request is rejected with a structured diagnostic; required segments cannot silently overflow the provider window.
- [x] Prompt compilation emits a segment manifest showing source, trust class, inclusion/exclusion, estimated tokens, and budget reason.
- [x] The same policy statement is not re-emitted in the request context snapshot when it already belongs to the stable system prompt.
- [x] Request plans distinguish ordinary chat, read-only project lookup, tracked project work, and execution work, including approval requirements.
- [x] Tool calls are schema-validated and policy-authorized before execution; denied, approved, cancelled, timed-out, retried, and recovered paths are recorded.
- [x] Event/ledger records correlate request, session, task, provider call, tool, and execution identifiers and preserve stop reasons and token accounting. (Provider-reported token billing remains intentionally out of scope.)
- [x] A simulated provider failure or process interruption can be reconciled from intent records without duplicating a non-idempotent side effect.
- [x] Existing Trellis project data can be read through a normalized provider interface, and project mutations do not write Trellis files directly from Kernel code.
- [x] Tests include an end-to-end final-payload budget gate, ordinary-chat isolation, prompt deduplication, approval boundaries, and recovery semantics.
- [x] Documentation explains the new boundaries and explicitly states that old internal APIs/prompt wording are not compatibility targets.

## Risks and deferred decisions

- Exact package layout and serialization format for `RequestPlan`, context graph, and event ledger are deferred to `design.md`.
- Token estimation differs by provider; the gateway must support provider-reported limits and conservative estimates before a tokenizer is available.
- A clean-slate rewrite increases short-term migration effort and may temporarily reduce feature breadth; vertical-slice delivery is required to keep risk bounded. Avoid abstracting Pi-only UX merely for hypothetical hosts.
- Trellis SDK versus CLI provider implementation remains an adapter-level choice; neither may leak into Kernel contracts.
- The first implementation should target Pi plus one local provider; additional hosts/providers are validated against the same contract tests later.

## Open questions

None blocking for planning. The latest user decision authorizes a clean-slate V2 direction; implementation still requires explicit approval of the final planning summary.
