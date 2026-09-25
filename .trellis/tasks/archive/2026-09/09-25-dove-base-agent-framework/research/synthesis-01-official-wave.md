# Synthesis 01: official-wave answers to Q1 and Q2

- Task: `09-25-dove-base-agent-framework`
- Date: 2026-09-25
- Status: **official wave only.** Vertical-requirements research is still in flight and the
  community wave has not started. This document is the answer to the two questions the user
  said must be settled, restricted to evidence that has been independently verified.

## Evidence grades used below

- **[V]** verified by the main session against the primary source (fetched, read, or executed).
- **[A]** reported by a research sub-agent, spot-checks passed, but this specific claim was not
  independently re-fetched.
- **[?]** agent-reported and not independently checked.

---

# Q1. Agent workflow patterns

## 1.1 The canonical set (2024) - [V]

From `anthropic.com/engineering/building-effective-agents`, fetched directly:

**Building block: the augmented LLM.** Then **5 workflows**, then **agent**.

| # | Pattern | One-line meaning |
|---|---|---|
| - | augmented LLM | an LLM plus retrieval, tools, memory |
| W1 | Prompt chaining | decompose into a fixed sequence, with programmatic gates between steps |
| W2 | Routing | classify the input, dispatch to a specialised path |
| W3 | Parallelization | **sectioning** (independent subtasks) or **voting** (same task, diverse outputs) |
| W4 | Orchestrator-workers | a central LLM decomposes dynamically and delegates |
| W5 | Evaluator-optimizer | one call generates, another critiques, loop |
| A | Agent | model-directed loop; use when the step count cannot be predicted |

The stated selection rule, verbatim: *"finding the simplest solution possible, and only
increasing complexity when needed"*, and *"you should consider adding complexity only when it
demonstrably improves outcomes"*.

## 1.2 The 2026 set - [V]

Anthropic's newer dynamic-workflows material names **six** patterns Claude composes from,
confirmed on `claude.dev` (figure caption plus a real `<h3 id="classify-and-act">`):

**classify-and-act, fanout-and-synthesize, adversarial verification, generate-and-filter,
tournament, loop until done.**

Two of these - **adversarial verification** and **tournament** - do not appear in the 2024
list. Both are exactly what the user's security/audit verticals need, and both are
*verification* patterns rather than generation patterns.

## 1.3 The orthogonal taxonomy: "who holds the plan" - [V]

`code.claude.com/docs/en/workflows.md` gives the cleanest published discriminator, and it is
not the same axis as the pattern list:

| | Subagents | Skills | Agent teams | Workflows |
|---|---|---|---|---|
| What it is | A worker Claude spawns | Instructions Claude follows | A lead agent supervising peer sessions | A script the runtime executes |
| **Who decides what runs next** | Claude, turn by turn | Claude, following the prompt | The lead agent, turn by turn | **The script** |
| Where intermediate results live | Claude's context window | Claude's context window | A shared task list | **Script variables** |
| What's repeatable | The worker definition | The instructions | The team definition | **The orchestration itself** |

Motivating failure, verbatim: the default harness *"needs to both plan and execute in the same
context window. For many coding tasks, this is highly effective, but it can break down over
long-running, massively parallel, highly structured and/or adversarial tasks."*

## 1.4 Why this matters for the three verticals

| Vertical | Pattern fit (from the above evidence) |
|---|---|
| Quantitative trading | Mostly **workflow**, not agent: fixed pipelines, deterministic gates, idempotent effects. The model's job is judgement at defined points, not loop control. |
| Penetration testing | **Adversarial verification** + **orchestrator-workers**; long-running; the 2024 doc's own caveat applies ("higher costs, and the potential for compounding errors... sandboxed environments, along with the appropriate guardrails"). |
| Code auditing | Anthropic's own doc files vulnerability review under **parallelization / voting**, not under agent - i.e. the vendor's example for this vertical is a workflow with multiple independent reviewers. |

**The consistent signal: for all three verticals, the value is in the workflow/verification
layer, not in giving the model more autonomy.** That is a design constraint on the base
framework, not a detail.

---

# Q2. Agent framework forms

## 2.1 Axis 1 - who owns the loop

Three shapes exist in the official material, and they are genuinely different products:

| Shape | Whose process runs the loop | Evidence |
|---|---|---|
| SDK you operate | yours | Claude Agent SDK: "in a process you operate" [A] |
| Client SDK | you write the loop yourself | "You write the tool loop yourself" [A] |
| Hosted harness | the vendor's | Managed Agents: "a hosted agent harness that runs the agent loop" [A] |
| Local runtime library | yours | Pi `pi-agent-core`: `AgentOptions.streamFn` is **required** and caller-supplied [V] |

The Pi data point is the strongest because it is a type signature, not marketing: **the model
call is not owned by the library**. A framework built on it can substitute any provider,
including a scripted offline one, without patching the package.

