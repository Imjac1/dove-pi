# Synthesis 02: the consolidated answer across all three research waves

- Task: `09-25-dove-base-agent-framework`
- Date: 2026-09-25
- Supersedes `synthesis-01-official-wave.md` where the two disagree; the corrections are listed in
  section 5.

**Waves complete:** official 5/5, community 2/2, GitHub 3/3. 24 research files. Every load-bearing
citation re-fetched by the main session was confirmed; the three that were **not** confirmed are named
in section 7.

---

# Q1. Agent workflow patterns

## 1.1 Three taxonomies exist, on three different axes

| Axis | Content | Source |
|---|---|---|
| **2024 capability ladder** | 1 building block (augmented LLM) + **5 workflows** (prompt chaining, routing, parallelization [sectioning \| voting], orchestrator-workers, evaluator-optimizer) + agent | Anthropic, verified verbatim |
| **2026 composable patterns** | **classify-and-act, fanout-and-synthesize, adversarial verification, generate-and-filter, tournament, loop until done** | Anthropic, verified verbatim |
| **Who holds the plan** (orthogonal) | subagents / skills / agent teams / workflows, discriminated by *"who decides what runs next"* | Anthropic, verified verbatim |

## 1.2 What production evidence says survives

| Pattern | Evidence status |
|---|---|
| **Sectioning** (independent subtasks, isolated contexts) | **The only pattern with unanimous production support.** Anthropic reports up to 90% wall-clock reduction |
| **Prompt chaining as a fixed pipeline** | Reproducible: Agentless achieves *"the highest performance (32.00%, 96 correct fixes) and low cost ($0.70) compared with all existing open-source software agents"* on SWE-bench Lite, with **no agent loop at all** |
| **Heterogeneous adversarial verification** | Debate beats consultancy; the practitioner form is cross-vendor review |
| Voting on single-shot *verifiable* reasoning | Measured gains (GSM8K +17.9%) **only** with genuinely independent samples |
| **Routing, classify-and-act, generate-and-filter** | **No independent evidence found.** Vendor narrative only |
| **Tournament / voting with correlated agents** | **Evidence against.** See 1.3 |
| **Evaluator-optimizer** | **Evidence against self-correction without external feedback:** *"LLMs struggle to self-correct without external feedback, and at times, their performance even degrades after self-correction"* (arXiv 2310.01798) |
| **Unconstrained orchestrator-workers / loop-until-done** | τ-bench: SOTA below 50% success, **pass^8 < 25%** |

## 1.3 The decisive finding: agents are low-variance, so voting buys correlated error

Anthropic's own Frontier Red Team, verified verbatim:

> **Individual agents are "low variance"** ... when one agent makes a bad decision, **it is likely that
> many agents will make that same bad decision. What would have been isolated problems can quickly
> become systemic failures.**

Observed in their experiments: **18 of 30 agents chose the identical git branch name**; multiple agents
independently titled fiction *"The Cartographer's Last Commission"*; over half built ray tracers or
self-hosting compilers; pricing agents colluded by round 3; a job queue received 2.4M requests and
accepted 117. Corroborated by *Artificial Hivemind* (arXiv 2510.22954) on inter-model homogeneity.

**Consequence: diversity must be structural, not statistical.** N opinions require N different model
families, contexts, or decompositions - never a resample of one context.

## 1.4 Is workflow-first *wrong* for long-running or adversarial work?

**Yes, but only about coverage.** A coordinating swarm found **266** vulnerabilities where a fixed
workflow pointed at pre-assigned directories found **21**, with only **12** overlapping. But equalize
the search space and *"the two methods seem comparable in terms of tokens per vulnerability found"*.
The advantage is exploration, not efficiency. A fixed code path cannot search where nobody told it to
look - so **exploration budget is a mode field, not a topology choice.**

## 1.5 The real bottleneck, ranked by evidence density

1. **Evaluation** - *"I lack the time and motivation to thoroughly evaluate all my created workflows.
   This prevents me from gaining confidence in their value"* (Ronacher). Benchmarks mis-measure by up
   to 100% relative (arXiv 2507.02825).
2. **Review capacity** - *"spending so much time on code review"* (Willison).
3. **Cost** - 4x tokens for an agent, ~15x for multi-agent; every published multi-agent win omits it.
4. **Observability / state / coordination** - *"the model call is usually the least interesting part."*

---

# Q2. Agent framework forms

## 2.1 Six axes

