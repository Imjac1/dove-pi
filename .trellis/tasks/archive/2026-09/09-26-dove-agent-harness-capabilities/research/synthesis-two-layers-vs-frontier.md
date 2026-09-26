# Synthesis: what each layer has, and what the frontier says it should have

- Date: 2026-09-26
- Basis: repository reading (all file:line claims below are from files read this session) plus
  `research/harness-resumption-and-self-check.md` and `research/ground-truth-what-runs.md`

## The finding that reframes the task

**The unwired layer is not a half-built framework. It is an implementation of the frontier pattern, and
the layer that runs is the pre-harness one.** That inverts the naive reading of "12 modules unreachable".

## Capability by capability

### Context: injection versus admission

**Live** - `src/core/context-compiler.ts` (202 lines, reachable). A budget-based assembler:
`ContextDocument` / `ContextItem` / `CompiledContext`, with "Required documents that could not fit the
supplied budget" as a reported outcome and per-document inclusion decisions kept "for diagnostics/replay".
It also hardens source labels: "file names are project-controlled input. Keep control characters and
bracket delimiters from forging context markers" - an anti-injection measure, in the live layer, already.

**Unwired** - `src/core/context-admission.ts` (139 lines). A boundary every channel crosses:
`"tool_result" | "extension_message" | "background_notification"`. Above 8000 characters content is
compacted and only ~1200 of head survives "for orientation"; `isNonActionablePath` classifies generated
and vendored material; the payload goes to an `ArtifactSink` the caller supplies so it never enters the
transcript. And the design states its own enforcement: **"Every channel goes through here. There is no
parameter that turns it off, because the recorded..."**

**Why this matters**: injection decides *what documents to include*. Admission decides *what is allowed to
be model-visible at all*, with no off switch. The frontier's answer to context is isolation and admission;
this repository has the admission boundary written and does not call it.

### Resumption: plan-level versus effect-level

**Live** - `src/project-provider/continuation.ts` (73 lines), and the journal. It answers "which task,
which step". It cannot answer "did that effect already happen", and nothing in it is designed to.

**Unwired** - `src/core/checkpoint.ts` (140 lines) and `src/core/effect-ledger.ts` (259 lines). The
checkpoint docstring states the unit precisely: **"an effect that was admitted and completed, not a model
turn. A turn is a..."**. `computeGraphSignature` is "A stable hash of the orchestration shape. Sorted so
tool registration order cannot change it." `restoreCheckpoint` returns a result that is **"refusals
rather than warnings. Resuming a checkpoint whose graph has changed means..."**. The ledger describes
itself as "the exactly-once primitive" with "Two things here that are deliberately not the obvious
implementation".

**Convergence with the research, derived independently**: the research agent's minimum was (a) an
append-only effect log keyed by a deterministic key handed to the backend, (b) a claim/commit split where
claimed-but-uncommitted **defaults to not retried**, (c) a mode-and-signature guard that **refuses** a
mismatched resume. These files encode that shape, including the refusal semantics. The same research found
frontier models duplicate effects in 56-74% of episodes when a read-back cannot reveal the outcome, and
that agents **reported success in 90% of episodes where they had duplicated an effect** - which is the
argument for (c) being a refusal and not a warning.

### Conventions: live and working

`spec/` is read, routed by an index, and has an enforced size budget checked by a test. This is the
capability the live layer does best, and the frontier's equivalent (AGENTS.md and friends) has not caught
up on enforcement - most projects state conventions and never check them.

### Acceptance: partly live

`src/core/task-convergence.ts` is reachable from the host, so acceptance is consulted. Whether its
criteria are *observable* rather than prose is not established and is a design question for the next step.

### The gate, the loop, the mode artefact, authority and scoping: unwired

`gate-limit.ts`, `gate-conformance.ts`, `loop.ts`, `loop-runner.ts`, `work-mode.ts`,
`authority.ts`, `capability-scope.ts`. Three of these have a design that the research supports: a gate
that cannot be evaluated should **fail closed or ask**, never fail open, and the tool-call boundary must sit
where no action can route around it. `context-admission.ts`'s "no parameter that turns it off" is the same
instinct applied to content.

### Self-check: the one capability with no implementation in either layer

Nothing in the repository verifies agent output with a mechanism independent of the agent. The research is
unambiguous that this is the only configuration that works: an execution oracle the generator does not
control, plus a fixed schema and step-granular traces. Reflexion's own ablation puts reflection **without**
an execution signal below baseline on hard Rust, and judge self-preference is structural. So this is
genuinely new work rather than wiring, and it is the one item on the nine where the frontier has an answer
this repository has not attempted at all.

## What this implies for the plan

1. **Wiring is the larger half, not building.** Admission, effect-level resumption and the refusal guards
   exist and match the frontier pattern. The work is to put them on the path that runs.
2. **The live layer's injection model is not wrong, it is incomplete.** A budget assembler and an admission
   boundary are complementary; the frontier uses both.
3. **Self-check has no prior art in this repository** and needs design, not wiring. It also needs an oracle,
   which means it is partly a per-vertical question.
4. **The seam between the layers is resumption.** Plan-level (live) and effect-level (unwired) are disjoint,
   and the frontier says the effect-level one is the one that must not be missing when an effect costs
   something. For this project's intended verticals, a repeated order costs money.

## What is not established

- Whether the unwired modules are **correct**. They are read, not executed. Their tests pass, which is
  weaker evidence than it sounds: this project has already found a module whose tests passed while the
  behaviour they described was unreachable.
- Whether the frontier's answers in `research/` survive scrutiny - the research hit network limits and
  tags each claim by how it was obtained.
- Whether `task-convergence.ts`'s acceptance criteria are observable. Not read in detail this session.