## 2.2 Axis 2 - the component decomposition - [V]

Anthropic's current position (`anthropic.com/engineering/managed-agents`, Apr 08 2026):

> We virtualized the components of an agent: **a session** (the append-only log of everything
> that happened), **a harness** (the loop that calls Claude and routes Claude's tool calls to
> the relevant infrastructure), and **a sandbox** (an execution environment where Claude can
> run code and edit files). This allows the implementation of each to be swapped without
> disturbing the others. **We're opinionated about the shape of these interfaces, not about
> what runs behind them.**

This is the answer to "what should a base framework be made of": three seams, not one object.
The same post documents the failure of coupling them: *"if a container failed, the session was
lost"*, and a harness bug, an event-stream packet drop, and a container outage *"all presented
the same"*.

## 2.3 Axis 3 - where the gate lives (the decisive axis)

This is where the frameworks actually differ, and where most of the verification effort went.

| System | Gate | Blocks before execution? | Grade |
|---|---|---|---|
| Pi `pi-agent-core` runtime | `beforeToolCall(ctx) -> { block, reason, terminate }` | **Yes.** `agent-loop.js:419-429` returns `kind:"immediate"`; `tool.execute()` is never reached. Holds in sequential and parallel modes. Runs after schema validation. | [V] read in compiled source + executed |
| Pi `AgentHarness` `before_tool` | none | **No.** Typed `(event: unknown) => unknown`, and `hooks.on` throws in the installed version. | [V] executed |
| OpenAI Agents SDK | `needs_approval` -> `RunResult.interruptions` -> `RunState.approve/reject` -> resume | Yes, but **asynchronously and out-of-process** | [V] docs verbatim |
| OpenAI input/output guardrails | tripwire | **Not by default.** `run_in_parallel=True` is the default and the doc states the agent *"may have already consumed tokens and executed tools before being cancelled"*. | [V] docs verbatim |
| **OpenAI tool guardrails** | `ToolGuardrailFunctionOutput` with `RejectContentBehavior` | **Yes, in-process.** Verbatim: *"Rejects the tool call/output but continues execution with a message to the model."* Source fetched by the main session: `openai-agents-python/src/agents/tool_guardrails.py`. **CORRECTED 2026-09-25** - the GitHub wave found this; the row above is about *input/output* guardrails only. | [V] source read |
| Google ADK | `before_tool_callback(tool, args, tool_context)` returning a truthy value; or `require_confirmation` | Yes, but **a falsy return (`None`/`{}`) does not stop the chain**, so a deny implemented as `{}` silently no-ops. Confirmation is **Experimental**. | [V] docs verbatim |
| LangGraph | `interrupt()` in the tool or an approval node | Yes, but **node-boundary only** - see 2.4 | [A] |
| MCP | **none** | No. `"MCP itself cannot enforce these security principles at the protocol level"`; the host's only lever is refusing to send `tools/call`. | [V] docs verbatim |
| dsh | `ctx.approval.request()` -> `'allowed-once' \| 'rejected' \| 'cancelled' \| 'unavailable'` | **Yes, fail-closed, with a closed outcome set**, enforced before waterfall dispatch so a later answerer cannot bypass it | [A] |

**Finding: only two of the surveyed systems expose a pre-execution, parameter-level, blocking
gate, and both are "you write it": Pi's `beforeToolCall` and dsh's approval service.** OpenAI
and ADK provide pause/resume machinery around it; LangGraph provides a node boundary; MCP
provides nothing and says so.

## 2.4 Axis 4 - resume granularity (the evidence-trail decision)

| System | Resume unit | Re-execution risk | Grade |
|---|---|---|---|
| ADK | invocation | **Documented**: tools run *"at least once, and may run more than once when resuming"*; the doc tells you to make the tool idempotent | [V] verbatim |
| LangGraph | super-step / node | **Documented**: *"the runtime restarts the entire node from the beginning"* | [A] |
| OpenAI | the paused run (`RunState`, serializable) | Sticky approvals survive `to_json`; the run continues where it left off | [V] verbatim |
| Microsoft Agent Framework | super-step checkpoints | checkpoints include pending requests/responses | [?] |
| Pi | session lane (`reduceLaneState`, `validateRecordLog`) | substrate implemented; **no shipped orchestrator** | [V] executed |

**Finding: at-least-once or node-restart semantics are the mainstream default.** The
requirement "resume without re-executing a completed side effect" is therefore **not inherited
from any surveyed framework** - it has to be built. For duplicate orders (trading) and duplicate
exploit execution (pentest) that is a hard requirement, so this is a genuine differentiator for
the user's framework rather than a nice-to-have.

## 2.5 Axis 5 - extension seam

