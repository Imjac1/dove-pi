# Verification log

Independent checks performed by the main session against sub-agent output. The point is
to establish which claims are load-bearing *and* verified, versus merely plausible.

- Date: 2026-09-25

## Operational discovery that makes verification possible

Several vendor doc sites are client-rendered SPAs. Fetching the HTML returns a shell with
no article text - a naive fetch produced a 23,503-character page whose text contained
**none** of the words `PreToolUse`, `deny`, `bypassPermissions`, `canUseTool`, or
`dontAsk`. That is a false negative, not a refutation.

Both of these sites serve a **plain-text twin** at the same path with `.md` appended:

- `https://code.claude.com/docs/en/agent-sdk/<page>.md`
- `https://modelcontextprotocol.io/specification/<revision>/<page>.md`

Each also advertises an index at `/llms.txt`. **Always fetch the `.md` twin for these
sites.** Recorded here because it cost a wasted verification round.

## Wave 1, agent "official workflow patterns" -> `official-workflow-patterns.md`

Verdict: **verified accurate on every claim spot-checked.** No fabrication found.

| Claim | Checked against | Result |
|---|---|---|
| Pattern set = augmented LLM + 5 workflows + agent | `anthropic.com/engineering/building-effective-agents` (fetched directly) | **Confirmed** - see `ground-truth-anthropic-building-effective-agents.md` |
| Six-step permission order: hooks -> deny -> ask -> permission mode -> allow -> `canUseTool` | `code.claude.com/docs/en/agent-sdk/permissions.md` | **Confirmed**, near-verbatim |
| "A `PreToolUse` hook allow also can't approve an `rm` or `rmdir` removal targeting a critical path" | same | **Confirmed verbatim** |
| "If a deny rule matches, the tool is blocked, even in `bypassPermissions` mode" | same | **Confirmed verbatim** |
| "Bare-name deny rules like `Bash` remove the tool from Claude's context before this evaluation begins, so only scoped rules like `Bash(rm *)` are checked at this step" | same | **Confirmed verbatim** |
| MCP: "While MCP itself cannot enforce these security principles at the protocol level, implementors SHOULD..." | `modelcontextprotocol.io/specification/2026-07-28/index.md` | **Confirmed verbatim** |
| MCP: "Hosts must obtain explicit user consent before invoking any tool" | same | **Confirmed verbatim** |
| MCP: tool annotations "should be considered untrusted, unless obtained from a trusted server" | same | **Confirmed verbatim** |
| Roots and Sampling are **deprecated** as of `2026-07-28` via SEP-2577, and "New implementations SHOULD NOT adopt it" | `.../client/roots.md` and `.../client/sampling.md` | **Confirmed verbatim on both pages** |

### One nuance worth recording

The deprecation notices are **not** on the spec index page - a search of
`specification/2026-07-28/index.md` for `deprecat`, `Roots`, and `Sampling` returns
nothing. They live on the individual feature pages. The agent's own caveat #6 said exactly
this (the client-feature index "lives only in `llms.txt`"), so its sourcing was correct;
my first check simply looked in the wrong place.

### Verbatim deprecation text, for the record

> **Deprecated**: The Roots feature is deprecated as of protocol version `2026-07-28`
> ([SEP-2577](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2577)).
> Under the feature lifecycle policy, it remains in the specification for at least twelve
> months after this revision's release before it becomes eligible for removal.
> New implementations **SHOULD NOT** adopt it; existing implementations **SHOULD**
> migrate to passing directories...

The Sampling page carries the identical notice, ending "SHOULD migrate to integrating
directly...".

## Still unverified from wave 1

- `### 5.4`'s `CLAUDE_SDK_CAN_USE_TOOL_SHADOWED` diagnostic and the full permission-mode
  table were not independently re-fetched; only the six-step order and the deny semantics
  were.
- The `### 5.10` isolation-technology table (Sandbox runtime / gVisor / Firecracker
  strengths) and the `@anthropic-ai/sandbox-runtime` claim were not re-fetched.
- `### 6.x` Agent Skills numbers (64-char name, 1024-char description, ~50-100 tokens per
  catalog entry, <5000 tokens per SKILL.md, <500 lines) were not re-fetched.
- The agent's flagged follow-up stands: the "Building effective agents" page carries a
  staleness banner pointing at **Claude Managed Agents**, which was not fetched and may
  contain the current statement of loop ownership.

