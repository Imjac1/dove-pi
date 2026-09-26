# Dove Agent Harness Capabilities

## Goal

Build the scaffolding: the base agent harness that any vertical work (audit, quantitative trading,
penetration testing) runs inside. The verticals' eventual form is not decided and this task does not
decide it - what it establishes is the ground they will stand on.

The user named nine capabilities the harness must provide:

1. **Taskification** - turning a request into a tracked unit of work.
2. **Context management** - deciding what the model sees, and what it does not.
3. **Acceptance criteria** - what "done" means, checkable.
4. **An entry gate** - what may run, checked before it runs.
5. **AI conventions** - how the agent should behave in this repository, written down.
6. **Session resumption** - surviving a restart without losing state or repeating effects.
7. **Task-specific agents and subagent planning** - specialisation and delegation.
8. **PRD planning** - planning before building, on artifacts rather than in a conversation.
9. **Error recording and self-check iteration** - the harness getting better at its own failures.

## Confirmed facts (repository inspection, 2026-09-26)

**All nine already exist in this repository - in two different worlds.**

| Capability | `.trellis/` (the workflow layer) | `src/core/` (the framework) |
|---|---|---|
| 1 Taskification | `scripts/task.py` (32 KB) | none |
| 2 Context management | `get_context.py` | `context-compiler.ts`; `context-admission.ts` **unwired** |
| 3 Acceptance criteria | the convergence check | `task-convergence.ts` (41 KB) **unwired** |
| 4 Entry gate | `.codex/hooks/` | `gate-limit.ts`, `gate-conformance.ts` **unwired** |
| 5 AI conventions | `spec/` (24 files) | none |
| 6 Session resumption | `workspace/` journal | `checkpoint.ts` **unwired** |
| 7 Agents / subagents | `.trellis/agents/`, `.codex/agents/` | `subagent.ts` **unwired** |
| 8 PRD planning | `trellis-brainstorm` skill | none |
| 9 Error recording + self-check | `trellis-break-loop`, `trellis-session-insight` | none |

**Capabilities 2, 3, 4, 6 and 7 have an implementation in each world.** The `.trellis/` one is the one
that runs - it has driven every session in this project. The `src/core/` one is referenced only by its
own tests:

```text
Every constructor in src/core is referenced only inside its own defining file, and the Pi host
(src/pi-adapter/extension.ts) - the only thing that actually runs - calls none of them:

  loadWorkMode            not present
  evaluateAuthority       not present
  createConformanceGate   not present
  createLimitGate         not present
  createCapabilityScope   not present
  captureCheckpoint       not present
  admit(                  not present

The only chain that runs: Pi host -> createDoveRuntime() -> 14 capabilities.
```

**The `src/core` layer is a library with tests and no load-bearing connection.** That is the same
defect this project has spent eight review rounds finding inside one vertical - *a helper that exists but
is never called is not enforcement* - at the scale of the whole framework.

## Requirements

**R1.** The nine capabilities are provided by **one** implementation each, or it is stated why two exist.

**R2.** Whatever provides them is **load-bearing**: work that runs through the harness is actually
constrained by it, not merely described by it.

**R3.** The harness is **vertical-agnostic**. A new vertical is configuration, not a change to the
harness. The current state supports this: `src/core` executable code contains no vertical vocabulary
(no seed, catalog, vuln, exploit, notional, or sql), which is worth preserving.

**R4.** The harness is **researched before it is designed**. The user's instruction: find out how the
community and shipping projects actually do these nine, not how they say they do them.

## Reframing (user, 2026-09-26)

> **Trellis is pre-harness-era thinking about how to steer AI. What we are building now should be the
> synthesis of the current technical frontier.**

This changes what the nine capabilities are for. They are not the specification - they are **the questions
a pre-harness-era workflow layer asked**, and several of them (taskification, PRD planning, acceptance as
prose) are the shape those answers took when the loop, the session and the sandbox were not yet named
things. The frontier has since named them, and has produced answers the nine do not contain at all:
context isolation rather than context injection, execution oracles rather than self-critique, effect
contracts rather than transcripts, and a durable session that outlives the loop.

So the work is **not** to make Trellis better, and **not** to wire `src/core` to Trellis. It is to work out
what the frontier's synthesis is for this project, using Trellis as **prior art** - valuable because it is
what this project already ran on, and because its gaps show what the frontier fixed.

The nine remain a checklist to answer, not a specification to satisfy.

## Key decisions

- **Both layers are in scope, and both have gaps.** Decided by the user: "两个层其实都有要覆盖的地方".
  The workflow layer (`.trellis/`) and the runtime layer (`src/core/`) are not alternatives to choose
  between; each covers part of the nine and each is missing part.
- **The workflow layer is the one that runs.** Established by evidence: its hooks are registered and their
  effects are on disk (see `research/ground-truth-what-runs.md`). The runtime layer's contracts are
  unreachable from every entry point - 12 of 35 modules in `src/core`, and they are exactly the layers
  designed by `09-25` and `09-26`.

