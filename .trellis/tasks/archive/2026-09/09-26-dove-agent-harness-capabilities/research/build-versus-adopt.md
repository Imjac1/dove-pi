
# Research: should this project build its own harness at all?

- **Query:** the adversarial question nobody else in this task's research has asked - is building a base agent
  harness the right move? What do named engineers and teams say against it, what does a team actually buy by
  building, what does the maintenance record show, what do the SDKs give you in code, is there a documented
  hybrid, and which of this repository's unwired modules are genuinely not obtainable off the shelf?
- **Scope:** (a) the build-versus-adopt discourse, searched adversarially; (b) four SDKs read at the interface
  level (Claude Agent SDK, OpenAI Agents SDK, Google ADK, LangGraph); (c) the maintenance record of six named
  projects; (d) the empirical harness literature published in 2026; (e) this repository's own unwired modules,
  read from source.
- **Date:** 2026-09-26. **Author:** research sub-agent for task `09-26-dove-agent-harness-capabilities`.
- **Read first (in-repo, and not repeated here):** `prd.md`; `research/harness-shape-and-prior-art.md`;
  `research/harness-gates-and-conventions.md` (grepped); `research/harness-resumption-and-self-check.md`
  (grepped); `research/harness-agents-and-subagents.md` (grepped); `research/ground-truth-what-runs.md`;
  `research/gates-what-they-get-right.md`; `research/correction-which-layer-has-a-gate.md`;
  `research/synthesis-two-layers-vs-frontier.md`; `research/two-layers-and-the-seam.md`;
  `research/design-constraints-from-evidence.md`; `research/cross-cutting-finding.md`.

## Fetch methods actually used (recorded because earlier waves failed here)

| Method | Result |
|---|---|
| `raw.githubusercontent.com/<o>/<r>/<ref>/<path>` | **worked**, and was the primary code source. Intermittent `TypeError: fetch failed`; every fetch below was retried up to 3-4 times and succeeded. A 100,000-character cap truncates large files. |
| `data.jsdelivr.com/v1/packages/gh/<o>/<r>@<ref>?structure=flat` | **worked; the best tree method found.** Full file list with sizes, no GitHub rate limit. Truncates at 100,000 chars alphabetically, so late-alphabet paths can be missing. |
| `ungh.cc/repos/<o>/<r>`, `/releases`, `/files/<branch>` | **worked** for stars, `pushedAt` and releases. Began returning `429` after ~14 calls. `/files` returns cross-origin-redirect errors for file *content*. |
| `hn.algolia.com/api/v1/search`, `/items/<id>` | **worked; the single most valuable source for the discourse.** `tags=comment,story_<id>` retrieves a thread's comments and sidesteps the 100,000-char cap. `/items/<id>` fails on large threads (same cap, breaks JSON parsing). |
| `img.shields.io/github/license/<o>/<r>.json` | worked for licences. |
| `web_fetch` on ordinary HTML pages | worked (Anthropic blog, lilianweng.github.io, arxiv, pi.dev, earendil.com, raw .md files). |
| **`api.github.com`** | **unusable: `403 API rate limit exceeded for <shared IP>`.** Exhausted before this session began. Any research instruction to "spend the API budget on trees" is void here; use jsdelivr's data API instead. |
| **`web_search` / `x_search`** | **unusable all session: Firecrawl keyless `429`**, on every query. The HN Algolia API replaced both. |
| `cdn.jsdelivr.net/gh/...` | **failed** - `unsupported content type "application/octet-stream"` for `.py`, and `404` for files that do exist on `main` (see the Letta note under "Could not verify"). |
| `lite.duckduckgo.com` | `fetch failed`. |

---

## What the sources state

### The strongest argument that this project should NOT build its own harness

Stated as strongly as its proponents state it, then held against evidence. This is the case the project has
not yet had to answer.

### The four pillars of the case against building

**1. "Build your own harness only works if you can keep pace with the API changes underneath. Most teams
can't, so they land back on a hosted abstraction."** - `fen_wick`, Hacker News, 2026-09-11, on the OpenAI
Agents API launch thread [FETCHED]. This is the sharpest formulation found, and it is a *maintenance* argument,
not an architectural one.

**2. Generational obsolescence: a harness is a bet on the current model's weaknesses.** `tokioyoyo`, same
thread [FETCHED]: "the harness will always be dependent on the underlying model, and useless without it. All
custom harnesses ... could be obsolete in the next big-generation-jump of the models ... investing in a custom
harness might be a bad resource allocation." The laboratory-side version is the strongest single citation in
the whole corpus and it comes from a harness vendor: Anthropic's Managed Agents write-up states that context
resets added to their harness to fix "context anxiety" in Sonnet 4.5 were dead weight on Opus 4.5, and
concludes **"Harnesses encode assumptions that go stale as models improve"** ([PRIOR] - this task's earlier
survey fetched it on 2026-09-26; I did not re-fetch it). Lilian Weng, in the most-discussed harness essay of
2026 (334 pts on HN), points the same way: **"Eventually it is possible that many harness improvements will be
internalized into core model behavior"** [FETCHED].

**3. Zero moat.** `pornel`, HN 2026-08-04, on the Lilian Weng thread [FETCHED]: "A basic consumer-oriented
harness is a commodity (zero moat: you can ask one harness to write you another). State-of-the-art models have
more of the workflow sensibilities built in, and don't need as much help from the harness." For *this* project
the moat question is concrete: the harness is not the product. The verticals are.

**4. A base harness may be the wrong unit.** `nicce`, HN 2026-09-11 [FETCHED]: "To have a really good
harness, it seems that you need a separate one for every different project you are working with." This project
is building one vertical-agnostic base for three verticals (audit, quantitative trading, penetration testing)
whose *form is undecided*. The stronger form of the objection: what makes a harness load-bearing in trading
(SEC Rule 15c3-5 pre-trade thresholds) and in penetration testing (NIST SP 800-115 rules of engagement) is the
verticals' requirement - and this task has explicitly deferred the verticals.

### Two further objections that are specific to this repository