| Axis | Finding |
|---|---|
| **Who owns the loop** | Three real shapes: SDK you operate / you write the loop / hosted harness. Strongest evidence is a type signature - Pi's `AgentOptions.streamFn` is **required and caller-supplied**, so the model transport is not owned by the library |
| **Component decomposition** | Anthropic's current answer: **session / harness / sandbox**, swappable, *"opinionated about the shape of these interfaces, not about what runs behind them"* |
| **Where the gate lives** | The decisive axis - see 2.2 |
| **Resume granularity** | The evidence-trail decision - see 2.3 |
| **Extension seam** | ADK `BasePlugin`; MS middleware with `FunctionInvocationContext.Terminate`; Cordis plugins; Pi constructor options |
| **Stability vs gate quality** | The best gate semantics and the worst API stability coincide in dsh |

## 2.2 Where the gate lives (final table)

| System | Gate | Blocks pre-execution? |
|---|---|---|
| Pi `pi-agent-core` thin `Agent` | `beforeToolCall` -> `{block, reason, terminate}` | **Yes.** `agent-loop.js:419-429` returns `kind:"immediate"`; verified in compiled source **and executed** |
| Pi `AgentHarness` | `before_tool` hook | **No.** Typed `(event: unknown) => unknown`, and `.on()` throws `HarnessNotImplemented` - **executed to confirm** |
| OpenAI Agents SDK | `needs_approval` -> `RunState`; **and** `tool_guardrails` `reject_content` | **Yes** - the async path, plus an in-process block (**correction to synthesis-01**) |
| OpenAI input/output guardrails | tripwire | **Not by default.** `run_in_parallel=True`, and the doc admits the agent *"may have already consumed tokens and executed tools before being cancelled"* |
| Google ADK | `before_tool_callback` returning a **truthy** value; `require_confirmation` (Experimental) | Yes, but **`{}` or `None` does not stop the chain** - a deny implemented as `{}` silently no-ops |
| strands harness `interventions` | `.cedar` policy / NL rubric / HITL, resolved in a library-owned loop; **inherited by subagents** | **Yes** - the closest match to the requirement found anywhere |
| agno | `@approval(type="required")` | Yes |
| goose | `permission.yaml` `never_allow` | Yes |
| LangGraph | `interrupt()`, `Command(resume=)` | **Node boundary only** |
| CrewAI / smolagents / AutoGen / SWE-agent | none / cooperative flag / none / prompt-level | **No** |
| **MCP** | **none** - *"MCP itself cannot enforce these security principles at the protocol level"* | **No, by design** |
| dsh | `ctx.approval.request()` -> `'allowed-once' \| 'rejected' \| 'cancelled' \| 'unavailable'` | **Yes, fail-closed with a closed outcome set** - but the least stable API |

**"The '200-line loop + real gate' combination does not exist in this survey."** Everything with a
gate is a full harness; everything thin has no gate.

## 2.3 Resume: at-least-once is the mainstream default

- **ADK, verbatim:** tools *"are run **at least once**, and may run more than once when resuming"* - the
  doc tells the tool author to deduplicate.
- **LangGraph:** *"the runtime restarts the entire node from the beginning."*
- **LIMBO (arXiv 2609.29095), 25,930 episodes, verified verbatim:** when a read-back can reveal what
  happened, frontier models duplicate **0.5%**; when it cannot, **56% and 74%**, and *"the contract
  explains 81%"*. *"We prove that no verification-only policy is exactly-once under late commits."*
- **"Resume Means Resume" (arXiv 2608.03836):** five deployed frameworks, *"none exposes a
  machine-checkable contract"*; **concurrent resume fires a gated effect k times in 36 of 40 cells, and
  the failure crosses hosts.**
- Agents report success in **90%** of the episodes in which they duplicated an effect.

## 2.4 Five well-known projects are stale, frozen, gutted, or pivoted

letta (24.9k★) is a README-only stub - source moved to a different repo and language. OpenHands (89k★)
pivoted to a **host** for other agents and no longer owns a loop. autogen (61k★) is ~5.5 months quiet
while `agent-framework` ships daily. swarm is frozen. aider and Roo-Code are ~4 months stale.

**The surveyor's conclusion: "Vendor the loop; depend on the protocol."**

---

# 3. The cross-cutting findings (all verified)

1. **"Guardrail" does not mean "gate."** Anthropic files guardrails under *parallelization/screening*;
   OpenAI's input/output guardrails default to running in parallel with execution. **One exception:**
   OpenAI's `tool_guardrails` `reject_content` is a genuine in-process pre-execution block.
2. **MCP has no in-protocol approval boundary, by design.**
3. **Pi's `effect-gate` is a cancellation gate, not an authorization gate** - read in full; a
   three-state machine whose `admit()` only checks whether the pass was aborted.
4. **No single layer is a boundary.** Published defeats exist for the static denylist, the process
   sandbox, kernel-level enforcement, human approval (GhostApproval: the model understood the target
   while the dialog hid it), the gate's own configuration (Copilot CVE-2025-53773), and production
   blocking monitors (**79%** of red-team trials).
