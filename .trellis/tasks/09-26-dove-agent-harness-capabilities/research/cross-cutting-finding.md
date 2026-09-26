# The cross-cutting finding

- Date: 2026-09-26
- Basis: five research files, written independently by agents that did not see each other's work, plus the
  reachability analysis in `ground-truth-what-runs.md`

## The finding

**Five research agents, each given a different topic, each independently concluded that one of this
repository's *unwired* modules is the best or the only implementation they found.**

| Agent's topic | Its own conclusion | The module | Wired |
|---|---|---|---|
| agents and delegation | "this repo **already has the best one**" - `dispatch-policy.ts` decides inline / subagent / parallel on shared mutable state, wall-time floors, cost ratio and independent-branch count | `dispatch-policy.ts` | no |
| agents and delegation | "`effect-ledger.ts` is **the missing piece no external project has**" - nobody implements cross-sibling effect de-duplication | `effect-ledger.ts` | no |
| taskification and acceptance | "**the best-specified acceptance model in the whole survey**" - an event-sourced reducer that computes the terminal state and detects scope drift via a hashed `acceptanceRevision` | `task-convergence.ts` | no |
| resumption and self-check | the frontier duplicates effects in **56-74%** of episodes when a read-back cannot reveal the outcome, and the minimum contract needs an idempotency key and a **refusal** on a changed resume shape | `effect-ledger.ts`, `checkpoint.ts` | no |
| harness shape | the admission boundary's "**no parameter that turns it off**"; the frontier's equivalent is prose | `context-admission.ts` | no |

This is not a coincidence and it is not flattery. The modules were written by agents given the task *"work
out what the right shape is, then write it"*, with the frontier's papers cited in the docstrings - and one
of the two arXiv identifiers they cite was independently fetched and confirmed real and accurately quoted.
They were then **left unreachable by the wiring step nobody did.**

Meanwhile the layer that runs has, for several of the same capabilities, the pre-harness shape: context
**injection** with a budget rather than **admission** with a boundary; **plan-level** resumption rather than
effect-level; conventions that are enforced but gates that are not.

## The sharpest single sentence in the research

From the taskification survey:

> The smallest artifact set that keeps planning honest is (a) requirements with stable IDs, (b) per-criterion
> acceptance with at least one observable, (c) tasks that reference those IDs, (d) a machine-readable state
> file, and (e) **one checker that can say no**. Without (e), (a)-(d) are prose.

`.trellis/` has (a)-(d). `src/core/` has (e) in six places and is unwired. **Neither layer has the whole
set**, and the missing half in the layer that runs is exactly the half that makes the other four real.

## And the thing that should temper the finding

The same research carries the negative evidence, and it is not weak:

- **Cognition, "Don't Build Multi-Agents"** (Walden Yan, 2025-06-12): split tasks are "very fragile"; rule
  out architectures that do not share context; recommends a single-threaded agent with a dedicated
  compression model.
- **MAST** (arXiv:2503.13657, Cemri et al.), 1600+ traces, 7 frameworks, kappa 0.88: multi-agent
  "performance gains are often minimal", and one of its three failure categories is **task verification -
  the orchestrator cannot verify what it did not do**.
- **Anthropic's own positive number is internal and cost-heavy**: +90.2% on an internal breadth-first
  research evaluation, but **15x the tokens** of chat, and "not a good fit" for coding tasks with shared
  context and dependencies.

So the finding above is about **written work that is not running**, not about a design that has been shown
to work. Wiring `dispatch-policy.ts`, `effect-ledger.ts` and `task-convergence.ts` would put this project
ahead of the surveyed field on delegation policy, effect de-duplication and acceptance - **and none of that
is evidence that the result will perform better.** It is evidence that the modules are the right shape,
which is a weaker and different claim.

## A local gap this establishes directly

`.trellis/agents/*.md` carry **no tool list**. The git-commit bans live in the prose body - a request the
model may follow or not. `.codex/agents/*.toml` carry `sandbox_mode = "workspace-write"`, which is
host-enforced, but their recursion guard is likewise prompt text. **Both surfaces already exist; only one is
machine-checked.** That is the smallest available demonstration of the difference between a harness and a
convention, and it is inside this repository already.
