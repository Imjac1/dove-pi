# Personal Agent Improvement Run

## 1. What this page is, and what it is not

**This page is the second thread of the product face.** The first thread is a person using the agent - what they
install, what they see, what is promised - and it lives in
[`personal-agent-product.md`](./personal-agent-product.md) and [`personal-agent-usage.md`](./personal-agent-usage.md).
**This page is the other side**: one improvement round, from the seat of the operator who supplies the conditions,
reads the record, and makes the decision.

**The steps are written once, elsewhere.** One round, step by step, with its scripts and its three record operations,
is [`personal-agent-harness-loop.md`](./personal-agent-harness-loop.md) §4. This page links to it and does not tell it
again: a second telling would be a second source of truth, and that page is out of room besides.

**Marks**: `[demonstrated]` a reading or a test points at it; `[not yet demonstrated]` a reading exists that shows it
has not been shown; `[unverified]` no instrument exists. Every claim carries an anchor.

**What no door checks here**: whether this page has restated a step it was supposed to link to. The doors hold this
page's shape and its paths; the rest is a reader's.

## 2. What was asked for: three requirements, and the object this is meant to become

The three requirements this line of work answers were recorded before any of it was designed, in a table whose own
heading asked the person to check them first - [demonstrated] `.trellis/tasks/09-30-axi-program/plan.md` §0.1
(`.trellis/tasks/09-30-axi-program/plan.md:41-50`).

| What was asked for | How it was understood |
|---|---|
| The thinking a file-based development framework had, before harnesses had a name for it | **Carry the discipline in files**: tasks, specifications, sessions and evidence land on disk, and state and contract are artifacts a reader can open. In the frontier's own words: *"the developer's 'program' is a natural-language task plus **a tree of Markdown files** … The 'API' is the filesystem, the terminal, and git."* - `.trellis/tasks/09-30-axi-program/plan.md:45` |
| Be the synthesis of the technical frontier | Not stacking primitives but **choosing which layer owns what**; standing on a source-level dissection of eleven production harnesses rather than inventing from zero - `.trellis/tasks/09-30-axi-program/plan.md:46` |
| A design for recursive self-improvement | Let the system improve its own harness. Deliverable by the community's three-level test is **level 2, bounded self-improvement** - `.trellis/tasks/09-30-axi-program/plan.md:47` |

**The object this is meant to become**, in the record's own sentence: a harness **that improves itself from its own
evidence inside a boundary it cannot write**, *and is made into something that can be studied for a long time* -
[demonstrated] `.trellis/tasks/09-30-axi-program/plan.md:49`.

**The two threads share one set of artifacts**, which is why the first requirement above is the bridge between them:
the same tasks, specifications, sessions and evidence are what the person's work leaves behind and what the round
mines. **The filesystem is the API on both sides** - [demonstrated] `.trellis/tasks/09-30-axi-program/plan.md:45`, and the surfaces a round may touch
are declared in `.trellis/harness-surface.yaml`.

**The opening the record sees**: of the seven subsystems a production harness is made of, every one has a spectrum
from minimal to maximal implementation, and the **only one with no existing implementation is governed
self-modification** - [demonstrated] `.trellis/tasks/09-30-axi-program/plan.md:99`.

## 3. Where this sits among the terms: what may move, and what must not

The community test that this page's tier claim rests on is decidable by one question: **after the run, which layer is
still standing** - [demonstrated] `.trellis/tasks/09-30-axi-program/plan.md:54-60`.

| Level | What moves | What stays fixed |
|---|---|---|
| Iteration | the output | the system and the verifier |
| **Self-improvement** | the system - tools, skills, compaction policy | **the verifier** - the ruler that says "better" does not move |
| Recursive self-improvement | the system **and** the verifier | nothing the system cannot reach |

**This project delivers level 2, and the name matters**: calling it recursive self-improvement would be a claim with
no public evidence behind it - [demonstrated] `.trellis/tasks/09-30-axi-program/plan.md:67`. The four operational terms the same source offers are used
here in preference to the loose ones - [demonstrated] `.trellis/tasks/09-30-axi-program/plan.md:71-81`:

| Term | Definition |
|---|---|
| Self-refinement | improves the current **output**; the system itself does not durably change |
| **Persistent self-improvement** | a change to weights, memory, skills, prompts, the harness or code **carries into the next round** |
| **Recursive self-improvement** | **the mechanism that produces improvement** becomes the object being improved |
| RSI substrate | exposes the agent's own structure as modifiable, without by itself constituting an improvement loop |

**Where this sits**: a **substrate plus a persistent self-improvement loop**. It reaches the third tier only when the
mechanism producing improvement is itself the object - and that is a research question here, **not a deliverable** -
[demonstrated] `.trellis/tasks/09-30-axi-program/plan.md:81`.

## 4. The three planes, and the one relationship that bounds them

| Plane | What it is | Writable by the improver |
|---|---|---|
| **A** | **this repository**: the seven components at fixed mount points, declared in `.trellis/harness-surface.yaml`; apply is one commit, revert is a revert of that commit | **yes** |
| **B** | the held-out task split, the read-only verifier tree with its runs directory and model config, the promotion gate, and the human keep-or-revert | **no** |
| **C** | the loop that runs a round and produces the record | it is the loop, not a surface |

**The relationship that makes it bounded**: the improver's power is exactly **Plane A minus Plane B** -
[demonstrated] `.trellis/tasks/09-30-substrate-choice/framework.md:112-116`. Plane A is where recursion is allowed,
including edits to the **inner** instruments. Plane B decides whether those edits were improvements, and it is not
Plane A's to write.

**What that fixes about the ambition**: the **inner** verifier may rise with the system, which is what a recursive
loop needs; the **outer** evaluator may not. A loop that raises both is bounded by nothing, and that is the axis this
project declines - [demonstrated] `.trellis/tasks/09-30-substrate-choice/framework.md:118-120`.

## 5. What the operator supplies, reads, and decides

| The operator | Content | Anchor |
|---|---|---|
| **Supplies** | the work mode, the authority document, and the approval on a privilege-boundary change | [demonstrated] [`personal-agent-use-time-architecture.md`](./personal-agent-use-time-architecture.md) §5 |
| **Reads** | the round print out of the records, and the ledger it was mined from | [demonstrated] [`personal-agent-harness-loop.md`](./personal-agent-harness-loop.md) §4 closes on the printed turn; the ledger's shape is that page's §3 |
| **Decides** | keep or revert, **as a person with that output in front of them** - nothing in the loop acts on its own | [demonstrated] [`personal-agent-harness-loop.md`](./personal-agent-harness-loop.md) §4, and §1: every contract there **reports** |

**Two consequences worth stating plainly.** First, the loop's judgement is not a gate: the record reports and the
person decides, which is the same rule the formal-task convergence contract uses. Second, **an edit to the verifier
is not a loop turn** - it is judged by its suites and by a person - so the operator is also the one who decides when
a round has left the loop's own subject - [demonstrated]
[`personal-agent-harness-loop.md`](./personal-agent-harness-loop.md) §3, §5.

## 6. The instruments that exist, and the three that do not

**The instruments are written where they are used**, not here: the failure reading, the change manifest and its
next-round verdict, the application bound to a commit, the declared editable surface, and the axis reading are
[`personal-agent-harness-loop.md`](./personal-agent-harness-loop.md) §3. This page adds only what does not exist.

| Missing instrument | Why it matters | Anchor |
|---|---|---|
| A **file-level** harness/verifier split | `tool-implementation` is bound to all of `src`, which holds both, so *"is this edit a verifier change?" is a reader judgement today*; the controllability argument assumes the split exists by path | [demonstrated] `personal-agent-harness-loop.md:33-36` |
| **Pareto preservation**, declared uncomputable | *no ledger record carries a second measured objective*, so one of the axis's three metrics is not read | [demonstrated] `.trellis/tasks/09-30-substrate-choice/framework.md:128-132` |
| **"Sandbox violations" read from an actual boundary denial** | today the number is read from **this repository's own gate refusals**, which counts Dove's decisions, not the boundary holding | [demonstrated] `.trellis/tasks/09-30-substrate-choice/framework.md:133-134` |

