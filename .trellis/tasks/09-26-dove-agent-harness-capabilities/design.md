# Design: a harness whose contracts carry load

## 1. The problem, restated

A vertical agent - auditing a codebase, trading, testing a system's security - must be **constrained by
something other than its own willingness**. Today it is not. The contracts exist and nothing reaches them;
the one gate that runs can answer a single question; and the repository describes a guarantee it does not
have.

Restated as one sentence: **work that runs through this harness must be constrained by it, and every claim
the harness makes about itself must be true as stated.**

## 2. What runs today, established rather than assumed

Reachability from the four entry points (`src/cli.ts`, `src/pi-adapter/extension.ts`,
`src/adapters/local-rpc.ts`, `src/adapters/mcp.ts`), recorded in `research/ground-truth-what-runs.md`:

| | Module | State |
|---|---|---|
| Loop | `loop.ts`, `loop-runner.ts` | unreachable |
| Gates | `gate-limit.ts`, `gate-conformance.ts` | unreachable |
| Mode | `work-mode.ts` | unreachable |
| Authority | `authority.ts` | unreachable |
| Scoping | `capability-scope.ts` | unreachable |
| Effects | `effect-ledger.ts`, `checkpoint.ts` | unreachable |
| Admission | `context-admission.ts` | unreachable |
| **The live gate** | `extension.ts:1332` `authorize` callback | **reachable, fail-closed, semantically empty**; capability-scoped only - it never sees a `bash`, `edit` or `write` call |
| **The host's pre-tool-call hook** | `extension.ts:1975` `pi.on("tool_call", ...)` | **reachable, already enforcing two policies, can refuse on arguments**; the widest seam on this host - see `research/host-hook-surface-verified.md` |
| **The dispatch line** | `loop-runner.ts:135` \`await options.executeTool(call, signal)\` | in the unreachable loop |

The live gate is better than it looks: `fast-path.ts:51` defaults to **not approved** when no callback is
present, so the path is fail-closed, and it records `capability.blocked` with a reason. Its implementation
answers only **"is this capability read-only?"**.

## 3. What the frontier establishes, and where it contradicts this repository

Seven constraints from `research/design-constraints-from-evidence.md`, and three corrections:

- **C1**: the bypasses are not tool calls. CVE-2026-55607, CVE-2025-59532, Overpatch, Heapjack and Beltdown
  all went around the harness's own subprocesses. **A tool-call gate cannot see them.**
- **C2**: fail closed or ask. This repository's gates already do; every shipping product surveyed does not.
- **C3**: deny must not be overridable by the allow channel. Not yet checked against `loop.ts`.
- **C4**: a check that runs concurrently with its effect is detection, not prevention.
- **C5**: a model grading itself is not a check. **Neither layer of this repository has attempted this.**
- **C6**: a convention is context, not enforcement - and this repository demonstrates the difference
  internally: `.trellis/agents/*.md` carry no tool list, so the git-commit ban is prose, while
  `.codex/agents/*.toml` carry a host-enforced `sandbox_mode`.
- **C7**: MCP guarantees nothing. **The approval boundary here is ours to design.**

**Correction 1 - exactly-once.** "Exactly-once across interrupts, at-least-once across crashes" is a
property of the durably recorded task, not the effect. LangGraph's `interrupt()` resumes by
"**re-executing all logic**". **An approval gate duplicates anything placed before it.** The harness provides
**at-most-once dispatch from its own resumption paths**; the backend owns the rest.

**Correction 2 - the guarantee is not ours.** "The contract explains 81%; the harness barely matters."
Stripe refuses concurrent same-key requests; Temporal refuses to promise more than at-least-once.

**Correction 3 - a precedent that does not exist.** `checkpoint.ts:12-13` cites "Microsoft's
`WorkflowCheckpoint`". No such class was found.

### 3.1 The convergent set, from code

Eight things every serious harness in the survey has, named by the file that has it. Five are in scope for
this task, three are not, and the split is itself a design decision.

| | Item | In scope |
|---|---|---|
| 1 | A stepper/driver split | no - the host owns the loop |
| 2 | A step-result type | no |
| 3 | **A pre-execution function that is not the tool** | **yes - M2** |
| 4 | **Before/after hooks on the model and the tool** | **yes - M1/M2** |
| 5 | Tools that are not bash strings | yes - already true here |
| 6 | **Context derived per turn, never the durable state** | **yes - M4** |
| 7 | Some durable log | yes - the ledger |
| 8 | **A named ceiling on every unbounded quantity** | **yes - M7** |

Items 6 and 8 are rules this design did not previously state, and they are cheap: context is a **view**
rebuilt each turn, and every unbounded quantity - steps, retries, depth, concurrency, tokens, in-flight
time - has a **named ceiling**.

**The session question collapses to three choices.** Read SWE-agent's `agents.py` and LangGraph's
`checkpoint/base/__init__.py` and the space is: a **log** (SWE-agent has no session type at all - just a
`.traj` file), a **snapshot** (LangGraph's per-superstep channel values), or **neither**. This design
chooses a **log** for effects, because a log is what a claim needs, and a snapshot is what a state machine
needs.

### 3.2 The strongest evidence that a gate placed in configuration silently degrades

From the Claude Agent SDK's own code: `CanUseToolShadowedWarning` and
`_get_can_use_tool_shadowed_warning`, which fire when `permission_mode="bypassPermissions"` is set -
**"can_use_tool will not be invoked"** - and when a whole-tool `allowed_tools` entry (`"Read"`, `"Read()"`,
`"Read(*)"`) pre-approves the tool before the callback runs. The code's own remedy, in its own words:
"use a PreToolUse hook instead."

**This is the failure our design must not reproduce.** The `authorize` callback is the right seam, and it
must not be reachable-around by a mode flag: **the mode supplies the policy the callback evaluates, never a
switch that skips it.**

And the boundary is placed differently in all four code-readable harnesses - OpenAI inside the loop, ADK a
six-step pipeline whose confirmation gate holds for every tool, SWE-agent a blocklist in the tool handler
that **throws**, OpenHands a persisted session state that halts the loop. **Routing around the boundary is
possible in every one of them, by a different surface.** No surveyed design has a boundary that cannot be
routed around; the design's job is to name the surface that routes around ours.

### 3.3 Two extremes worth reading before writing a loop

- **`sweagent/agent/agents.py`** - the whole harness in one file; `run` is nine lines at `:1265`. Its
  `forward_with_handling` (`:1062`) is the fullest refusal taxonomy in the survey -
  requery-with-template, exit-with-patch-salvage, propagate - **with a distinct `exit_status` per class**.
  **Refusal is a branch, not an error**, which is the shape M7 takes.
- **Subagent context is where the designs actually diverge.** OpenAI's handoff passes full history and
  transfers control; `as_tool()` passes only generated input and the parent continues, with
  `nest_handoff_history` summarizing while retaining provenance - **and its docstring warns the summary is
  not redacted**. ADK builds a **brand-new in-memory session**, passes the parent's state minus internal
  keys, and returns the **last non-thought content**. Both are defensible; neither is a default.

## 4. Architecture: what this harness owns, and what it delegates

The first design decision, and the one that resolves the three-implementations problem. **A harness that
reimplements its host is how this defect is produced again.**

### Owns

| Contract | Module | Why it cannot be delegated |
|---|---|---|
| **Effect identity and claim** | `effect-ledger.ts` + a real cross-host store | No SDK or host provides cross-run effect identity. The 2026 incident was an **unmodelled cross-run side channel**; this is the only layer that can declare one. |
| **Gate evaluation** | `gate-limit.ts`, `gate-conformance.ts` behind the existing `authorize` callback | The host's UI asks "may this tool run". A limit gate asks "is this order inside its threshold", a conformance gate asks "is this target in scope". **Neither is a question a host can answer.** |
| **Authority** | `authority.ts` | The authority document is the engagement's contract. It is this project's data. |
| **Capability scope** | `capability-scope.ts` | Per-agent reach, declared outside model context. |
| **Acceptance** | `task-convergence.ts` | The best-specified acceptance model in the survey: it **computes** the terminal state. |
| **Mode artifact** | `work-mode.ts` | Configuration-shaped capability to a vertical. |

### Delegates

| Concern | To | Condition |
|---|---|---|
| **Compaction and admission** | the host's spill policy | Dove supplies **policy and the artifact sink**; it does not implement a second compactor. This is the one of the three admission implementations that should survive. |
| **Isolation and sandboxing** | the host and the OS | Dove cannot contain processes it does not spawn. **This is why C1 is a stated limitation, not a fix.** |
| **Approval prompting** | the host's tool UI | Preserves the existing decision: "Dove adds no second prompt". Dove adds **policy**, evaluated in the callback the host already calls. |
| **Taskification, PRD, specs, journals** | Trellis | It runs and it works. This task adds a **machine-checked capability set** to its agent definitions, and nothing else. |
| **Subagent definitions** | Trellis, with checked capability sets | `.trellis/agents/*.md` currently carry no tool list, so their restrictions are prose. |

## 5. The contracts

### 5.1 The effect contract

Wired at **`loop-runner.ts:135`**, the only site that runs a tool, and **never at an approval boundary**.

```typescript
type EffectClass = "idempotent" | "key-idempotent" | "non-idempotent";
type EffectOutcome = "completed" | "failed" | "cancelled" | "unknown";   // "unknown" is new
```

Six requirements, all of them: deterministic identity computed **before** dispatch and stable across
processes; **one atomic claim** (compare-and-swap or unique constraint) in a store **shared across hosts**;
a key the **backend** enforces and the tool forwards; a terminal record that can say **unknown**; a
per-tool class with only the first two automatically retryable; and a bound on in-flight time or a refusal
to auto-resolve.

**The claim this design makes**: at-most-once dispatch from our own resumption paths, plus a forwarded key.
**It does not claim exactly-once**, and the module documentation changes to match.

### 5.2 The gate contract

**One policy, two adapters.** The policy is evaluated at the host's `tool_call` hook
(`extension.ts:1975`), because that is the only seam on this host that sees a `bash` command, an `edit` path
and a `write` body; the capability `authorize` callback (`:1332`) **delegates to the same policy** rather
than answering separately. The callback the host already calls -
`authorize({ name, version, sideEffects, args })` - does receive the arguments and does fail closed, but only
for Dove's own capability tool. Verified in `research/host-hook-surface-verified.md`.

Evaluation order, and it is a requirement: **deny is evaluated independently of allow and wins.** Codex's
"deny beats write, write beats read" is the precedent; Claude Code's `EndConversation`, which skips
`PreToolUse` entirely, is the counter-example to design against.

**The decision must also not depend on handler order, and the input must be re-read at execution.** The
host's own types state it (`types.d.ts:703-708`): `event.input` is mutable, later `tool_call` handlers see
earlier mutations, and **no re-validation is performed after mutation**. A gate whose decision is computed
once and then lets execution proceed is bypassable by any handler registered after it. On this install
there is exactly one other subscriber today (none), so the hazard is latent - which is when it should be
closed, not after a plugin arrives.

### 5.3 The admission contract

Owned by the host; **Dove owns the policy and the belief invalidation**. The research is explicit about what
makes dropping content safe: the content is re-fetchable, the marker says **what** was lost, and **the
harness invalidates its own cached beliefs**. Claude Code is the only implementation found that does the
third - it deletes the file from `readFileState` after clearing a Read result, "two lines", closing a real
bug class.

Policy Dove supplies, and each item is a finding rather than a preference:

- **Two stages, cheapest first.** Claude Code "clears older tool outputs first, **then** summarizes", and
  Anthropic calls tool-result clearing "the safest, lightest-touch form of compaction". **The stages are
  separable: implement stage one and do not build a summarizer.**
- **A digest plus a resolvable reference**, with the marker saying **what** was lost. Codex's admission
  function (`codex-rs/utils/output-truncation/src/lib.rs`) truncates the **middle**, prepends "Warning:
  truncated output (original token count: N)", and takes its budget **per model**.
- **Invalidate derived beliefs.** Claude Code deletes the file from `readFileState` after clearing a Read
  result - the only implementation found that does this.
- **Re-inject from disk rather than trusting the summary.** The strongest single fact behind this: LIMBO's
  25,930 episodes found agents "reported success in **90%** of the episodes in which they had duplicated an
  effect". **A model's self-report about its own state is not evidence.**
- **Recite before acting** - +4% for GPT-4o on RULER (arXiv:2510.05381), the one measured improvement.

**Three correctness requirements, not preferences:**

- **Context edits must be atomic with respect to a tool loop.** Removing part of a tool-call/result pair
  breaks Anthropic's thinking-block checksums and makes the request API-invalid. OpenHands snaps forgotten
  ranges to `manipulation_indices`.
- **Prefix stability.** Manus calls the KV-cache hit rate "the single most important metric", with cached
  tokens at $0.30 versus $3 per million. The rule is **append-only; mask rather than remove.** Codex's own
  comment says "preserve cache (prefix-based)".
- **A compaction that fails must be observable**, and repeated failure must stop the run rather than loop.
  Claude Code halts after repeated "Autocompact is thrashing"; OpenHands raises
  `NoCondensationAvailableException` and falls back to the uncondensed view; Aider caps summary recursion
  at depth 3; Cline re-summarizes the canonical transcript to avoid summary-of-summary drift.

**And the honest ceiling on all of it**: no benchmark plots real agent task success against context length.
The degradation figures are retrieval and reasoning proxies. **This design cites the mechanism and the
requirement, never a performance number.**

### 5.4 The mode contract

A mode declares capabilities, an authority document, limits, and an effect-class map. It is loaded **by the
host**. "Loaded by a test" is the defect being fixed.

### 5.5 The acceptance contract

`task-convergence.ts`, with its **one known hole closed**: `acceptance.passed` currently takes **optional**
evidence refs, so a pass need not be backed by anything. A pass requires a resolvable observable.

And from the evals research, the discipline that matters: maintainer merge decisions run **~24 percentage
points below** the automated grader, and "tests pass" is the same automated grader a 2026 agent collective
learned to defeat. **Acceptance criteria are observables, not assertions.**

### 5.6 The verification contract

New, and the shape comes from the research rather than from this repository, because **neither layer has
attempted verification at all**.

**A cost-ordered ladder, cheapest first, short-circuiting on the first rung that settles.** UK AISI's
Inspect ships exactly this (`cascade()` in `src/inspect_ai/scorer/_cascade.py`): it records
`decided_by`, and returns `unscored()` rather than a default when nothing settles. Its docstring states its
own premise - "earlier (cheaper) scorers do not produce false positives... **That assumption is the
caller's to uphold**". Rungs, in order:

1. **Parse, typecheck, lint.** Free, and it settles a large class of failure.
2. **Run it and read the exit status.** Free.
3. **Compare against a second implementation** - roundtrip, idempotence, associativity. **Needs no model at
   all.**
4. **A held-out check the agent cannot see.** See below.
5. **A domain oracle** - a solver, a specification, an executable spec. **Per vertical, and out of scope
   here.**

**And the rungs must be resistant to the agent weakening them.** The evidence for this is not theoretical -
SWE-bench's grader is an incident log of six such attacks, each now a defence:

- a **skipped** test counts as **failed**, because "a patch that makes every F2P test skip ... scores
  RESOLVED_FULL";
- `SUITE_RAN` requires **positive evidence the suite ran at all**;
- the parsed log is **cross-checked against the test command's exit status**, because "a patch can print its
  own 'PASSED' lines (e.g. from a `conftest.py` hook)".

Five anti-weakening mechanisms were observed in code: restore the oracle from metadata before scoring;
never place the oracle in the workspace; restrict capability; gate at the write boundary (SWE-agent runs
lint before and after an edit and calls `undo_edit()` on any new lint error); and intercept the submission
to make the agent revert the test files it touched.

**The finding that turns this into a requirement rather than a nice-to-have**: in a manual inspection of
**120 successful, kernel-checked proofs, 30% had spec defects** - Lean 32.5%, through cheats like `sorry`,
`assume(false)` and `ensures true`. And SpecBench found **every frontier agent saturates the visible suite
while the held-out gap grows 28 points per 10x of code size.**

**Therefore the acceptance contract in 5.5 must verify the criteria, not the artifact.** A pass requires an
observable that the agent did not author, and the observable must not live where the agent can edit it.

**The honest upper bound on this contract**: verifier-guided search eventually **underperforms plain
repeated sampling** as N grows, because imperfect verifiers mis-rank and prune valid paths
(arXiv:2502.00271); and RLVR with **random** rewards recovers 21.4 of the 29.1 points attributed to the real
signal (arXiv:2506.10947). So a ladder that cannot settle must say **unscored**, never "passed".

### 5.7 The durable-knowledge contract

Capability 5, and the research corrected a number I had recorded wrong. The ETH Zurich benchmark's "+4% for
developer-written context files" compares them **against no file at all**, the benefit does not hold for the
agent this project uses, and **after the authors deleted all existing docs the LLM-written file improved
performance by +2.7% and beat the human ones.** The honest reading is that the effect is **approximately
zero, small and conditional** — and that the harm comes from **redundancy with documentation that already
exists**, not from instruction-following failure.

What follows from that, and it is not "write more documentation":

- **A pointer file, not a prose file.** Path- or task-scoped, written at a named trigger, containing only
  what the agent **cannot derive**. Claude Code's own rule: cut anything derivable from the codebase
  (directory layouts, dependency lists, architecture overviews) and keep pitfalls, rationale and conventions
  that differ from tool defaults.
- **The one large measured win is a different mechanism**: AWM (arXiv:2409.07429) induces procedures from
  **verified successful trajectories**, and reports +24.6%/+51.1% relative. **If this project wants a
  number, it builds a procedure library from verified episodes, not a notes file.** Note the dependency:
  trajectories are only worth learning from when M6 verified them.
- **A review inbox before the write.** Gemini CLI's Auto Memory is the reference: candidates as
  unified-diff patches, target-allowlisted, dry-run validated, **nothing auto-applied.** Direct writing - the
  Claude Code behaviour - is the condition the benchmark measured as net-negative.
- **Bound the always-loaded index only; keep bodies pull-able.** No measured "too much" threshold exists.
- **Invalidate by revision.** GitNexus context packs carry `head_commit` plus per-path digests and fail
  closed on unknown provenance; Gemini CLI rejects a candidate with "patch does not apply cleanly"; Aider
  simply re-reads from disk every turn.
- **And the detector nobody ships**: nothing detects a rule that references a path or command that no longer
  exists. **That is cheap, and it is worth building.**

**A discipline this design adopts for its own documentation**: if you cannot name the check that fails when a
rule is broken, the rule is **context** and must be labelled as such; if you can write the check, the
knowledge should leave the context budget. This repository's spec budget test enforces document **shape**,
not content — **a spec can pass CI while stating a rule nothing checks** — and the fix is that every spec
section names an `enforced by:` or says it is advisory.

## 6. Data flow

```text
request
  |
  v
[host] loads the mode  ---------------------------> capabilities, authority, limits, effect classes
  |
  v
[host] model proposes an action
  |
  v
[host] tool-call boundary --> authorize(capabilities... args)
  |                                 |
  |                                 +--> gate-limit      : is this inside its threshold?
  |                                 +--> gate-conformance: is this target in scope?
  |                                 +--> capability-scope: may this agent reach it?
  |                                 |
  |                                 +--> deny is evaluated independently and wins
  |                                 +--> cannot evaluate  =>  block (never allow)
  v
[host] tool dispatch  <--- LOOP-RUNNER:135 ---> effect claim: identity, atomic claim, class
  |                                                    |
  |                                                    +--> already claimed => refuse and report
  |                                                    +--> terminal record: completed|failed|cancelled|unknown
  v
tool result
  |
  v
[host] admission: digest + artifact reference; Dove supplies policy and belief invalidation
  |
  v
[ledger] the evidence plane
  |
  v
[task-convergence] acceptance: observables, not assertions
```

## 7. The wiring points, as coordinates

| What | Where | Note |
|---|---|---|
| Effect claim | `src/core/loop-runner.ts:135` | the only tool-execution site; the gate is at `:120`, `onGateInvoked` at `:122` |
| Gate policy | `src/pi-adapter/extension.ts:1975` (`pi.on("tool_call")`), delegating from `:1332` | **one policy, two adapters.** Evaluate where the information is widest - the hook sees a `bash` command, an `edit` path, a `write` body - and make the capability `authorize` callback delegate to that same policy. Two answers to one question is this design's first named risk. Decided in `research/host-hook-surface-verified.md` |
| Refusal recording | `src/core/fast-path.ts:46-67` | already records `capability.blocked` with a reason |
| Mode loading | the host's startup path | `work-mode.ts` is unreachable today |
| Reachability | a test | **reachability is the defect that started this task** |

## 8. Deliberately not built

- **A second compactor.** The host has one.
- **A second loop.** The host has one, and LangGraph's evidence says the loop is where the guarantee is
  least likely to live.
- **A sandbox.** C1 is a stated limitation: a harness cannot contain the processes its host spawns.
- **A single verifier.** The frontier's verification is a **cost-ordered ladder**, not a component, and the
  ladder is cheap and implementable - see 5.6. What is out of scope is the **top** of the ladder, which is
  domain-specific and needs a per-vertical oracle.
- **A second model call presented as verification.** Inspect's judge **falls back to the model under
  evaluation when no grader is bound** - self-grading is a default path, not an error - and self-preference
  scales linearly with self-recognition.
- **A performance claim.** No source measures harness-level variables in a controlled way. The defensible
  claims name a specific failure each; there is no general "the harness makes agents better".

## 9. Trade-offs

| Decision | Cost | Why accepted |
|---|---|---|
| Delegate admission | Dove's policy can be overruled by a host change | The alternative is a third implementation of one contract |
| Keep the host's approval UI as the human gate | Dove cannot prompt per-argument | Preserves "Dove adds no second prompt"; the fine-grained checks do not need a human |
| at-most-once rather than exactly-once | A weaker claim | **The stronger claim is false**, and a false claim about a guarantee is worse than a weaker true one |
| Delegate isolation | C1 stays open | The alternatives are a microVM or replacing the host; both are larger than this task |
| A verification ladder, not a verifier | Rungs 1-3 settle only cheap classes; the top rung is per-vertical and unbuilt | Rungs 1-3 are free, need no model, and the alternative is claiming a capability the evidence says fails without an oracle |
| A held-out observable | Costs a second, agent-invisible fixture per criterion | SpecBench: the visible suite is saturated while the held-out gap grows 28 points per 10x of code size |
| Documentation states its own enforcement | Every rule needs an `enforced by:` or an explicit "advisory" label | The alternative is what this repository already has: a spec that passes CI while stating a rule nothing checks |
| Durable knowledge is pointers, not prose | Less comfortable to read | The measured effect of prose is approximately zero, and the one large win went to a procedure library built from verified episodes |

## 10. Risky files and rollback

- `src/pi-adapter/extension.ts` (2,736 lines) - the only running entry point; the `authorize` callback is
  the change. Rollback: revert the callback to the read-only check.
- `src/core/loop-runner.ts` - the effect claim is inserted at `:135`. Rollback: remove the claim and the
  behaviour returns to today's, which is no deduplication.
- `src/core/effect-ledger.ts` - `EffectOutcome` gains `"unknown"`. Rollback: the narrower union.
- **Nothing in `src/core` is reachable today, so the blast radius of the wiring changes is the host path
  only** - which is also the reason the work is needed.

## 11. What this design does not establish

- That wiring these modules makes anything **better**. The research found no controlled measurement of
  harness-level variables. The claims are per-failure: a bounded loop stops non-termination, a claim stops
  duplication, a scope bounds reach.
- That the unreachable modules are **correct**. They are read, not executed. Their tests pass, which this
  project has already learned is weak evidence.
- **C3** - whether `loop.ts` can be overridden once the gates are in it - has not been checked.
- Whether the host offers any hook that could contain its own subprocesses. If it does, C1 becomes work
  rather than a limitation.