| System | Seam | Note |
|---|---|---|
| ADK | `BasePlugin` registered once on the `Runner`; runs **before** agent callbacks | official guidance prefers Plugins over callbacks for policy [A] |
| Microsoft | middleware chains (agent-run, function-calling, chat-client) | `FunctionInvocationContext.Terminate = true` can kill the function-call loop [A] |
| dsh / Cordis | plugins with `inject` + `apply(ctx)`; `ctx.effect()`/`ctx.on()` are reversible | "Every part of the product is a plugin, including ... the agent loop itself" [A] |
| Pi `Agent` | constructor options (`streamFn`, `beforeToolCall`, `transformContext`, `shouldStopAfterTurn`, `prepareNextTurn`) | small, typed, and the whole surface | [V] |

## 2.6 Axis 6 - stability vs gate quality (a real tension)

| System | Gate quality | Stability signal |
|---|---|---|
| dsh / Cordis | **best found** (fail-closed, closed outcome set) | Cordis README: *"The API is not yet stable and may change without notice"*; dsh README: *"Developer preview ... THERE WILL BE COMPATIBILITY-BREAKING CHANGES"*; `latest = 0.1.5-rc.3` [A] |
| Pi | good (`beforeToolCall`) | mid-rewrite: two harness stacks in one package, one marked `./experimental/pico3`; the orchestrator is a stub in the installed version [V] |
| OpenAI | machinery, not a gate | SDK doc pages carry no version or date [A] |
| ADK | workable, Experimental confirmation | confirmation feature labelled Experimental with known limitations [V] |
| LangGraph | node-boundary | docs-level only here; not installed [A] |

**Finding: the best gate semantics and the worst API stability currently coincide in the same
project.** That is a design tradeoff to record explicitly rather than resolve by preference.

---

# Cross-cutting findings (each independently verified)

1. **"Guardrail" does not mean "gate" in mainstream docs.** Anthropic files guardrails under
   *parallelization/sectioning* ("one model instance processes user queries while another
   screens them"). OpenAI's guardrails default to running in parallel with the agent. Both are
   **screening**, not pre-execution enforcement.
2. **MCP has no in-protocol approval boundary, by design.** It standardizes transport, client to
   server OAuth 2.1, and elicitation, and explicitly delegates consent to the host. A blocking
   gate must live above the MCP client, in a loop you own.
3. **Pi's `effect-gate` is a cancellation gate, not an authorization gate.** Read in full: a
   three-state machine (`open` -> `aborting` -> `closed`) whose `admit(invoke)` only checks
   whether the pass was aborted. No policy, no approval, no deny path.
4. **Vendor production guidance argues against heavy frameworks.** Anthropic: *"Frameworks can
   help you get started quickly, but don't hesitate to reduce abstraction layers and build with
   basic components as you move to production."*
5. **Harness logic is perishable.** *"Harnesses encode assumptions that go stale as models
   improve"* - with a concrete case where a mitigation became *"dead weight"* one model
   generation later.
6. **The session must outlive the execution environment.** The "don't adopt a pet" post-mortem.
7. **Two of three surveyed SDK families own their loop and expose a real blocking gate; MCP
   owns neither.** So the "interop protocol" layer and the "enforcement" layer are different
   layers, and a framework needs both.

---

# Implications for the base framework

1. **Adopt the three-seam decomposition** (session / harness / sandbox). It is the vendor's own
   current architecture and it maps onto the user's "base framework + verticals" intent.
2. **Own the loop, thinly.** Every verified blocking gate is caller-supplied. Autonomy should be
   a per-task choice, not a framework property.
3. **Put the gate at the tool-dispatch boundary**, pre-execution, parameter-level, with a typed
   deny reason that reaches the transcript. Do not build it on "guardrails".
4. **Own effect idempotency.** No surveyed framework provides "do not re-execute a completed
   side effect". This is the single clearest differentiator for trading and pentest.
5. **Keep the session addressable independently of the runtime**, so a failed execution
   environment does not lose the log and failures remain layer-attributable.
6. **Support more than one orchestration shape** - "who holds the plan" is a per-task decision
   and the verticals will answer it differently.
7. **Isolate perishable logic** behind a removable seam, because harness assumptions rot.
8. **Treat a fail-closed gate with a closed outcome set as the target design**, since that is the
   strongest form found, and it is currently only available in the least stable project.

---

# Pending

- **Vertical requirements** (quant trading / code audit / pentest) - two sub-agents still running.
  Until they land, section 1.4 is inference from framework docs, not from the verticals' own
  regulatory and standards sources.
- **Community wave** - not started. It exists to challenge the taxonomy and the conclusions
  above, particularly findings 1-3 and the at-least-once claim.
- **Unverified items carried forward**: OpenAI's hosted "Agents API" (`developers.openai.com`
  returns 403); Microsoft Agent Framework API names; A2A v1.0.0 details; LangGraph's exact TS
  API spellings; the `pico3` `Forbidden` error's semantics; the set of `SliceNotImplemented`
  slices in 0.87.1 is resolved (only `watchSession`), but its behaviour is not.
