# The two layers, and the seam between them

- Sources: `research/harness-shape-and-prior-art.md`, `research/harness-resumption-and-self-check.md`,
  `research/ground-truth-what-runs.md`
- Date: 2026-09-26

The user's position is that **both layers have gaps to cover**. This file states what each layer does
cover, what each is missing, and where they are disjoint - which is the seam this task has to design.

## Layer A - the workflow layer (`.trellis/`), which runs

Covered, and established as running by its hooks firing on disk:

| | Capability | Evidence it is live |
|---|---|---|
| 1 | Taskification | `task.py create/start/archive`, task state on disk, this session's own task pointer |
| 5 | AI conventions | `spec/` (24 files), routed by an index with an enforced context budget |
| 8 | PRD planning | the `trellis-brainstorm` skill, and the artifacts it demands before `task.py start` |
| 2 | Context management | `get_context.py` + the `UserPromptSubmit` hook that injects workflow state |
| 6 | Session resumption | the journal, and `src/project-provider/continuation.ts` |
| 7 | Agents / subagents | `.trellis/agents/`, `.codex/agents/`, and the `SubagentStart` hook |
| 9 | Error recording | `trellis-break-loop` and `trellis-session-insight` |
| 3 | Acceptance criteria | the convergence check that reads acceptance criteria and refuses completion |

**But the resumption it provides is plan-level.** It answers "which task, and what step". It cannot answer
"did that effect already happen", and nothing in it is designed to.

## Layer B - the runtime layer (`src/core/`), which does not run

12 of 35 modules are unreachable from every entry point, and they are exactly the layers built by
`09-25` and `09-26`:

| | Capability | Module | Reachable |
|---|---|---|---|
| 4 | Entry gate | `gate-limit.ts`, `gate-conformance.ts` | no |
| 6 | Effect-level resumption | `effect-ledger.ts`, `checkpoint.ts` | no |
| 2 | Admission boundary | `context-admission.ts` | no |
| - | The loop itself | `loop.ts`, `loop-runner.ts` | no |
| - | Mode artefact | `work-mode.ts` | no |
| - | Authority | `authority.ts` | no |
| - | Capability scoping | `capability-scope.ts` | no |

What *does* run from that layer: the capability protocol and registry, the model gateway, request
planning and lifecycle, the execution ledger, the context compiler, the subagent provider, and
task-convergence. Those predate this work.

## The seam is not a boundary, it is a missing join

The two layers are **disjoint at the level that matters most**, and this is the finding that makes the
task concrete:

```text
Layer A resumption   plan-level      "which task / which step"        live
Layer B resumption   effect-level    "did this side effect already     unwired
                                      happen"
```

So the harness today can resume a task without losing its plan, and **cannot resume a run without risking
a repeated side effect**. For this project's intended verticals that is the wrong half to have: a repeated
audit scan costs time, a repeated order costs money.

## What the research says the minimum is

From `research/harness-resumption-and-self-check.md`, on a study of 25,930 episodes across 9 models and 3
harnesses: when a read-back cannot reveal the outcome, frontier models **duplicate in 56-74% of episodes**,
and "the contract explains 81%; the harness barely matters". Adding idempotency keys cut duplicates from
28% to 4%. The same study found agents **reported success in 90% of episodes in which they had duplicated
an effect.**

The minimum resumption state is (a) an append-only effect log keyed by a deterministic key handed to the
backend, (b) a claim/commit split where claimed-but-uncommitted **defaults to not retried**, and (c) a
mode-and-signature guard that **refuses** a mismatched resume. The transcript is not part of it.

**`src/core/effect-ledger.ts` and `checkpoint.ts` already encode exactly that** - claim in a shared
store, default not to retry, a graph signature that refuses a changed resume shape. They are simply not
reached.

## And the minimum for self-check

The same research, on what actually catches errors:

- **An execution oracle independent of the generator** - a compiler, tests, a verifier - plus a fixed
  schema or taxonomy and step-granular traces. **A second call to the same model on the same context is the
  weakest configuration**; Reflexion's own ablation on hard Rust is base 0.60, tests+reflection 0.68, and
  **reflection without tests 0.52 - below baseline**.
- Judge self-preference is structural, not incidental: it scales with the model's ability to recognise its
  own output.

So "self-check iteration" in the nine is only real when it is backed by an oracle the generator does not
control. That is a design constraint, not a preference.

## Caveats

- The research hit network limits: GitHub, raw.githubusercontent, developers.openai.com and Google SRE were
  unreachable from the sub-agent's sandbox, so framework claims are documentation- and measurement-backed
  rather than source-verified. Each file tags its claims.
- "Reachability" is a static import walk. It cannot see a dynamically constructed specifier. None was found.
- That a module is reachable does not mean it is correct; that it is unreachable does not mean it is
  worthless.