## Wave 1, agent "framework forms (OpenAI/Google/Microsoft)" -> `official-framework-forms-openai-google-microsoft.md`

Verdict: **verified accurate on every claim spot-checked.** No fabrication found. This
agent's caveats were also honest and specific (blocked domains named, unverified surfaces
labelled).

| Claim | Checked against | Result |
|---|---|---|
| ADK Tool Confirmation is **Experimental**; `FunctionTool(tool, require_confirmation=True)` pauses the tool for a yes/no answer; structured/advanced confirmation exists | `adk.dev/tools-custom/confirmation/index.md` | **Confirmed** - page header reads "Supported in ADK Python v1.14.0 TypeScript v0.2.0 Go v0.3.0 Kotlin v0.1.0 Experimental" |
| ADK `before_tool_callback` signature is `(tool, args, tool_context)` | `adk.dev/callbacks/types-of-callbacks/index.md` | **Confirmed verbatim** in the callback-signature table |
| A returned value substitutes for the tool result; `None`/falsy does not stop the chain | same | **Confirmed, with a sharper nuance below** |
| ADK resume runs tools **at least once** and may run them more than once | `adk.dev/runtime/resume/index.md` | **Confirmed verbatim** |

### The ADK resume warning, verbatim (load-bearing)

> **Caution: Tool execution behavior**
> When resuming a workflow with Tools, the Resume feature ensures that the Tools in an
> agent are run ***at least once***, and may run more than once when resuming a workflow.
> If your agent uses Tools where duplicate runs would have a negative impact, such as
> purchases, you should modify the Tool to check for and prevent duplicate runs.

This is the single most important negative finding so far for this project's requirements.
It means **at-least-once tool execution is the mainstream framework default**, and
"resume without re-executing a completed side effect" is pushed onto the tool author. For
quantitative trading (duplicate orders) and penetration testing (duplicate exploit
execution) that default is unacceptable, so the base framework must own effect idempotency
rather than inherit it.

Also verbatim, on what resume actually reinstates:

> Event logging includes results from Tools which successfully returned a result. So if an
> agent successfully executed Function Tools A and B, and then failed during execution of
> tool C, the system reinstates the results from the tools A and B, and resumes the
> workflow by re-running the tool C request.

### Sharper nuance on the callback contract

The agent's phrasing ("returning a dict skips the tool ... return `None` not `{}`") is
correct but the underlying rule is worth recording exactly:

> The six `before_`/`after_` agent, model and tool hooks stop only on a *truthy* value, so
> a callback returning `None`, or another falsy value such as an **empty `dict`**, lets the
> next one run.

So a gate implemented as an ADK callback must return a **non-empty** dict to take effect. A
gate that returns `{}` on "deny" silently does nothing. That is a footgun worth writing into
any adapter contract.

## Verified separately: the six dynamic-workflow patterns

The `claude.dev` blog post was fetched directly and its figure caption confirms:

> **FIG C** Six workflow patterns Claude composes from.
> alt: "Six workflow patterns as small diagrams: **classify-and-act, fanout-and-synthesize,
> adversarial verification, generate-and-filter, tournament, and loop until done.**"

There is also a real `<h3 id="classify-and-act">` heading, so the six names are page content,
not just alt text. This upgrades the earlier snippet-grade note in
`ground-truth-anthropic-managed-agents-and-workflows.md`.

## Wave 1, agent "framework forms (OpenAI/Google/Microsoft)" - OpenAI claims verified

The OpenAI SDK docs are reachable at `openai.github.io/openai-agents-python/` even though
`developers.openai.com` returns 403 from this environment.

| Claim | Checked against | Result |
|---|---|---|
| Input guardrails default to **parallel** execution and tools may already have run | `openai.github.io/openai-agents-python/guardrails/` | **Confirmed verbatim** |
| `needs_approval` on tools / `Agent.as_tool(..., needs_approval=...)` | `.../human_in_the_loop/` | **Confirmed verbatim** |
| `result.interruptions` -> `ToolApprovalItem` -> `result.to_state()` -> `state.approve/reject` -> `Runner.run(agent, state)` | same | **Confirmed verbatim** |
| Sticky decisions (`always_approve`/`always_reject`) survive `to_json`/`from_string` | same | **Confirmed verbatim** |

### Verbatim: guardrails are not a gate by default