## What the research already establishes

From `research/harness-shape-and-prior-art.md`, and it constrains the design rather than settling it:

- **No surveyed project provides all nine.** Runtime harnesses (Managed Agents, Claude Agent SDK, OpenAI
  Agents SDK, ADK, LangGraph) own context management, the tool-call boundary, resumption and delegation,
  and carry conventions as always-on context. Spec-driven toolkits (Kiro, spec-kit, BMAD, OpenSpec,
  agent-os) own taskification, acceptance, conventions and planning **declaratively** and are not running
  harnesses at all. **The nine are a workflow-layer rubric, not a runtime one.**
- **Stable seams**, present in every serious project: a durable append-only session that outlives the
  loop; an explicit loop owner; a pre-execution tool-call boundary; a declarative worker/capability
  artefact; a pluggable persistence interface; an extension seam distinct from tools; an outbound event
  stream.
- **What must not be standardised**: spec and workflow artefact sets, orchestration topology, gate
  semantics, what "done" means, agent field names, the persistence backend. The projects disagree because
  these are genuinely contested.
- **Anthropic's session/harness/sandbox split is the only architecture surveyed that was designed to
  outlast its own implementation** - "opinionated about the shape of these interfaces, not what runs
  behind them" - and it names the failure it fixed: a coupled single container became a pet, so a
  container failure lost the session.

**Caveat on that research**: the web tool failed mid-task (rate limit), so roughly half its sources are
search snippets or this repository's prior survey rather than pages the agent opened. It tags each claim
`[FETCHED]/[SNIPPET]/[PRIOR]/[DISK]/[INFERENCE]`; read the tags.

## The decision: make the contracts load-bearing

Chosen by the user, from three options. The rejected ones were: treat the contracts as a specification and
go build verticals; and replace the host with our own loop.

**The choice is: the host really loads the mode, every action passes the gate, capabilities are scoped, and
tool output passes an admission boundary.** "Done" means a configuration change swaps the mode and a gate
visibly stops an out-of-scope action - not that a test asserts a module exists.

## What that commits us to, from the research

The research was completed before the design, as the user required. Its constraints are in
`research/design-constraints-from-evidence.md` (C1-C7) and the decisive findings are in
`research/*.md`. Five of them are decisions rather than inputs:

1. **The harness cannot provide exactly-once.** It provides **at-most-once dispatch from its own resumption
   paths**, plus an idempotency key the tool must forward and the backend must enforce. The repository
   currently describes the ledger as an exactly-once primitive and this must stop.
2. **The effect ledger goes at the tool-dispatch line** - `src/core/loop-runner.ts:135`, the only place a
   tool runs - **and never at an approval boundary.** An approval gate re-executes whatever sits before it.
3. **The gate's coverage is not the tool call.** Every published bypass went around the harness's own
   subprocesses. A tool-call gate is necessary and insufficient.
4. **There are three implementations of one admission contract** - DSH (the running host), the unwired
   `src/core/context-admission.ts`, and `.trellis/`'s injection. One must own it; the others must delegate
   or be deleted.
5. **The live gate is fail-closed and semantically empty.** It can answer "is this capability read-only?"
   and nothing else, while the modules that can answer the real questions are unwired. The seam already
   receives the arguments.

## Acceptance criteria

- **AC1** The mode is loaded by the host, not by a test: changing `modes/<name>/` changes what the running
  agent may do, observed through the host.
- **AC2** A gate stops an action the authority document does not cover, **and the refusal is recorded** -
  observed end to end, not in a unit test.
- **AC3** An effect that reaches its dispatch point twice **within one process and across two** does not
  reach the tool twice; the second attempt is refused and reported.
- **AC4** Tool output above the admission threshold reaches the model as a digest plus a resolvable
  reference, and the full payload is retrievable.
- **AC5** Every claim the harness makes about its own guarantee is **true as stated**. Concretely: it does
  not claim exactly-once, its gate documentation matches its coverage, and no code comment cites a
  precedent that does not exist.
- **AC6** A run that does not finish stops with a **typed reason**, and the reason is visible to the
  operator.
- **AC7** One implementation owns each of the admission, effect-identity and acceptance contracts; the
  others delegate or are removed.
- **AC8** `npm run typecheck` is clean and `npm test` is green, and every module the harness relies on is
  **reachable from an entry point** - enforced by a test, because reachability is the defect that started
  this task.

## Open questions

None. The remaining decisions were made above or are recorded as design choices in `design.md`.

## Out of scope

- Deciding the verticals' form. The user stated it is undecided; this task builds the ground, not the
  buildings.
- Reimplementing what `.trellis/` does without a stated reason.

## Risks

- **Two implementations of one contract** is the failure mode this project keeps producing. Building a
  third layer over both would produce it again, at the largest scale yet.
- Nine capabilities is a large surface. Researching all nine thoroughly before designing any of them is
  deliberate: the user asked for research first, and the nine interact (context management constrains
  subagent planning; acceptance criteria constrain the gate).