5. **The strongest measured lever is capability scoping stored outside the model's context** (CapScope:
   injected effect executes in **3/75** runs versus **33-47/75** under ambient-authority/global-policy
   baselines, at roughly no task cost).
6. **Declare *and* enforce.** A gate measurably helps (5.4-27.7% out-of-scope actions versus 0.2-4.5%),
   but removing the *consent declaration* alone raised the rate from 0.0% to 17.1%.
7. **The observed default is fail-open.** The cleanest pair: `redcell` returns `True` for an empty
   scope (*"unrestricted by design"*); `Armur` errors in the same state.
8. **No LLM trading agent blocks an order at a runtime boundary.** All implement "risk management" as
   LLM debate. Real pre-trade blocking exists only in non-LLM engines.
9. **The most-cited open-source pentest agent has zero enforcement files** - only a README disclaimer.
10. **Harness logic is perishable** - *"Harnesses encode assumptions that go stale as models improve."*
11. **The session must outlive the execution environment** - the vendor's own "don't adopt a pet"
    post-mortem.

---

# 4. What the base framework does about it

| Decision | Answer |
|---|---|
| Decomposition | **session / harness / sandbox**, independently swappable |
| Loop ownership | **Ours.** We define the interface; `pi-agent-core`'s thin `Agent` is the first adapter |
| Work mode | A **three-file directory**: portable `MODE.md` (Agent Skills shape) + `governance.yaml` + `permissions.yaml` |
| Authority | A **grant graph** (principals / grants / targets) with an all-grants-must-resolve rule that fails closed on anything unevaluable; the agent **cannot write its own authority** |
| Gate | One pre-execution, parameter-level boundary with **two semantics**: *limit* (trading) and *conformance* (pentest). Both fail closed; both canonicalise the decision string and the human-visible string and fail closed if they differ |
| Audit vertical | Not a pre-action gate - the control is **finding identity** that excludes model prose |
| Exactly-once | Lives in the **tool contract** (effect identity as an idempotency key the backend honours) plus **consume-once in a shared store**, because the harness *"barely matters"* |
| Orchestration | Support **sectioning**, **prompt chaining**, **heterogeneous adversarial verification**. Refuse **correlated voting** and **unconstrained loop-until-done** as defaults |
| Evidence | Append-only per-engagement log; **cross-engagement isolation**; **mode id + version stamped on every action** - a gap no surveyed project fills |
| Context admission | One boundary for tool results, extension messages, **and background notifications** |

---

# 5. Corrections made during this task (recorded, not hidden)

| # | Earlier claim | Correction |
|---|---|---|
| 1 | "No duplicate-effect production incident was found" | An artifact of a metadata-only corpus. Measured evidence exists (LIMBO). **Still true:** no *named company* incident was found |
| 2 | "The sandbox is the control of last resort" | Sandboxes are bypassable, and so was the kernel enforcement proposed as the fix. Replaced with layered controls + capability scoping |
| 3 | "Effect idempotency is a framework responsibility" | Reframed: the harness barely matters; the **tool contract** explains 81% |
| 4 | "OpenAI guardrails are parallel-only" | Now also ships `tool_guardrails` with an in-process block |
| 5 | `AgentHarness` treated as a viable "fat option" | It is a **shipped stub** in the installed version - executed to confirm |

---

# 6. What the design deliberately refuses

Adopting a full framework as the base (inherits another project's opinions; the installed Pi harness
is a stub; Anthropic's own guidance is to reduce abstraction layers). Building the gate on
"guardrails". Delegating enforcement to MCP. Relying on the runtime for exactly-once. Per-action human
approval as the primary gate (non-conformant with ROE *and* it degrades). A monolithic "agent" object.

---

# 7. Still unverified (named, not papered over)

- **`vxcontrol/pentagi`** (24,951★) - uninspected; 58 MB repo, CDN cap, API rate-limited. The biggest
  open question in the pentest vertical.
- **The exact set of `SliceNotImplemented` slices in Pi 0.87.1** - resolved to "only `watchSession`"
  by reading the tarball, but its runtime behaviour is untested.
- **OpenAI's hosted "Agents API"** - `developers.openai.com` returns 403.
- **`pico3`'s `Forbidden` error semantics** - the one place in Pi where a deny path may already exist.
- **Microsoft Agent Framework API names** and **A2A v1.0.0 details** - doc-level only.
- **No named production duplicate-charge incident** was found anywhere.
- **The community sentiment landscape is under-sampled**: Medium, Reddit, SecurityWeek, CSA and
  Cymulate were unreachable, and `web_search` rate-limited for most of the community wave.