## 7. Experiment 0, and what it decides

The whole force of Plane B rests on one behaviour that has not been verified: whether a restricted session **really
denies a write outside the workspace root** - [demonstrated] `.trellis/tasks/09-30-substrate-choice/framework.md:168`.

| # | Acceptance criterion |
|---|---|
| 1 | Under `workspace-write`, a write to a path outside the workspace root is **denied** |
| 2 | Under the same mode, a write inside the root **succeeds** - a policy that refuses everything is broken, not safe |
| 3 | After a denial the session **still completes a turn** - a denial must not kill the loop |

**What failure means**: `Plane B` as an **enforced** boundary does not exist in this install, and the framework
degrades to the position this repository already holds - **a person is the fixed point and the boundary is
discipline** - [demonstrated] `.trellis/tasks/09-30-substrate-choice/framework.md:176-178`. That is a finding, not a failure, and it is recorded as one.

## 8. The cost, stated before anyone builds it

**The scale the literature needed**: AHE read a precision and recall of about eleven percent from **89 tasks across
9 rounds**; RSI-Bench's most recent improvement process is around **50 decisions** where the measurement option needs
about **400** - [demonstrated] `.trellis/tasks/09-30-axi-a5-eval/prd.md`.

**One task's run is not a benchmark** - [demonstrated] `personal-agent-convergence-record.md:127-130`. The source that
proposes this framework says the same thing in its own words: *this is the framework's real cost, and it should be
stated before anyone builds it* - `.trellis/tasks/09-30-substrate-choice/framework.md:190`.

## 9. What would falsify this

- **Experiment 0 fails** → Plane B is not enforceable here - [demonstrated] `.trellis/tasks/09-30-substrate-choice/framework.md:188`.
- **A file-level harness/verifier split proves impossible** without splitting the record module → the boundary stays
  a declaration - [demonstrated] `.trellis/tasks/09-30-substrate-choice/framework.md:189`.
- **The held-out split proves unmeasurable at this project's scale** → the loop has no ruler it does not control -
  [demonstrated] `.trellis/tasks/09-30-substrate-choice/framework.md:190`.

## 10. Where this stands, and who owns each gap

| Gap | Owner |
|---|---|
| Plane B's enforcement premise has not been tested in this install (Experiment 0) | needs a task |
| No round has ever run end to end | needs a task |
| The file-level harness/verifier split does not exist | needs a task |
| Pareto preservation is uncomputable as the ledger stands | needs a task |
| "Sandbox violations" counts this repository's refusals rather than a boundary denial | needs a task |
| The loop's own host is deliberately deferred | the framework document named above says so; no task owns it yet |

**Nothing in this thread is claimed as working.** What exists is the contract for the instruments
([`personal-agent-harness-loop.md`](./personal-agent-harness-loop.md)), the boundary mechanism measured in isolation
([`personal-agent-use-time-architecture.md`](./personal-agent-use-time-architecture.md) §7), and this page's record of
what has not been built. A reader who wants the current state of the user-facing thread instead should read
[`personal-agent-usage.md`](./personal-agent-usage.md).

## How to check this page

- **Two doors hold its shape.** `tests/spec-context-budget.test.ts` holds the router's link table against the routed
  set, holds this page inside its 24 KiB budget, and holds its `##` inventory to the list in that test.
  `tests/document-drift.test.ts` holds every specification index equal to its directory and every path named here.
- **What the doors do not check**: whether this page has restated a step instead of linking to it, and whether the
  gaps in §10 are still gaps. Both are a reader's check.
- **When a gap closes, this page changes twice**: it leaves §10, and the claim it supported moves from `unverified` or
  `not yet demonstrated` to `demonstrated` with the reading that did it.