> **Parallel execution** (default, `run_in_parallel=True`): The guardrail runs concurrently
> with the agent's execution. This provides the best latency since both start at the same
> time. However, **if the guardrail's tripwire is triggered, the agent may have already
> consumed tokens and executed tools before being cancelled.**
>
> **Blocking execution** (`run_in_parallel=False`): The guardrail runs and completes
> **before** the agent starts. If the guardrail tripwire is triggered, the agent never
> executes, preventing token consumption and tool execution.

So the vendor's own default admits that a tripwire may fire *after* tools have run. Any
gate built on guardrails must set `run_in_parallel=False`, and even then guardrails do not
cover hosted tools, built-in execution tools, handoffs, or `Agent.as_tool()`.

### Verbatim: the approval flow

> `result.interruptions` (or `RunResultStreaming.interruptions`) contains
> `ToolApprovalItem` entries with details such as `agent.name`, `tool_name`, and
> `arguments`. ... Convert the result to a `RunState` with `result.to_state()`, call
> `state.approve(...)` or `state.reject(...)`, and then resume with
> `Runner.run(agent, state)` ... The resumed run continues where it left off and will
> re-enter this flow if new approvals are needed.

Note the shape difference from ADK and from Pi: OpenAI's gate is **asynchronous and
out-of-process** (the run pauses, serializes, and a different process resumes it), whereas
Pi's `beforeToolCall` is a synchronous in-loop callback. For an evidence trail, OpenAI's
pause is itself a durable artifact (`RunState`), which is a real advantage; the cost is that
"the gate" is no longer a single function you can reason about locally.

## Wave 1, agent "framework forms (graph/runtime)" -> `official-framework-forms-graph-runtime.md`

Verdict: **code-level claims independently reproduced; the stub finding was upgraded from
static to executed.**

| Claim | Checked how | Result |
|---|---|---|
| `agent-loop.js` blocks the tool and never calls `tool.execute()` | read `dist/agent-loop.js` lines 410-435 | **Confirmed exactly**: `if (beforeResult?.block) { const result = createErrorToolResult(beforeResult.reason \|\| "Tool execution was blocked"); if (beforeResult.terminate === true) { result.terminate = true; } return { kind: "immediate", result, isError: true }; }` |
| `pi-coding-agent/dist/server/create-harness.js` routes into the stub | read the file | **Confirmed**: line 1 `import { AgentHarness, ... } from "@earendil-works/pi-agent-core";`, line 97 `const created = await AgentHarness.create({` |
| Pi's working product path is `AgentSession`, not the harness | listed `pi-coding-agent/dist/core/` | **Confirmed**: `agent-session.js`, `agent-session-runtime.js`, `agent-session-services.js` all present |
| `@earendil-works/pi-ai` ships a deterministic offline provider | listed `pi-ai/dist/providers/` | **Confirmed**: `faux.js` and `faux.d.ts` present |
| `AgentHarness` is a shipped stub | **executed** the module, not read it | **Confirmed at runtime** - see below |

### Execution proof of the stub (this is the one that matters)

A throwaway `.mjs` in `%TEMP%` imported the installed
`.../pi-agent-core/dist/index.js` and called the API. Output, verbatim:

```
AgentHarness.create -> OK, keys: [ 'harness', 'suspended' ]
hooks.on -> HarnessNotImplemented: AgentHarness.hooks.on is not implemented yet
events.on -> HarnessNotImplemented: AgentHarness.events.on is not implemented yet
prompt -> HarnessNotImplemented: AgentHarness.prompt is not implemented yet
resume -> HarnessNotImplemented: AgentHarness.resume is not implemented yet
watchSession -> HarnessNotImplemented: AgentHarness.watchSession is not implemented yet
runToCompletion -> HarnessNotImplemented: AgentHarness.runToCompletion is not implemented yet
getModel -> {}
```

Two details this pins down that static reading could not:

- `create()` **succeeds** against an empty session and returns `{ harness, suspended: [] }`. It
  only throws `HarnessNotImplemented("create.restore")` when the session already has a record.
  So the failure mode is "constructible but inert", not "cannot construct".
- The `hooks` and `events` registries throw on `.on(...)`. There is no way to attach a
  harness-level hook in the installed version at all.

### The architectural correction this agent made

The 08-27 research note treated the choice as "Pi harness vs `pi-agent-core` runtime". The
verified picture is three-layered:

| Layer | Status in the installed tree |
|---|---|
| `pi-agent-core` runtime loop (`Agent`, `runAgentLoop`) | **implemented**, `beforeToolCall` blocks |
| `pi-agent-core` session substrate (`JsonlSessionRepo`, `Session`, `reduceLaneState`, `validateRecordLog`, compaction, tools, `NodeExecutionEnv`) | **implemented** |
| `pi-agent-core` `AgentHarness` orchestrator | **shipped stub** |
| `pi-coding-agent` product path (`AgentSession`) | **implemented**, drives the runtime `Agent` directly |
| `pi-coding-agent` server path (`createCodingAgentHarness`) | **imports the stub** |

So "adopt the harness" is not an available option in the installed version, and Pi's own
product does not use it either. The usable foundation is the runtime loop plus the session
substrate, with a resume driver you write yourself.

## Community wave - verification of load-bearing citations

Verdict: **every load-bearing citation re-fetched was confirmed verbatim.** The community agents did
not fabricate. Two of them also corrected an earlier file of mine, which is recorded below.

| Claim | Checked against | Result |
|---|---|---|
| LIMBO: 25,930 episodes; 0.5% duplication on read-back; **56% and 74%** when read-back cannot reveal; "the contract explains 81%"; "no verification-only policy is exactly-once under late commits" | `arxiv.org/abs/2609.29095` | **Confirmed verbatim** |
| CapScope: *"ambient authority: naming a resource is sufficient to act on it"*; typed capabilities *"stored outside the model's context"*; injected effect **33-47/75** vs **3/75**; repairs 68/75 vs 68-72/75; **implemented on the Pi coding agent** | `arxiv.org/abs/2609.08371` | **Confirmed verbatim** |
| Agentless: three-phase pipeline, *"highest performance (32.00%, 96 correct fixes) and low cost ($0.70) compared with all existing open-source software agents"* on SWE-bench Lite | `arxiv.org/abs/2407.01489` | **Confirmed verbatim** |
| Anthropic: *"Individual agents are 'low variance'"*; *"when one agent makes a bad decision, it is likely that many agents will make that same bad decision"*; **18 of 30** agents chose the same branch name; *"The Cartographer's Last Commission"*; over half built ray tracers or self-hosting compilers | `anthropic.com/research/multiagent-systems` | **Confirmed verbatim** |

### Correction the community wave made to my own work

I had written in `ground-truth-community-security-evidence.md` that **"no duplicate-effect production
incident was found"**. That was an artifact of my corpus being **metadata-only** (the pages were
JS-rendered shells). The community agent read the bodies and found **measured** evidence. The file has
been corrected. **What survives:** still no *named company* double-charge incident - the evidence is
controlled measurement, shipped-framework contract violations, near-misses, and tooling-market
signals. That distinction is preserved deliberately.

### Corrections the community wave made to `design.md`

1. **"The sandbox is the control of last resort" - refuted.** Sandboxes are bypassable (DuneSlide
   CVSS 9.8; Heapjack/Overpatch), and so was the kernel-level enforcement proposed as the fix.
   `design.md` section 2.1 now specifies **layered controls with capability scoping outside the
   model's context as the strongest measured lever**.
2. **"Effect idempotency is a framework responsibility" - reframed.** The harness *"barely matters"*;
   the **tool contract** explains 81% of the variance. Section 5.2 now requires the effect identity to
   be used as an **idempotency key the backend honours**, with **consume-once in a shared store** on
   the read path (concurrent resume fires the effect k times in 36/40 cells, across hosts).
3. **Gate inputs must be canonicalised on both sides.** New section 4.2 requirement: resolve symlinks,
   `..`, and pseudo-paths on **both** the decision string and the human-visible string, and fail
   closed if they differ - GhostApproval is exactly that failure.

### Two new design principles adopted

- **"Authority Is Not a String"** (the title of arXiv 2609.08371). Ambient authority - naming a
  resource being sufficient to act on it - is the root vulnerability that prompt injection exploits.
- **Declare *and* enforce.** arXiv 2605.18583 measured a real gate benefit (5.4-27.7% out-of-scope
  actions versus 0.2-4.5%), but removing the *consent declaration* alone raised the rate from 0.0% to
  17.1%. Part of the benefit is the agent being told the boundary. A framework that only enforces
  silently gives up that half.

## Method note

Verification is targeted, not exhaustive: the claims re-fetched are the ones the design
decision turns on. Claims that only add colour are left labelled as agent-reported.