**5. The harness vendor's own definition of "harness" excludes the thing this project wants to own.** Earendil
Inc. - the vendor of Pi, the harness this repository's `src/pi-adapter/extension.ts` runs inside - defines an
agent harness as four things: a system prompt, a set of tools, the agentic loop, and a model-translation layer
[FETCHED, https://earendil.com/posts/what-is-a-harness/, 589 pts on HN]. **A gate, a permission boundary, an
evidence plane and an acceptance model are in none of the four.** If that definition is right, "we are building
a harness" is a category error: the loop and the translation layer are commodity, and what is actually being
built is a boundary-and-evidence layer that sits *inside* somebody else's harness. Naming it correctly changes
the plan - it argues for *not* growing `loop.ts` and `loop-runner.ts`.

**6. The empirical literature measures the layers this project is NOT differentiating on, and does not measure
the layers it IS.** arXiv 2609.20804, *An Empirical Study of Harness Design for Coding Agents* (17 Sep 2026,
43 pages, 176 matched settings, 4 models, SWE-Bench Verified + Terminal-Bench 2.1) [FETCHED] fixes the
execution loop and varies exactly three components: **planning, action space, context management**. Findings:

- context management's value grows as the context budget tightens, "with most of its benefit coming from
  preventing context-overflow failures";
- "Staging rule-based elision before LLM-based summarization provides the strongest overall efficiency";
- **"making elided content recoverable adds machinery that models rarely use and yields no accuracy gain"**;
- planning "shifts from an accuracy scaffold for weaker models to a cost saver for stronger models, with little
  change in accuracy";
- with a bash-only interface, bash-capable models "achieve substantially lower cost, especially on
  command-line-centric tasks".

Read adversarially against this project: the study's negative result - recoverable elided content is machinery
models rarely use - is aimed directly at `context-admission.ts`'s design (raw payload absent from the
transcript, full text kept reachable through an `ArtifactSink`). And the three varied components map onto
capabilities 2 and 8 of the nine, not onto the gate, the effect ledger or verification. **There is no
component-level empirical evidence that building the gate/effect/verification layers pays.** Every positive
result is in a layer that is obtainable off the shelf.

And the strongest *pro*-harness empirical headline attenuates on replication. "Improving 15 LLMs at Coding in
One Afternoon. Only the Harness Changed" (832 pts, Feb 2026) is the most-cited claim that the harness dominates
the model; in that thread an independent replication reports ~17% raw cost reduction / ~25% per correct answer,
attributes it to "the overhead of harness itself in tool descriptions and schemas", and adds "Hashline is not an
improvement that speaks for itself" [FETCHED, HN 46988596]. A second commenter argues the benchmark
"deliberately sidesteps the actual intelligence of the model". So the loudest pro-harness number is, on
replication, a **token-overhead** result, not an intelligence result.

### What the evidence supports, and what it refutes

| Pillar | Verdict |
|---|---|
| 1. API churn makes building unsustainable | **Partly supported, and the sharpest version cuts both ways.** Verified churn: `openai/openai-agents-python` was at v0.17.1 on 2026-05-11 in this task's prior survey and is at **v0.22.3, published 2026-09-17** (ungh releases [FETCHED]) - ~5 minor releases in 4 months on a 0.x line, with release notes that include behavioural approval changes ("align conditional approvals with validated tool arguments"). The counter-argument, from a practitioner arguing *for* ownership (`sbysb`, quoting the pi.dev author): what hurts is the labs **rewriting the system prompt underneath a hosted harness** - "changes the sand beneath your feet with every update" [FETCHED]. Note what this implies: **prompt-layer churn is something you own none of either way; provider-API churn is concentrated in the loop and the model-translation layer.** That is an argument for renting the loop and owning the boundary - not for building the whole harness, and not for wholesale adoption. |
| 2. Generational obsolescence | **Supported as a range restriction.** A harness that encodes model-specific tricks is perishable. A boundary that encodes a *contract* - a threshold, a scope, an idempotency key - is not; it is the thing the vertical's regulator or venue cares about and it survives the model swap. `effect-ledger.ts`'s own docstring draws exactly this line when it requires the key to be one "the backend honours". |
| 3. Zero moat | **Refuted for this project's purpose, by a named authority with a commercial bias.** Guy Podjarny (founder of Snyk, founder of Tessl) on the Lilian Weng thread [FETCHED]: "Consistency is about guardrails. The harness shines here, as it takes control away from the model, moving it to hooks that force certain paths, or require the use of deterministic tools for certain steps." A trading vertical does not need a better answer; it needs the same answer twice. Bias noted: he sells spec tooling - but the claim is about control, not authorship. |
| 4. Wrong unit | **Supported as a design warning.** Real risk. Mitigation is the prior survey's rule: one gate interface, N semantics behind it. |
| 5. The definition excludes the boundary | **Supported, and it is an argument for this project's work, not against it.** Every SDK read has a tool-call seam; none has a boundary contract; and the one harness vendor's four-part definition omits it. Nobody's definition includes it because it is the part nobody has built. |
| 6. No empirical support for the layers we would own | **Supported and unrefuted.** This is the honest cost of the plan and should be recorded as such: the gate, effect and verification layers would be built on argument and code quality, not on a measured performance delta. |

---

## What I read in code

### Claude Agent SDK - `anthropics/claude-agent-sdk-python` (MIT, 8,167 stars, pushed 2026-09-25)

Files read: `src/claude_agent_sdk/types.py` (92,988 chars, read in sections), `src/claude_agent_sdk/_internal/query.py`
(56,747 chars, grepped); file list via jsdelivr.

**Can you supply your own gate? Not as the only gate - and the SDK says so in its own type.**
`CanUseTool = Callable[[str, dict[str, Any], ToolPermissionContext], Awaitable[PermissionResult]]` (types.py:277),
where `PermissionResult = PermissionResultAllow | PermissionResultDeny` (types.py:275). But the docstring of
`ClaudeAgentOptions.can_use_tool` (types.py:2157-2173) is a coverage defect stated in the vendor's own words:

> "Invoked when the CLI's permission rules evaluate to 'ask' for a tool call - it is the SDK replacement for the
> interactive permission prompt. **It is *not* invoked for tool calls already permitted by `allowed_tools`**
> ... **a hook returning an *allow* decision also skips this callback.**"

