# Correction: which layer actually has a gate

- Date: 2026-09-26
- Corrects: the table in this task's PRD, and an earlier claim made to the user in conversation

## What I claimed, and why it was wrong

I told the user that `.codex/hooks/` was the live implementation of capability 4, the entry gate. **It is
not a gate.** `research/harness-taskification-and-acceptance.md` checked: the two registered hooks -
`UserPromptSubmit` -> `inject-workflow-state.py` and `SubagentStart` -> `inject-subagent-context.py` -
**only inject context**. Nothing under `.codex/hooks` denies a tool call. On this platform the planning
gate is a breadcrumb in the prompt plus `task.py`'s exit codes; the model can proceed regardless.

The same file corrects capability 3. Trellis **documents** "complex tasks need design.md and implement.md
before start" and **does not enforce it**: a grep of `.trellis/scripts` for `design.md`/`implement.md`/`complex`
returns a docstring (`task_store.py:321`) and a stderr "Next steps" line (`task_store.py:688`). The only hard
prerequisite on `task.py start` is the jsonl manifest gate (`task.py:196-217`).

## The corrected table

| # | Capability | Live layer | Runtime layer |
|---|---|---|---|
| 1 | Taskification | **real** - `task.py`, state on disk, atomic writes | - |
| 2 | Context management | **partial** - injection with a budget | admission boundary, unwired |
| 3 | Acceptance criteria | **documented, not enforced** | `task-convergence.ts` computes it, unwired |
| 4 | Entry gate | **absent** - hooks inject, they do not deny | two gate semantics, unwired |
| 5 | AI conventions | **real** - routed, budgeted, tested | - |
| 6 | Session resumption | **plan-level only** | effect-level, unwired |
| 7 | Agents / subagents | **real** - definitions plus a `SubagentStart` hook | - |
| 8 | PRD planning | **real** - the skill and its artifacts | - |
| 9 | Error recording + self-check | **recording** (break-loop, session-insight) | **nothing, in either layer** |

So the live layer has **six** of the nine, not seven, and two of those six are partial. The runtime layer
has **six** of them written and **none** wired. Self-check is the one capability **no layer has attempted**.

## The criterion the research produced, which is better than either table

> The smallest artifact set that keeps planning honest is (a) requirements with stable IDs, (b) per-criterion
> acceptance with at least one observable, (c) tasks that reference those IDs, (d) a machine-readable state
> file, and (e) **one checker that can say no**. Without (e), (a)-(d) are prose.

`.trellis/` has (a)-(d) plus a manifest gate. `src/core/` has (e) and is unwired. **Neither layer has the
whole set, and the missing piece in the live layer is (e).**

## And nobody enforces approval

Across the survey, artifact-**existence** gates get coded (Spec Kit's `check-prerequisites.sh` hard-`exit 1`,
OpenSpec's validator, Trellis's manifest gate) and artifact-**quality** gates stay as prompt text. Kiro's
per-phase approval gate is documented only - the product is closed source, and its own docs say Quick Spec
runs all three phases "without approval gates". **No project in the survey enforces PRD approval in code.**
Human gates are always "proceed anyway?" consent, never "is this true?".

That matters for this project directly: the eight review rounds recorded in `09-26-dove-code-audit-vertical`
were **self-policing**. There was no mechanism; there was an instruction and a cooperative agent. The
artifacts from those rounds are real, but their guarantee is not - it rests on the model choosing to comply.

## What this does not establish

- That `task-convergence.ts` is correct. It is the best-specified acceptance model in the survey, and it is
  unexecuted. The research found one concrete hole: `acceptance.passed` takes **optional** evidence refs, so
  a pass need not be backed by anything.
- That no gate is possible on this host. What is established is that the hooks registered today do not deny.
  Whether the host offers a pre-tool-call denial hook is a separate question, and it is open.
