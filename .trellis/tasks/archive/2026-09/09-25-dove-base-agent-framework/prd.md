# Dove Base Agent Framework

## Goal

Build one base agent framework whose workflow patterns and extension form can host
three domain verticals on the same runtime: quantitative trading, penetration
testing, and code auditing.

## Background

- The user's direction: a single base framework with verticals layered on top,
  rather than three independent agent products.
- The current repository (`dove-pi`) is a governance layer attached to Pi's harness
  loop. It owns policy, approval, capability dispatch, execution ledger, context
  compilation, and model-budget accounting, but it does **not** own the model to
  tool loop.
- The three target verticals share properties ordinary chat agents do not have:
  long-running execution, irreversible or high-consequence actions, tool-heavy
  verification, and a hard requirement for an auditable evidence trail.

## Requirements

- One domain-neutral base framework. Vertical behavior is added through an
  extension surface, not by branching core code.
- **The agent working mode must be reusable.** A vertical is packaged as a declarative,
  shareable work mode - scope, permitted actions, orchestration shape, tools, gates, evidence
  contract, stop conditions - that can be reused across tasks and across verticals instead of
  being re-implemented per project. The framework owns the runtime for a work mode; the work
  mode itself is data, not a change to core code.
- A work mode must be inspectable and versioned, so a reviewer can read what an agent is
  allowed to do before it runs.
- The framework must own its execution loop, or be able to, so that policy and
  approval gates can actually block an action instead of advising the model.
- Irreversible actions are gated and require explicit approval; the gate fails
  closed when a boundary cannot be represented.
- Every executed action produces a durable, replayable evidence record with
  correlated identities.
- Deterministic offline verification is possible: the same scripted provider
  reproduces a run without network access.
- Long-running work is resumable and bounded, with checkpointing instead of
  unbounded retry.
- The framework is host-neutral: the interactive front-end is replaceable without
  changing execution or governance semantics.
- Startup stays local-first and offline-first.
- Secrets and credential-bearing paths are excluded from model context, evidence,
  and logs by default.

## Open Questions (Phase 1.2 research)

1. Which agent workflow patterns are load-bearing for long-running, safety-gated,
   evidence-producing verticals, and which are cargo cult?
2. What form should the framework take (loop ownership, graph vs message loop,
   single vs multi-agent, code-first vs config-first, protocol interop), and where
   is the extension seam a vertical plugs into?
3. What do quantitative trading, penetration testing, and code auditing each
   require that a generic framework does not provide, and what is genuinely shared?

## Acceptance Criteria

Draft. To be finalized after research converges.

- [ ] One documented extension seam that all three verticals can use without
      modifying core.
- [ ] A gated irreversible action is blocked at the runtime boundary, and the block
      reason reaches the model transcript.
- [ ] A paired offline test runs the same scripted provider with and without the
      gate and asserts the action count changes accordingly.
- [ ] 100% of started executions have a terminal evidence record.
- [ ] A long-running task resumes from a checkpoint after interruption without
      re-executing completed side effects.
- [ ] The interactive front-end can be replaced without changing execution or
      governance behavior.

## Out of Scope

- Implementing the trading, penetration-testing, or code-audit verticals
  themselves.
- Building a hosted control plane, marketplace, or cloud gateway.
- Replacing the Pi TUI as an interactive surface in this task.

## Key Decisions

- The base framework is the deliverable; the three verticals are future consumers.

## Risks / Deferred Items

- Framework-form research may show the current Pi-harness coupling is too deep to
  keep: `src/pi-adapter/extension.ts` is 2735 lines and registers 30 host
  commands, so behavioral coupling is far larger than the 4-file import boundary.
- A previous research pass
  (`08-27-dove-interop-layer/research/base-selection-2026-09-25.md`) left the base
  choice undecided between keeping the Pi harness, adopting the `pi-agent-core`
  runtime layer, and rebuilding on a different host.