And the SDK ships a warning class for exactly this: `CanUseToolShadowedWarning` - "can_use_tool is set but some
tool calls are **auto-approved before it runs**" (types.py:1834-1840), with a matching process warning code in
the TypeScript SDK (`CLAUDE_SDK_CAN_USE_TOOL_SHADOWED`). [INFERENCE] This is code-level proof that an
off-the-shelf tool-call gate is a *fallback*, not an exhaustive boundary - this project's constraint C3 ("every
action class must be shown to pass through the same evaluation") failing in a shipping product, named by its
vendor.

**Hooks** exist per event (`PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `UserPromptSubmit`, `Stop`,
`SubagentStop`, `PreCompact`, `Notification`, ...) with `HookMatcher(matcher, hooks, timeout)` and a
default timeout of 60 s (types.py:605-618). `PreToolUseHookInput` carries `tool_name / tool_input /
tool_use_id` (types.py:332-338) - **the hook's subject is a model tool call**, the same surface as this
repository's gates.

**Can you supply your own persistence? A *mirror*, not the model.** `SessionStore` and
`ClaudeAgentOptions.session_store` (types.py:2402): "**Mirror** session transcripts to an external store. When
set, every transcript line written locally is also passed to `session_store.append()`, and `resume` can
materialize from the store **when the local file is absent**." The entry type is deliberately opaque:
`SessionStoreEntry` is "the CLI's on-disk transcript format ... That union is internal, so this is a minimal
structural supertype - **adapters should treat entries as pass-through blobs**" (types.py:1536-1552). And the
durability contract is best-effort, stated in the failure message (types.py:1283-1289): "**Non-fatal** - the
local-disk transcript is already durable, so the session continues unaffected. The failed batch has been dropped
(retries exhausted, or a single attempt timed out) ... **A timed-out `append()` may still land.**"

[INFERENCE] That is the opposite of an effect ledger on every axis: appends may be **lost** or **duplicated**,
the run continues either way, and the store is forbidden from interpreting the log.

**Can you supply your own loop? No.** The SDK is a transport over a `claude` subprocess:
`src/claude_agent_sdk/_internal/transport/subprocess_cli.py` is the only transport. The loop, the tool dispatch
order, the permission-rule evaluation and the transcript file all live in the CLI. Resumption is by session id
("Session ID to resume. Loads the conversation history from the specified session", types.py:2039) with
`fork_session` and `resume_session_at`: the SDK chooses what to *replay*, not what to *recompute*.

### OpenAI Agents SDK - `openai/openai-agents-python` (MIT, 29,707 stars, pushed 2026-09-25)

Files read: `src/agents/tool_guardrails.py` (8,454 bytes, in full), `src/agents/memory/session.py` (7,840),
`src/agents/run_config.py` (26,878), `src/agents/run.py` (first 100,000 chars, i.e. truncated); file list via
jsdelivr.

**Your own gate: yes, as a first-class seam, with a documented ordering subtlety.**
`ToolGuardrailFunctionOutput.behavior` is a union of `RejectContentBehavior` ("Rejects the tool call/output
but continues execution with a message to the model"), `RaiseExceptionBehavior` and `AllowBehavior`
(tool_guardrails.py:39-56). The asymmetry the prior survey flagged is confirmed in code: `AllowBehavior` is
the non-interference default, and `RunConfig.tool_execution` adds
`pre_approval_tool_input_guardrails: bool = False` with the docstring "Run function tool input guardrails
**before emitting a pending approval interruption**. The same guardrails still run again immediately before tool
execution after approval." (run_config.py:135-160). [INFERENCE] By default a pending approval can be emitted
before the tool's own input guardrail has run; the pre-execution evaluation still happens, so this is not
fail-open, but it is a second hazard of the same family as this project's C4.

**Your own persistence: yes, structurally typed.** `Session` is a `runtime_checkable Protocol` with
`session_id`, `get_items(limit)`, `add_items(items)`, `pop_item()`, `clear_session()`; its docstring
says "**Third-party libraries should implement the Session protocol instead**" of the internal `SessionABC`
(session.py:51-106). But the contract is *conversation history* - a list of `TResponseInputItem`s. No effect
identity, no claim/commit, no idempotency key, no cross-process atomicity. The prior survey counted ten shipped
backends; the interface is the stable part, the semantics are transcript-only.

**Your own loop: no.** `Runner.run` / `run_sync` / `run_streamed` are `classmethod`s (run.py:258-468)
delegating to an internal `AgentRunner.run` -> `_run_impl` (run.py:547-589). The extension surface is
`RunConfig` (run_config.py:353-505): model, model provider, guardrails, tracing, `session_input_callback`,
`call_model_input_filter`, `tool_error_formatter`, `sandbox`, `tool_execution`, plus `RunHooks`. There
is no injectable loop. [INFERENCE] Subclassing `_run_impl` is possible in Python and unsupported; it is not a
seam.

**One code-level find worth carrying, because it is this project's C1 in the vendor's own comment.**
`SandboxRunConfig.manifest` (run_config.py) says: "**Dictionary inputs cannot authorize local host sources or
extra path grants.** Configure these on a trusted `Manifest` instance **after validating the host paths in
application code**." The OpenAI SDK is warning that authorization configuration must not be a shallow,
unvalidated mapping - the CVE-2025-59532 shape (a model-generated path consumed as trusted configuration). It is
the strongest available evidence that C1 rule 2 is a live, recognised class in 2026.

### Google ADK - `google/adk-python` (Apache-2.0, 21,649 stars, pushed 2026-09-26)

Files read: `src/google/adk/sessions/base_session_service.py` (7,899 chars),
`src/google/adk/plugins/base_plugin.py` (14,074), `src/google/adk/plugins/plugin_manager.py` (14,341),
`src/google/adk/flows/llm_flows/base_llm_flow.py` (25,400, grepped).

- **Persistence: pluggable, via ABC.** `BaseSessionService(abc.ABC)` with abstract `create_session`,
  `get_session`, `list_sessions`, `delete_session`, and a concrete `append_event(session, event)` whose
  docstring names the one concurrency hazard it does address: "**StaleSessionError: When a persistent
  implementation detects that the supplied session has been superseded by a newer stored revision.**"
  [INFERENCE] Optimistic concurrency on session revisions is not an effect contract: it prevents a lost update
  to a transcript, not a duplicated order.
- **Gate: a callback returning `Optional[dict[str, Any]]`.** `PluginManager.run_before_tool_callback(...)`
  and the plugin base class expose `before_tool_callback` / `after_tool_callback` alongside
  `before_run_callback`, `on_event_callback`, `after_run_callback` (base_plugin.py:113-199). The prior
  research's finding that a deny written as `{}` silently no-ops because `{}` is falsy comes from ADK
  documentation; **I could not locate the consumer that tests truthiness** - see "Could not verify". What I did
  verify is the shape: the seam exists and it is keyed on the tool call.
- ADK's `Runner` loop internals were not read this session.

### LangGraph - `langchain-ai/langgraph` (MIT, 42,313 stars, pushed 2026-09-26)

Files read: `libs/checkpoint/langgraph/checkpoint/base/__init__.py` (30,665 chars, grepped),
`libs/langgraph/langgraph/pregel/main.py` (first 100,000 chars), `libs/langgraph/langgraph/pregel/_loop.py`
(82,055 chars, grepped).

**Persistence: the most complete pluggable interface of the four, and explicitly two-phase.**
`BaseCheckpointSaver(Generic[V])` declares `get_tuple`, `list`, `put(config, checkpoint, metadata,
new_versions)`, **`put_writes(config, writes, task_id, task_path)`**, `delete_thread`, plus async variants
(checkpoint/base/__init__.py:176-473). The `put` / `put_writes` split is a claim/commit-shaped surface, and
`Pregel.get_state` reconstructs from `saved.pending_writes` (pregel/main.py:1229-1254).

**Loop: you own it, by writing the graph - and the engine is at-least-once per task.** `Pregel` "manages the
runtime behavior for LangGraph applications" (pregel/main.py:449); the step engine is `PregelLoop`
(pregel/_loop.py:157). The mitigation for a resumed run is a *re-application* of saved writes:
`_reapply_writes_to_succeeded_nodes` "Restore successful channel writes from checkpoint to in-memory tasks.
**Skips control signals (ERROR, ERROR_SOURCE_NODE, INTERRUPT, RESUME)**", with the surrounding comment
explaining that without it "the runner (which executes only tasks where `not t.writes`) would re-run the
original node" (pregel/_loop.py:735-757). [INFERENCE] The durability unit is the **task/super-step**, and a task
that performed a side effect and then failed is re-executed; completed siblings are protected by saved writes,
not by an effect identity. This is what the prior research called "at-least-once at the node boundary", now read
at the call site.

**Gate:** LangGraph has no gate primitive; the documented patterns are a node that decides, or `interrupt()`
placed inside the tool. The prior survey read `libs/checkpoint-conformance/` as the only place that treats the
checkpoint store as a conformance-tested interface - **I did not re-read it.**

### This repository's own unwired modules (source read this session)

Read in full for their surfaces: `src/core/effect-ledger.ts` (258 lines), `src/core/checkpoint.ts` (139),
`src/core/context-admission.ts` (138). Quoted below only where the property being compared is stated in code.

---

## Which of this project's unwired work is not obtainable off the shelf

The prior research records that one agent answered this for the effect ledger. Extended to the rest, from code
compared against the four SDKs read above.

**1. `effect-ledger.ts` - not obtainable, and the gap is wider than "exactly-once".** Its own docstring states
three mechanics no SDK has: (a) `EffectStore.claim` must be **atomic across processes**, because "a `has()`
check followed by a `record()` write cannot prevent" the cross-host duplicate; (b) the derived key is "**the
idempotency key the backend must honour**" and is *handed to the executing tool*, so the guarantee lives in the
venue's contract and not in local bookkeeping; (c) `toClientOrderId` maps that identity onto a **venue's**
field under the venue's own constraints ("Binance documents `newClientOrderId` as
`^[\.A-Z\:/a-z0-9_-]{1,36}$`"). Add the asymmetric default - a claimed-but-uncommitted effect is **not
retried** unless the caller explicitly opts in - and per-engagement isolation enforced in code ("A ledger refuses
a record whose engagement differs from its own"). Cross-reference: the Claude SDK's `SessionStore` is the
closest off-the-shelf persistence surface, and its stated failure mode is *dropped or late appends that do not
stop the run* - precisely the defect this module exists to prevent. **Verdict: build. Nothing off the shelf is
even the same category.**

**2. `checkpoint.ts` - the mechanics are obtainable; the unit and the guard are not.** Obtainable: a graph
signature hash and explicit lineage already ship in Microsoft's `WorkflowCheckpoint` (`graph_signature_hash`,
`previous_checkpoint_id`, per the prior survey), so `computeGraphSignature` and `previousCheckpointId` are
not novel. Not obtainable: the **unit** - "an effect that was admitted and completed, not a model turn ...
Checkpointing on turns is why the surveyed frameworks end up re-running side effects" - and the requirement that
the signature cover the **gate and the mode**, so that "a checkpoint taken under one tool set, mode version, or
gate must not be resumed under another". LangGraph's unit is the task/super-step; MAF's is the workflow step;
Claude's is the transcript line. None of the four puts gate identity in the resume guard, and none returns
**refusals rather than warnings** on a mismatched resume. **Verdict: the guard and the unit must be ours; the
store interface is a solved shape (copy LangGraph's `put`/`put_writes` conformance-tested interface).**

**3. `context-admission.ts` - not obtainable at all; and one of its sub-properties is contradicted by the only
relevant study.** No SDK read offers a *channel-complete* admission boundary. What exists is compaction and
trimming: the Claude SDK's `PreCompact` hook event, the OpenAI SDK's session-side compaction. Both are opt-in
transformations of content that is already going into the transcript. This module's two stated non-negotiables
are the opposite: (1) "**The raw payload never appears in model-visible content.** Not truncated-and-included -
absent."; (2) generated and vendored trees "are not actionable context". And its enforcement claim - "Every
channel goes through here. **There is no parameter that turns it off**, because the recorded incident was caused
by a path that had one" - has no analogue in any SDK, whose guardrail surfaces all default to permissive. Its
motivating incident is local and measured: a 2,865,326-character tool result, ~95% of a session's tool-result
text, reaching the model through a background/custom-message path that bypassed tool-result compaction.
**Caveat with teeth:** arXiv 2609.20804 finds that "making elided content recoverable adds machinery that models
rarely use and yields no accuracy gain" - so the boundary is defensible and the recoverability link
(`ArtifactSink`) is the one part the single available component-level study argues against. **Verdict: build
the boundary; re-justify the artifact sink.**

**4. The gates (`gate-limit.ts`, `gate-conformance.ts`) - the seam is obtainable everywhere; the semantics,
the default and the coverage are not.** Every SDK read has a pre-execution tool-call seam keyed on
`(tool, arguments)`: Claude's `can_use_tool` + `PreToolUse`, OpenAI's `ToolInputGuardrail`, ADK's
`before_tool_callback`, LangGraph's node / `interrupt()`. So "can I supply my own gate" is answerable
**yes** - which is an argument for adopting a loop. What is not obtainable: (a) this code's ground - a missing,
non-numeric or non-finite argument is a **block**, and a limit with neither `max` nor `min` is rejected at
construction; (b) **two** semantics behind one interface, because "A framework offering only one of the two
forces the other vertical to bypass it"; (c) coverage of the harness's **own subprocesses**, which C1's six CVEs
establish is where every real bypass went, and which no SDK read addresses because in every SDK read the harness
*is* the parent process. The Claude SDK's `CanUseToolShadowedWarning` is the decisive citation that the
off-the-shelf gate is not exhaustive. **Verdict: our semantics and our default; and the subprocess-coverage
question is a negotiation with Pi, not a module.**

**5. `task-convergence.ts` - not obtainable; no SDK has an acceptance model.** None of the four exposes
anything resembling criteria, observables, an acceptance revision or a terminal-state reducer; the closest
surfaces in the market are declarative kits that are not running harnesses (the prior survey's finding). The
prior research also found the concrete hole to fix before wiring: `acceptance.passed` takes **optional**
evidence refs, so a pass need not be backed by anything. **Verdict: build, and make the evidence refs mandatory -
that is what converts "done" from prose into a check.**

**6. The loop (`loop.ts`, `loop-runner.ts`, `adapters/loop-pi-agent-core.ts`) - not only obtainable, it is
already obtained.** This is the adversarial conclusion of this file: the loop is the one part of the unwired
layer that should probably be **deleted rather than wired**. Pi (Earendil, `earendil-works/pi-coding-agent`)
is the process this repository already runs inside; it is a "minimal agent harness" with four modes
("interactive, print/JSON, RPC, and SDK"), and its documented position is "Pi ships with powerful defaults but
**skips features like sub-agents and plan mode**. Ask Pi to build what you want ... It will customize itself on
the fly." [FETCHED, pi.dev]. A project-owned loop alongside Pi is the two-implementations-one-contract failure
the PRD already names as its top risk - at the scale of the loop.

---

## What is transferable to a harness

1. **The hybrid is the right shape, and this repository is already inside one - but nobody has published the
   complete version.** What *is* documented: using a harness SDK for the loop while supplying your own callback
   is the intended pattern - Anthropic: `can_use_tool` is "the SDK replacement for the interactive permission
   prompt"; a practitioner: "You can use the harness sdks instead of the model APIs directly. Eg if you use
   Claude agent sdk you still can have plan mode, questions, todo lists, sub agents, background tasks,
   workflows" (`Bockit`, HN 2026-09-11 [FETCHED]). What is **not** documented anywhere I could find: an SDK
   loop plus an independent effect ledger plus an admission boundary, with the boundary's coverage of the SDK's
   own subprocesses stated. So there is no published proof the full hybrid works - and no published refutation
   either. The honest reading: **the hybrid is the only plan with off-the-shelf support for its first half and
   no counter-example.**
2. **Take off the shelf:** the loop and its turn boundaries; provider/model translation; tool schema plumbing;
   the TUI and session UX; transcript persistence; subagent *spawning mechanics*; MCP client transport;
   conventions-as-context. All four SDKs ship at least these, and the empirical study's positive results
   (context budgeting, rule-based elision, planning-as-cost-saver, predefined tools for weak-bash models) are
   largely obtainable there too.
3. **Own:** the gate semantics, the fail-closed default and the coverage argument; the effect identity, the
   atomic claim and the backend idempotency-key mapping; the checkpoint unit and the gate-in-signature refusal;
   the admission boundary with no off-switch; the acceptance reducer with mandatory evidence refs. That is five
   artifacts, not a harness.
4. **Put the boundary where the SDK cannot shadow it.** The pattern to copy from the Claude SDK's own defect:
   never evaluate a permission decision *only* where a vendor's rule engine can pre-empt it. This project's C3
   ("deny must not be overridable by the allow channel") is the same requirement, and
   `CanUseToolShadowedWarning` is the shipping proof that a vendor will pre-empt you and only warn.
5. **Keep vertical semantics behind one interface.** The prior survey's rule - one gate interface, N semantics -
   is the answer to `nicce`'s "a separate harness per project". The verticals' *form* is undecided, so what
   must be vertical-agnostic is the interface and the evidence schema, not the criteria.
6. **The two hard things are confirmed hard, and confirmed unbought.** Exactly-once effects: no SDK; LangGraph
   is at-least-once per task, Claude's store loses appends non-fatally, ADK guards a session revision. Context
   admission: no SDK; compaction is not admission. Verification: nothing in any SDK, and the empirical
   literature's own negative result about recoverable context is a warning that *more machinery* is not the
   same as *more signal*. Lilian Weng's constraint is the one to adopt verbatim as a design rule for any
   self-improving harness: "**The editable surface needs to be properly designed and the permission control and
   security layers need to live outside this loop.**" [FETCHED]

---

## A published case of a team that built a harness and regretted it?

**No first-person postmortem was found.** Stated plainly: I searched the build-versus-adopt discourse and did
not find a published "we built our own harness and it was a mistake" write-up. The closest documented regrets,
in descending specificity:

1. **A vendor, about a harness *feature***: Anthropic removed its own context-reset machinery after a model
   upgrade made it "dead weight" ([PRIOR], not re-fetched). Best-sourced case, and feature-level rather than
   project-level.
2. **A toolkit author, about a toolkit**: agent-os v3 "**stripped out 70% of the framework**" ([SNIPPET], prior
   survey).
3. **A practitioner, unnamed team, stated in passing** (HN 2026-09-08, "My Little AI Factory") [FETCHED]: "you
   and your team get the harness working, the models change, and suddenly you're back fixing things that worked
   last week ... we're shipping fixes to our own tooling instead of shipping value to the customers paying our
   salaries."
4. **A harness *author* naming anticipated regret** (HN 2026-09-11, "Nine coding harnesses vs. your laptop")
   [FETCHED]: "What I've found difficult with harness design is deciding which features are actually going to be
   useful, and which ones are cool-sounding ideas ... a maintenance burden that I'd regret adding."
5. **A general claim about this specific ecosystem** (HN 2026-07-21, "Annoying and alarming things about
   OpenCode") [FETCHED]: "the AI harness ecosystem is discovering the same thing any rapidly-growing software
   space did before it - **lines of code are a maintenance burden**."
6. **A structural criticism of bespoke harnesses** (HN 2026-08-16) [FETCHED]: many harnesses "are optimized for
   solving a specific issue well and the way they are tweaked is telling an LLM to do it. This resolves the need
   for natural extension points. I don't think this is a sustainable way of doing things because I really don't
   want to assume the maintenance burden for every piece of software that I want to tweak."

The asymmetry is itself the finding: **the inverse regret is far better documented.** Teams that adopted a
framework and removed it say so in public - "We've removed LangChain and LangGraph from our project at work
because they are lite[rally]..." (`iLoveOncall`, HN 2025-06-17) [FETCHED]; and on the one HN thread that asked
the question directly ("Ask HN: Do you roll your own agent or use a framework?", 2025-10-07 [FETCHED]) the
substantive replies are two rolled-own and one on LangGraph, with the rolled-own replies giving reasons: "Now we
roll our own, generally a much better and cleaner experience ... We essentially built our own internal framework
for our own use-case" (`jamesbriggs`, aurelio-labs) and "I wrote my own agent state machine in pretty much pure
async Python (no libs). Running successfully in prod with very few issues ... Don't bother compacting histories."

---

## The maintenance record: verified, refined, and one attempted refutation

Method: `ungh.cc/repos/<o>/<r>` for stars and last push, `ungh.cc/repos/<o>/<r>/releases` for release spans,
`img.shields.io` for licences, READMEs and specific paths over `raw.githubusercontent.com`. All figures are
2026-09-26 snapshots. **`api.github.com` was rate-limited to 403 before this session, so no commit history was
read; "last push" is `pushedAt` (any branch), which overstates activity for a repo whose default branch is
stale.**

| Repo | Stars | Last push | Licence | Releases | What it actually did | Did a dependant get hurt? |
|---|---|---|---|---|---|---|
| `openai/openai-agents-python` (read in code) | 29,707 | 2026-09-25 | MIT | **newest v0.22.3, 2026-09-17** | active; ~5 minor bumps since the prior survey's v0.17.1 (2026-05-11) | n/a - it is the successor |
| `anthropics/claude-agent-sdk-python` (read in code) | 8,167 | 2026-09-25 | MIT | none published via ungh | active; 15 source files | n/a |
| `google/adk-python` (read in code) | 21,649 | 2026-09-26 | Apache-2.0 | n/a via ungh | active | n/a |
| `langchain-ai/langgraph` (read in code) | 42,313 | 2026-09-26 | MIT | per-package tags; 30 spanning 2026-05-22 to 2026-09-23 | active monorepo | n/a |
| `openai/swarm` | 22,010 | **2026-04-15** | MIT | none | README: "Swarm is **now replaced by the OpenAI Agents SDK** ... **We recommend migrating to the Agents SDK for all production use cases**" | **Yes, by instruction.** Swarm was "under 1000 lines of Python"; anything built on it must be rewritten to the SDK's different primitives (`Runner`, `RunState`, `Session`). Third-party migration guides exist. |
| `microsoft/autogen` | 61,154 | **2026-04-15** | shields.io reports **CC-BY-4.0** (uncertain) | none via ungh | README badge **"Maintenance Mode"**: "It will **not receive new features or enhancements** and is **community managed** going forward ... contributions are limited to bug fixes, security patches, and documentation improvements." Successor: Microsoft Agent Framework 1.0. | **Yes.** AutoGen broke its own API once (the 0.2 -> 0.4 rewrite) and now freezes. A team on its orchestration must migrate to MAF's different model (`WorkflowCheckpoint`, middleware). |
| `letta-ai/letta` | 24,893 | 2026-09-10 | Apache-2.0 | n/a | README is a stub: "Letta (f.k.a. MemGPT) is actively developed. **The current source code lives in `letta-ai/letta-code`** ... includes the agent harness, interactive terminal UI, App Server, channels, and the runtime ... The **`archive` branch contains the retired Letta V1 API server**." Install is `npm install -g @letta-ai/letta-code`. | **Yes, and expensively.** A Python consumer of the V1 server must stay on an archived branch or move to a TypeScript SDK. The repo that carried 24.9k stars and the MemGPT paper is now a pointer. |
| `OpenHands/OpenHands` (was `All-Hands-AI/OpenHands`) | 89,203 | 2026-09-26 | MIT | none via ungh | repo id 771302083, created 2024-03-13; the tree I could list is TypeScript/Electron (`.agents/skills/...`, `__tests__/...`); the prior survey records the Python package and microagents as 404 and a pivot to "Agent Canvas", a host for ACP agents | **Yes** - the agent-loop-owning product was replaced by a host for other people's agents. |
| `Aider-AI/aider` | 49,193 | **2026-05-22** | Apache-2.0 | **newest v0.86.0, 2025-08-09** | README carries **no** deprecation, successor or maintenance notice | **Unresolved.** No announcement means no documented migration path either; a dependant is left to infer the state from silence. |
| `RooCodeInc/Roo-Code` (was `RooVetGit/Roo-Code`) | 24,297 | **2026-05-15** | Apache-2.0 | none via ungh | same repo id (881506708) under both owners - **the owner renamed**; README carries no deprecation notice | **Unresolved**, as Aider. |

**Verifying the prior research's claim that "the graveyard causes are mostly *product* change and *maintenance
stop*, not technical failure": confirmed, with one correction, one addition, and one failed refutation.**

- **Confirmed:** swarm (productization), letta (re-architecture plus language rewrite), OpenHands (positioning
  pivot), autogen (consolidation into a successor). All four are *decisions*; none is a technical failure. In
  every case the observable symptom was identical from outside - a repo with 20-90k stars that stopped receiving
  product work - which is why stars are not a maintenance guarantee.
- **Confirmed:** aider and Roo-Code are *maintenance stops* rather than pivots. **Correction to the prior
  survey:** aider's last release is **2025-08-09**, ~13 months before this snapshot, which is older than the
  "~4 months" the prior survey derived from `pushed_at`. The default branch's staleness *understates* it.
- **Addition, and the one that matters most for a harness builder:** *none of these is a vendoring failure.* No
  dependant was hurt by a licence change, a rug-pull or a bad release. They were hurt by the owner changing the
  product. That reframes the dependency rule: **the risk is not "the dependency breaks", it is "the dependency
  succeeds at something else."** The prior survey's "vendor the loop; depend on the protocol" survives; this
  session adds *why* - the irreducibly unstable thing is the vendor's product direction, and the irreducible
  stable thing is the interface.
- **Refutation attempt that failed:** the prior survey's claim that `letta-ai/letta` is a "README-only stub" is
  **confirmed** by direct path checks - `letta/__init__.py`, `main.py`, `tests/__init__.py` and
  `pyproject.toml` all return `404` on `main`. (jsdelivr's flat listing still showed 699 files including
  `letta/` and `pyproject.toml`; that listing is stale, and it produced a false positive for me until I
  checked paths directly.) The prior survey's owner inconsistency for OpenHands is also **resolved**: both
  `All-Hands-AI/OpenHands` and `OpenHands/OpenHands` resolve to repo id 771302083 - a rename, not two repos.

---

## Must-answer summary

1. **Should this project build its own harness?** Not a whole harness, and the strongest argument against is
   churn plus obsolescence: "most teams can't keep pace with the API changes underneath" (`fen_wick`), and
   harnesses "encode assumptions that go stale as models improve" (Anthropic, about its own harness). The
   evidence refutes wholesale adoption rather than building: the one SDK-level gate seam that exists is
   documented by its own vendor as being **pre-empted** for some tool calls, and none of the four SDKs has an
   effect contract, an admission boundary or an acceptance model. The correct resolution of the two is not
   "build vs adopt" but **"rent the loop, own the boundary and the evidence plane"** - which is also what the
   repository's own host (Pi) is designed for.
2. **The minimum it must own:** the gate semantics and fail-closed default; the effect identity, atomic claim
   and backend idempotency-key mapping; the checkpoint unit and gate-in-signature refusal; the admission
   boundary with no off-switch; the acceptance reducer with **mandatory** evidence refs. Safe off the shelf: the
   loop and turn boundaries, model/provider translation, tool plumbing, transcript persistence, subagent
   spawning mechanics, MCP transport, the TUI.
3. **Published regret:** none found, and I looked. Closest: Anthropic's own harness feature becoming "dead
   weight"; agent-os stripping 70% of its framework; two 2026 HN comments from harness authors and teams naming
   the maintenance tax; and the ecosystem-level observation that "lines of code are a maintenance burden" is
   now being learned by harness builders specifically. The better-documented event is the reverse: teams
   removing adopted frameworks.
4. **Not obtainable off the shelf:** the effect ledger (nothing in the same category - extended here with the
   atomic-claim, backend-key and venue-charset mechanics); the checkpoint (store interface obtainable from
   LangGraph/MAF; the effect unit and the gate-in-signature refusal are not); context admission (nothing;
   compaction is not admission - but re-justify the `ArtifactSink` against arXiv 2609.20804); the gates (the
   seam is obtainable in all four; the semantics, the fail-closed default and the subprocess coverage are not);
   task convergence (nothing); and **the loop, which is not only obtainable but already supplied by Pi and
   should arguably be deleted rather than wired.**

## Could not verify

- **`HarnessTax` (`harnesstax.github.io`, 232 pts, 2026-09-16).** The page returns 2,189 characters of
  client-rendered shell ("loading...") with no server-side content. **Not read**; no claim here rests on it.
- **`blog.can.ac/2026/02/12/the-harness-problem/`** (832 pts). The fetch followed an http -> https
  cross-origin redirect and was refused; I did not retrieve the post. My characterisation rests **only** on its
  HN title and the thread's comments. Treat the 17% / 25% replication figures as *comment-level*, not as the
  post's own claim.
- **OpenAI's first-party `openai.com/index/harness-engineering/`** (Feb 2026, Ryan Lopopolo): `403 Enable
  JavaScript and cookies to continue`. Not read. `developers.openai.com` was also unreachable. **Everything
  attributed to OpenAI's own harness-engineering guidance here is second-hand** - via the prior research and via
  Dex Horthy's citation of it.
- **ADK's `{}`-is-falsy gate hole.** I verified the interface
  (`run_before_tool_callback -> Optional[dict[str, Any]]`) but could not locate the consumer that tests
  truthiness: `flows/llm_flows/functions.py` and `base_llm_flow.py` do not contain `before_tool_callback`,
  and the jsdelivr file listing truncates before `src/google/adk/flows/`. **The hole is prior research's,
  documentation-level, and unverified here.**
- **ADK's `Runner` loop internals**, and the ordering of `before_tool_callback` versus tool execution. Not
  read this session.
- **LangGraph `libs/checkpoint-conformance/`.** The prior survey's strongest LangGraph claim - that the
  checkpoint store is a conformance-tested specification - was **not re-read by me**.
- **Microsoft Agent Framework and `WorkflowCheckpoint`.** The entire MAF comparison in this file is [PRIOR].
  I read neither MAF source nor its docs.
- **Whether Pi (Earendil) offers a pre-tool-call denial hook, and whether its internal subprocesses (its own
  git, its file indexing) are inside any boundary.** This is the single most decision-relevant unknown for C1:
  if the loop is Pi's, then the boundary that must cover the harness's own children is Pi's, and this project's
  gate cannot reach it. I read pi.dev's marketing page only; **Pi's source was not read** and its docs were not
  opened.
- **Any commit-level history.** `api.github.com` was 403 throughout. "Last push" is `pushedAt`; no
  contributor, issue or commit data was read. **The AutoGen 0.2 -> 0.4 rewrite break is cited from public
  history, not verified in this session, and should be checked before it is relied on.**
- **`mendral.com/blog/agent-harness-belongs-outside-sandbox`** (182 pts) failed every fetch attempt. Not read.
- **The Earendil post "The session you cannot take with you"**, cited by an HN commenter as the lock-in
  argument, was **not located or read** - I saw the title only, inside a comment.
- **`vxcontrol/pentagi`, `0xRichardH/pi-herdr-subagents`, `aurelio-labs/graphai`, nexi/OpenClaw** - named in
  comments I read; none inspected.
- **No SDK was executed.** Every code claim above is from reading source. Nothing was run, and no version was
  pinned to an installed artefact - the refs read were `main` as of 2026-09-26.

## Caveats / Not Found

- **Every "discourse" source is a Hacker News comment or a blog post, not a peer-reviewed or
  vendor-authoritative statement** - with two named exceptions: Guy Podjarny (`guypod`) and Lilian Weng are
  identifiable, credentialled authors, and Weng's post is a substantive survey with citations. Other handles are
  pseudonymous and **I attribute them by handle only**; I verified no real-world identity behind `fen_wick`,
  `tokioyoyo`, `sbysb`, `chickensong`, `pornel`, `nicce`, `ernsheong` or `jamesbriggs` (the last
  self-identifies as aurelio-labs in the comment).
- **A bias that cuts both ways, and should be named.** The loudest "own your harness" arguments come from people
  who sell harness tooling: Earendil (Pi: "There are many agent harnesses but this one is yours"), HumanLayer
  ("harness engineering is not enough", with its author's own "I run a company ... so what I'm gonna say below
  may be a tad biased" disclaimer), and Tessl's founder (the guardrails quote). The loudest "use a hosted
  abstraction" arguments come from labs selling hosted harnesses: OpenAI launched a hosted Agents API on
  2026-09-10, and the OpenAI Agents API HN thread is where `fen_wick`'s anti-build line appears. **Neither side
  is disinterested, and the disagreement tracks the business model almost exactly.**
- **The "harness is the product" question is unresolved by the sources.** The pro-build side has no measured
  outcome, and the anti-build side has no measured outcome *against* ownership either. The one component-level
  study measures three components that this project intends to take off the shelf.
- **Two independently frozen repos report the same last-push date (2026-04-15): `openai/swarm` and
  `microsoft/autogen`.** A coincidence I could not explain and could not check against commit history (403).
  Recorded because a shared timestamp across two unrelated repos is unusual and because all this metadata came
  from a single source (`ungh.cc`).
- **`microsoft/autogen`'s licence shows as CC-BY-4.0** via shields.io, which is almost certainly reading a
  documentation licence file rather than the code licence. **Not confirmed**; treat AutoGen's licence as
  unsettled here.
- **The graveyard table's "cause" column is inference from symptoms.** A repo that stops committing has not told
  you why. Only swarm, autogen and letta state a successor in their own README; OpenHands' pivot, aider's stall
  and Roo-Code's stall are inferred from trees, dates and the prior survey.
- **The 100,000-character fetch cap shaped this research more than any other constraint.** `run.py`,
  `pregel/main.py` and `_loop.py` were all truncated, and the first two lost their later sections - which is
  where tool dispatch and write application live. **Any claim here about those files covers only the portion
  retrieved**, and this is stated per file above.
- **Not found, and worth the next agent's time:** a first-person "we built a harness and killed it" write-up;
  the `HarnessTax` numbers; OpenAI's own harness-engineering post; Pi's source and its permission surface;
  `libs/checkpoint-conformance/`; and any measurement of *duplicate effects* in a production agent harness (the
  56-74% figure in the prior research comes from a study, not from a product's incident log).

## Repository / file index for this file

| Repo | Stars | Last push | Licence | Files read here |
|---|---|---|---|---|
| `anthropics/claude-agent-sdk-python` | 8,167 | 2026-09-25 | MIT | `src/claude_agent_sdk/types.py` (in sections), `_internal/query.py` (grepped); file list via jsdelivr |
| `openai/openai-agents-python` | 29,707 | 2026-09-25 | MIT | `src/agents/tool_guardrails.py`, `src/agents/memory/session.py`, `src/agents/run_config.py`, `src/agents/run.py` (first 100k chars); file list via jsdelivr |
| `google/adk-python` | 21,649 | 2026-09-26 | Apache-2.0 | `sessions/base_session_service.py`, `plugins/base_plugin.py`, `plugins/plugin_manager.py`, `flows/llm_flows/base_llm_flow.py` (grepped) |
| `langchain-ai/langgraph` | 42,313 | 2026-09-26 | MIT | `libs/checkpoint/langgraph/checkpoint/base/__init__.py`, `libs/langgraph/langgraph/pregel/main.py` (first 100k), `libs/langgraph/langgraph/pregel/_loop.py` (grepped) |
| `openai/swarm` | 22,010 | 2026-04-15 | MIT | `README.md` |
| `microsoft/autogen` | 61,154 | 2026-04-15 | CC-BY-4.0 (unconfirmed) | `README.md` |
| `letta-ai/letta` | 24,893 | 2026-09-10 | Apache-2.0 | `README.md`; path checks on `letta/__init__.py`, `main.py`, `tests/__init__.py`, `pyproject.toml` (all 404) |
| `Aider-AI/aider` | 49,193 | 2026-05-22 | Apache-2.0 | `README.md`; releases via ungh |
| `RooCodeInc/Roo-Code` (was RooVetGit) | 24,297 | 2026-05-15 | Apache-2.0 | `README.md` |
| `OpenHands/OpenHands` (was All-Hands-AI) | 89,203 | 2026-09-26 | MIT | partial file listing via ungh (truncated at `__tests__/`) |
| `earendil-works/pi-coding-agent` (Pi) | not captured | not captured | not captured | pi.dev marketing page only - **source not read** |
| this repository | - | - | - | `src/core/effect-ledger.ts`, `src/core/checkpoint.ts`, `src/core/context-admission.ts` (+ all research files listed at the top) |
