# Research: harness shape and prior art (whole-harness architecture, spec-driven development, the graveyard, and the harness boundary)

- **Query:** how do shipping agent-harness projects structure the whole thing - core abstraction, extension point, and what a later version fixed - and what should a vertical-agnostic harness copy, standardise, or refuse?
- **Scope:** (a) whole-harness projects: Anthropic Managed Agents, Claude Agent SDK / Claude Code, OpenAI Agents SDK, OpenAI Swarm, Google ADK, Microsoft Agent Framework (+ AutoGen), LangGraph, OpenHands, SWE-agent; (b) the spec-driven-development cluster: Amazon Kiro, GitHub Spec Kit, BMAD-METHOD, agent-os, OpenSpec, Tessl; (c) abandoned / frozen / pivoted projects; (d) prose and evidence on where a harness's responsibility ends.
- **Date:** 2026-09-26. **Author:** research sub-agent for task `09-26-dove-agent-harness-capabilities`.

## Method and source classes (read before trusting a line)

- **[FETCHED]** - page fetched live by me this session; full text read.
- **[SNIPPET]** - search-result snippet fetched by me this session; the linked page was **not** opened. Weaker.
- **[PRIOR]** - this repository's earlier survey, 2026-09-25, under `.trellis/tasks/archive/2026-09/09-25-dove-base-agent-framework/research/` and `.trellis/tasks/08-27-dove-interop-layer/research/base-selection-2026-09-25.md`. It did its own live fetches and code reads; I did **not** re-fetch its citations.
- **[DISK]** - read from this repository by me this session.
- **[INFERENCE] / [OPINION]** - mine, not a source's.

### Access limitation (named, not hidden)

I fetched five primary pages early, then the web tool hit the only live engine's keyless limit (Firecrawl `429`, `retry_after_seconds` ~85,000) and never recovered; direct HTTP from the sandbox timed out. So a large share of the list below is **[SNIPPET]** or **[PRIOR]**, not **[FETCHED]**. `x_search`, `web_fetch`, `web_search`, and `read_page` all failed on the same rate limit by the time I was reading the third-party frameworks. This is the file's largest single weakness.

---

## What the sources state

### 1. Whole-harness projects

Every row below gives **core abstraction / extension point / what a later version fixed**, with the source class on each claim.

#### 1.1 Anthropic Managed Agents - session / harness / sandbox

- **[FETCHED]** *"Scaling Managed Agents: Decoupling the brain from the hands"*, Anthropic Engineering Blog, published **Apr 08, 2026**, by Lance Martin, Gabe Cemaj, Michael Cohen - https://www.anthropic.com/engineering/managed-agents. Core abstraction, verbatim: *"we virtualized the components of an agent: a session (the append-only log of everything that happened), a harness (the loop that calls Claude and routes Claude's tool calls to the relevant infrastructure), and a sandbox (an execution environment where Claude can run code and edit files). This allows the implementation of each to be swapped without disturbing the others. We're opinionated about the shape of these interfaces, not about what runs behind them."* They call the result a **meta-harness**.
- **[FETCHED]** The correction is the most instructive artefact in this whole survey, because the authors name the defect: the **earlier design put session + harness + sandbox in one container**, which *"adopted a pet"* - *"if a container failed, the session was lost"*, and a harness bug, a dropped event, and an offline container all presented identically on the WebSocket stream. Second defect: *"the harness assumed that whatever Claude worked on lived in the container with it"*, so connecting to a customer VPC required peering networks.
- **[FETCHED]** The fix, in interfaces: the harness **leaves the container** and calls it as a tool, `execute(name, input) -> string`; the container is provisioned by `provision({resources})`; the harness itself becomes cattle and reboots with `wake(sessionId)` + `getSession(id)`; the loop writes durability with `emitEvent(id, event)` and reads context with `getEvents()`. Measured effect: *"our p50 TTFT dropped roughly 60% and p95 dropped over 90%."*
- **[FETCHED]** Security boundary, verbatim: *"The structural fix was to make sure the tokens are never reachable from the sandbox where Claude's generated code runs"* - git credentials are wired into the local remote during sandbox init, and MCP OAuth tokens live in a vault behind a per-session proxy, so *"The harness is never made aware of any credentials."*
- **[FETCHED]** The context claim that matters for capability 2 of this task: **the session is not the context window.** *"We separated the concerns of recoverable context storage in the session and arbitrary context management in the harness because we can't predict what specific context engineering will be required in future models."*
- **[FETCHED]** Claude Platform Docs, *"Claude Managed Agents overview"* - https://platform.claude.com/docs/en/managed-agents/overview. Surfaces four concepts - **Agent** (model, system prompt, tools, MCP servers, skills), **Environment** (cloud sandbox or self-hosted), **Session**, **Events** - and built-in tools Bash, file ops, web search/fetch (allow/block lists), MCP servers. Beta header `managed-agents-2026-04-01`; *"stateful by design … sessions are long-running, resume cleanly after pauses."*

#### 1.2 Claude Agent SDK / Claude Code

- **[SNIPPET]** Two search hits describe the SDK's shape: `permission_mode` and `hooks` as the two configuration axes (hidekazu-konishi.com guide); and `PreToolUse` hooks as the enforcement layer that fires *"before any permission-mode check, so a hook that returns permissionDecision: deny blocks the tool even in bypassPermissions mode"* (blakecrosley.com, "Claude Code Hooks Explained"). Venue is a personal blog - treat as practitioner claim, not vendor docs.
- **[PRIOR]** The reusable-unit schema was read from first-party docs (https://code.claude.com/docs/en/sub-agents.md and .../skills.md, fetched 2026-09-25). A subagent is one Markdown file: YAML frontmatter + body-as-system-prompt; only `name` and `description` required; optional `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, `isolation: worktree`, `effort`. Skills follow the **Agent Skills** open standard and load lazily.
- **[PRIOR]** Documented footguns the survey read verbatim: *"Claude Code ignores a field it doesn't recognize without reporting an error"* - a typo in `permissionMode` fails **open and silent**; and the doc's own version notes (`v2.1.198`, `v2.1.246`, `v2.1.271`…) show the surface is still moving.
- **[PRIOR]** Issue evidence that declarative != effective: repo `anthropics/claude-code` had **1,836** issues with "subagent" in the title and **301** open "skill" issues, including #43869 "Subagent model routing is broken", #18950 "Skills/subagents do not inherit user-level permissions", #14956 "Skill allowed-tools doesn't grant permission", #9716 "assistant not aware of available skills". The two obvious sharing paths - symlinks and parent-directory traversal - were both broken.

#### 1.3 OpenAI: Swarm (archived) -> Agents SDK

- **[SNIPPET]** `openai/swarm` README, https://github.com/openai/swarm: *"Swarm is now replaced by the OpenAI Agents SDK … a production-ready evolution of Swarm."* [PRIOR] records the repo **22,010 stars, frozen 2026-04-15**, and [SNIPPET] (digitalapplied.com framework comparison; respan.ai migration guide, Frank Chen, May 11 2026) records the timeline: Swarm shipped **October 2024**, *"under 1000 lines of Python"*, README said *"not for production"*, and was replaced in **March 2025** by `openai-agents-python` (+ a TS counterpart); the SDK shipped v0.17.1 on **May 11 2026**.
- **[PRIOR]** OpenAI Agents SDK core primitives, read from https://openai.github.io/openai-agents-python/ (2026-09-25): `Agent`, `Runner`, `RunResult`, `RunState`, `Session`, `RunConfig`, `FunctionTool`, `HostedMCPTool`, `ShellTool`, `ApplyPatchTool`, `ComputerTool`. **The SDK owns the loop** (`Runner.run`); the caller owns turn boundaries.
- **[PRIOR]** The gate: `needs_approval` on a tool pauses the run as an interruption on `RunState`, resolved by `state.approve()` / `state.reject()` then `Runner.run(agent, state)`; sticky decisions survive `RunState.to_json()`. Separately `tool_guardrails` `reject_content` is a genuine **in-process pre-execution block**, whereas **input/output guardrails default to `run_in_parallel=True`** and the docs admit the agent *"may have already consumed tokens and executed tools before being cancelled."*
- **[PRIOR]** Sessions: a `Session` interface with ten shipped backends (SQLite, Redis, SQLAlchemy, Mongo, Dapr, OpenAI Conversations, compaction, advanced SQLite, encrypted); `RunState.to_string()` reloads in another process, and durable-execution integrations (Dapr, Temporal, Restate, DBOS) exist.

#### 1.4 Google ADK

- **[PRIOR]** Read from https://adk.dev/ (2026-09-25): the **`Runner` owns an event loop**; agents are `BaseAgent` subclasses (`LlmAgent` plus fixed `SequentialAgent` / `LoopAgent` / `ParallelAgent`); ADK 2.0 adds graph, dynamic and collaborative workflows. Extension seam: callbacks on every agent plus **`BasePlugin`**; `before_tool_callback` returning a truthy value can veto.
- **[PRIOR]** Two corrections found: `LlmAgentConfig` is **now `@deprecated`** as ADK migrates to reflection-loaded YAML (a declaration format churned), and `before_tool_callback` has a silent hole - *"a deny implemented as `{}` silently no-ops"* because `{}` is falsy.
- **[PRIOR]** Resume contract is at-least-once, stated by the docs: tools *"are run at least once, and may run more than once when resuming."*

#### 1.5 Microsoft Agent Framework (+ AutoGen)

- **[SNIPPET]** `microsoft/autogen` GitHub shows a **"maintenance mode"** badge linking to `microsoft/agent-framework`; [SNIPPET] langchain.com "best AI agent frameworks in 2026" states Microsoft Agent Framework is *"the unified successor to AutoGen and Semantic Kernel … announced in October 2025"*; [SNIPPET] digitalapplied.com dates MAF 1.0 GA to **April 2026**.
- **[PRIOR]** MAF's strongest artefact is its resume record: `WorkflowCheckpoint` carries `graph_signature_hash` (detects a changed orchestration graph), `previous_checkpoint_id` (explicit lineage), `version`, and `pending_request_info_events` (pending human requests survive a restart) - *"the most explicit versioned-resume design in the survey."* Extension seam: middleware, with `FunctionInvocationContext.Terminate`.
- **[PRIOR]** MAF ships the only declarative agent manifest found that carries a **per-tool approval policy** (`McpServerToolSpecifyApprovalMode{alwaysRequireApprovalTools, neverRequireApprovalTools}`).

#### 1.6 LangGraph

- **[PRIOR]** Read from docs.langchain.com (2026-09-25): core is `StateGraph` - `State` (TypedDict/Pydantic), `Nodes` as functions, `Edges` as routing; execution proceeds in **super-steps**; per-key **reducers** define how state merges (default overwrites). Extension points: custom reducers, checkpoint saver backends, `interrupt()`.
- **[PRIOR]** Durability is the product: a checkpointer snapshots state per super-step under a `thread_id`; `durability="exit" | "async" | "sync"` trades crash-recovery against speed; `Interrupts` are placed **inside a tool** to pause before a side effect; and *"the runtime restarts the entire node from the beginning"* on resume - i.e. at-least-once at the node boundary. `libs/checkpoint-conformance/` is the only place found that treats the checkpoint store as a **conformance-tested specification across backends**.
- **[PRIOR]** Real fix evidence: pending writes let completed sibling nodes in a failed super-step not re-run; `DeltaChannel` (beta) stores deltas instead of full accumulated state to bound growth.

#### 1.7 OpenHands and SWE-agent

- **[PRIOR]** `All-Hands-AI/OpenHands` (**89,144 stars**, MIT) - *"PIVOTED. Now 'Agent Canvas', a host for ACP-compatible agents. Python package and microagents 404 - it no longer owns an agent loop."* (The repo is also cited as `OpenHands/OpenHands`, 89,135 stars, in `base-selection-2026-09-25.md`; the owner name is inconsistent across sources - see Caveats.) [SNIPPET] An independent blog by *xwang.dev* titled *"Where to Draw the Boundary for Hosted Agents"* explicitly compares "OpenHands SDK" with Claude Managed Agents - i.e. the community reads OpenHands as having moved to the *host* layer.
- **[PRIOR]** `SWE-agent/SWE-agent` (**20,404 stars**, MIT, last push 2026-09-21): declarative surface is `config/default.yaml` (prompt templates + tool-bundle paths + registry variables); its only gate is `review_on_submit_m`, which is **prompt-level** - it does not block execution. Main branch is stale; development moved off `main`.

#### 1.8 The spec-driven cluster

- **[FETCHED]** **Amazon Kiro** - https://kiro.dev/docs/specs/ (Kiro/AWS docs, undated). *"Every spec generates three key files"*: `requirements.md` (or `bugfix.md`, user stories with GIVEN/WHEN/THEN acceptance criteria), `design.md` (architecture, sequence diagrams), `tasks.md` (discrete, trackable tasks). Also a "Quick Spec", parallel task execution, "Analyze Requirements", and "Correctness" (property-based testing). [SNIPPET] https://kiro.dev/docs/specs/feature-specs/ documents two **workflow variants** - Requirements-First (`Requirements -> Design -> Tasks`) and Design-First.
- **[FETCHED]** **GitHub Spec Kit** - https://github.com/github/spec-kit. At fetch: **139k stars, 12.4k forks, 2,076 commits**, last commit **Sep 25 2026** (*"[preset] Update Intake Sequencing Governance preset to v0.2.6"*); licence not read on the page. It presents itself as SDD *"or any other"* process and ships per-assistant templates (the repo's own `AGENTS.md` describes `sh|ps|py` script variants). [FETCHED] Böckeler's review gives the workflow as **Constitution -> [Specify -> Plan -> Tasks]\(^{n}\)**.
- **[FETCHED]** **Tessl** (via the same review) is the **spec-as-source** extreme: generated code carries `// GENERATED FROM SPEC - DO NOT EDIT`, roughly one spec per code file, with `@generate` / `@test` tags.
- **[SNIPPET]** **BMAD-METHOD** - https://docs.bmad-method.org/reference/skills-and-agents/ says *"The BMad Method module installs five named agents"* alongside skills such as `bmad-product-brief`; [SNIPPET] augmentcode.com describes *"six current core agent roles, four workflow phases"*; [SNIPPET] a Medium piece describes *"BMad-CORE: The engine that handles agent coordination, workflow execution, and IDE support."* I could not open the repo; **no stars/licence/date captured.**
- **[SNIPPET]** **agent-os** - https://github.com/buildermethods/agent-os. *"helps you shape better specs, keeps agents aligned in a lightweight system."* [SNIPPET] codemyspec.com review: free, **MIT-licensed**, stack-neutral, from Brian Casel / Builder Methods. [SNIPPET] https://buildermethods.com/agent-os/migration and a v3 announcement say the author *"**stripped out 70% of the framework**"* - direct evidence that the earlier shape was too heavy.
- **[SNIPPET]** **OpenSpec** - https://github.com/Fission-AI/openspec. [SNIPPET] antongubarenko.substack.com gives the layout: `openspec/specs/` (*"Source of truth (your system's behavior)"*) and `openspec/changes/<change>/{proposal.md, design.md, tasks.md}`. [SNIPPET] jgcarmona.com gives the verbs: `/opsx:propose`, `/opsx:apply`, `/opsx:archive`.

### 2. Spec-driven development as a practice

- **[FETCHED]** The clearest framing is Birgitta Böckeler (Thoughtworks), *"Understanding Spec-Driven-Development: Kiro, spec-kit, and Tessl"*, martinfowler.com, **15 October 2025** - https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html. Who originated it: she does not name an originator; she records that the term is *"still in flux"* and quotes **GitHub** (*"maintaining software means evolving specifications … code is the last-mile approach"*) and **Tessl** (*"specs - not code - are the primary artifact"*).
- **[FETCHED]** The decisive analytical contribution is that SDD is **three levels**, not one: **spec-first** (a spec is written first, then used), **spec-anchored** (the spec is kept and edited during evolution), **spec-as-source** (only the spec is edited by a human). *"All SDD approaches … are spec-first, but not all strive to be spec-anchored or spec-as-source."* She also separates a spec from the always-on **memory bank** (rules files, CLAUDE.md, project.md) - the distinction is exactly this task's capability 3 vs capability 5.
- **[FETCHED]** The disagreements between the tools are then structural, not cosmetic. Kiro is *"mostly spec-first"* with no established spec-anchored story; spec-kit is spec-anchored via a heavily-used **constitution**; Tessl is spec-as-source. All three share the *"Requirements -> Design -> Tasks"* skeleton but disagree on **what a spec is for and how long it lives**.
- **[FETCHED]** Evidence it does *not* obviously work, from the same review: on a small bug Kiro *"turned this small bug into 4 'user stories' with a total of 16 acceptance criteria"*; on a 3-5 point story spec-kit produced so many markdown files that *"I never even finished the full implementation"*; and the agent **ignored** spec-kit's research notes that described existing classes, *"generated them all over again, creating duplicates."* Her summary judgement: *"I'd rather review code than all these markdown files."*
- **[SNIPPET]** External evidence is thin and mostly negative or vendor-owned. arXiv **2602.00180**, *"Spec-Driven Development: From Code to Contract in the Age of AI Coding Assistants"* (title + section III snippet only - I did not read it). A Reddit r/SpecDrivenDevelopment thread (title read): *"We tried spec-driven development for months. We couldn't prove it improved the code. The resulting code is not consistently better. Sometimes it is worse: more files, more indirection."* Counter-evidence of the *positive* kind is **vendor marketing**: https://specdriven.com/guides/roi ("Data does…"), named as such.
- **[FETCHED] [INFERENCE]** The disagreement that matters for a harness: SDD tools disagree about **whether the spec is an input or an output**, and the review's MDD parallel (model-driven development *"never took off … creates too much overhead and constraints"*) suggests the harness should not bet the system on spec-as-source.

### 3. The graveyard

- **[PRIOR]** The earlier GitHub survey (2026-09-25) found seven stale/frozen/gutted/pivoted repos, with the observable symptom. I reproduce its table and separately mark what is *stated* vs what is *inferred*:

| Repo | Stars | Symptom as observed | Cause: stated vs inferred |
|---|---|---|---|
| `letta-ai/letta` | 24,876 | **GUTTED** - README-only stub; source moved to `letta-ai/letta-code` in TypeScript; Python server retired to an `archive` branch | [PRIOR] Stated: repo split + language rewrite. Cause category: **product re-architecture**. [INFERENCE] not a vendoring failure. |
| `All-Hands-AI/OpenHands` | 89,144 | **PIVOTED** to "Agent Canvas", a *host* for ACP agents; package/microagents 404; no longer owns a loop | [PRIOR] Stated: repositioning. Category: **business/positioning pivot**. |
| `microsoft/autogen` | 61,154 | **STALE ~5.5 months** (last main commit 2026-04-06) while `agent-framework` ships daily | [SNIPPET] Stated: "maintenance mode" badge + named successor. Category: **consolidation into a successor**. |
| `openai/swarm` | 22,010 | **FROZEN 2026-04-15** | [SNIPPET] Stated: replaced by a production SDK. Category: **productization**. |
| `Aider-AI/aider` | 49,180 | stale ~4 months, 1.4k open issues | [PRIOR] Symptom only. Category: **maintenance** [INFERENCE]. |
| `RooVetGit/Roo-Code` | 24,296 | stale ~4.3 months - *"despite having the cleanest declarative work-mode schema found"* | [PRIOR] Symptom only. Category: **maintenance** [INFERENCE]. |
| `SWE-agent/SWE-agent` | 20,399 | main stale; development moved off `main` | [PRIOR] Stated: moved. Category: **branch/repo migration**. |

- **[PRIOR]** The surveyor's own lesson, verbatim: ***"Vendor the loop; depend on the protocol."*** The load-bearing observation behind it: *"Two of the three big harnesses moved out from under anyone depending on their internals, with >24k stars and daily commits right up to the change."*
- **[PRIOR]** A second, quieter graveyard exists at the *work-mode* layer: `contains-studio/agents` (**12,421 stars, 2,499 forks, untouched since the day it was created 2025-07-28**), `0xfurai/claude-code-subagents` (~11 months stale, all 137 agents pin a 2025 model id), and repository search returning **3,377** repos matching "claude subagents" against a handful of curated sets. The survey's measured pattern: *"many independent authors converge on the same mode names and re-write the prompts from scratch, rather than depending on someone else's artifact."*
- **[PRIOR]** Creator-side reuse is unmeasurable: Claude Code docs state *"Claude Code doesn't report a plugin's usage back to its author."* [INFERENCE] A harness cannot rely on an ecosystem forming around its artefacts; it must make them useful to its *own* sessions first.

**[INFERENCE]** Reading the graveyard by *cause* rather than by repo: none of the seven failed because a dependency was vendored badly; they failed because (a) the owner **changed the product** (OpenHands, swarm, letta) or (b) **maintenance stopped while stars kept climbing** (aider, Roo-Code, autogen). The dependency lesson is therefore narrower than "don't vendor": **do not let a frozen or pivoting project's in-process internals sit on your critical path**, and **do not equate stars with a maintenance guarantee**.

### 4. What a harness is not

- **(Not) the session.** **[FETCHED]** Anthropic: *"Because the session log sits outside the harness, nothing in the harness needs to survive a crash."* The harness is made disposable on purpose.
- **(Not) the sandbox, and not inside it.** **[FETCHED]** *"The structural fix was to make sure the tokens are never reachable from the sandbox"*, with the harness explicitly outside. **[PRIOR]** A community essay cited in the base-selection note (*Mendral, "The agent harness belongs outside the sandbox", 2026-04*) makes the same argument from the other direction: *"no permission model to enforce and no credential leak."*
- **(Not) a place to freeze a workflow.** **[FETCHED]** Anthropic's own cautionary example: context resets were added to the harness to fix *"context anxiety"* in Sonnet 4.5; when the same harness ran on Opus 4.5 *"the behavior was gone. The resets had become dead weight."* Their conclusion: *"Harnesses encode assumptions that go stale as models improve."* **[SNIPPET]** Same shape at the SDD layer: agent-os v3 *"stripped out 70% of the framework."*
- **(Not) the author of the spec.** **[FETCHED]** Böckeler's failures are content failures, not plumbing failures: over-expansion of a small bug into 16 criteria, and an agent re-generating classes that already existed. **[INFERENCE]** A harness can **require** a spec and **track** its criteria; it cannot guarantee the spec is good, and it should not pretend that producing more markdown is control.
- **(Not) the same thing as an approval dialog or a "guardrail".** **[PRIOR]** The survey's rule: *"'Guardrail' does not mean 'gate'"* - OpenAI's input/output guardrails run in parallel by default; Anthropic files guardrails under screening; and Claude Code's plan mode was found to be prompt-level with no enforcement. **[PRIOR]** The measured failure mode to design *against*: a gate that exists but is off the path (e.g. `redcell` returns `True` for an empty scope, so a campaign started without scope has no gate at all; `Armur` errors in the same state). The survey's fix-pattern: **log the gate's invocation, not only its decision**.
- **(Not) vertical vocabulary.** **[DISK]** This repository's own `src/core` already keeps no domain vocabulary (no seed/catalog/vuln/exploit/notional/sql), and that is a property worth preserving (task R3).

---

## What I read in code

I could not fetch upstream source in this session (web blocked after the first five pages). What follows separates **code I read** from **code the prior survey read**, and I mark it.

- **[DISK] (this session, first-party)** I verified the repository's own claim that the `src/core` contracts are unwired. `src/core/` contains 34 files including `gate-limit.ts`, `gate-conformance.ts`, `authority.ts`, `capability-scope.ts`, `context-admission.ts`, `checkpoint.ts`, `task-convergence.ts`, `subagent.ts`. A repo-wide grep for their exported functions (`createConformanceGate`, `createLimitGate`, `evaluateAuthority`, `admit(`, `captureCheckpoint`, `createCapabilityScope`, `loadWorkMode`) returns **only their own definitions plus one internal import** (`gate-conformance.ts:2` imports `evaluateAuthority`). The only runtime wiring found is `createDoveRuntime()` (`src/runtime.ts:14`), imported by `src/pi-adapter/extension.ts:38` and `src/adapters/local-rpc.ts:5`. **So the gate/checkpoint/admission layer is a library referenced by nothing that runs** - which is exactly the "a helper that exists but is never called is not enforcement" defect named in the task PRD, reproduced at framework scale by me, first-hand.
- **[PRIOR] (2026-09-25, not re-fetched by me)** actual upstream files the earlier survey read, with what it found:
  - `openai/openai-agents-python/src/agents/tool_guardrails.py` (8,454 bytes) - `RejectContentBehavior` = *"Rejects the tool call/output but continues execution with a message to the model."* (fetched by the prior survey and quoted verbatim).
  - `strands-agents/sdk-python/harness-py/src/strands_harness/interventions.py` (4,312 bytes) - policy/HITL interventions resolved inside a library-owned loop, **inherited by subagents**.
  - `langgraph/libs/checkpoint-conformance/` - the checkpoint store as a specified, conformance-tested interface.
  - `microsoft/agent-framework` `WorkflowCheckpoint`; `pydantic-ai` `durable_exec` (`DurableOperationId`, codecs).
  - Vertical gates: `cdxiaodong/cain-agent` `templates/scope.example.yaml` + `scope.py`; `Armur-Ai/Pentest-Swarm-AI` `internal/scope/validator.go`; Dark-Moon `executor.py:203`; `pi-agent-core@0.87.1` `dist/harness/execution/effect-gate.d.ts`.
  - `RooVetGit/Roo-Code` `modeConfigSchema` (Zod) and `checkAutoApproval() -> {approve|deny|ask|timeout}`; `block/goose` `Recipe` + separate `permission.yaml` (`always_allow`/`ask_before`/`never_allow`) - *"the two-file split is the design to copy."*

**[INFERENCE]** The one code-level pattern that repeats across every serious project is that the **gate is a function/interface at the tool-call boundary**, and the one code-level pattern that repeats in the failures is that it is **unreachable from the running path**.

---

## What is transferable to a harness

### Must-answer 1 - the stable seams every serious project has

Seven, in descending confidence:

1. **A durable, append-only history that outlives the loop.** Anthropic "session"; OpenAI `Session`; ADK `SessionService` + `Event`; LangGraph checkpointer/`thread_id`; Claude Code transcript. **[FETCHED]** Anthropic makes the reason explicit: it decouples *recoverable storage* from *context engineering*.
2. **An explicit owner of the loop**, named as an object: Anthropic "harness"; OpenAI `Runner`; ADK `Runner`; LangGraph compiled graph; a host like OpenHands (until it stopped owning one).
3. **A tool-call boundary where a decision can be made before execution** - even when it is implemented badly. Anthropic's sandbox-as-tool `execute`; OpenAI `needs_approval`/`tool_guardrails`; ADK `before_tool_callback`; LangGraph `interrupt()` inside a tool; Claude Code `PreToolUse` hooks; MS middleware.
4. **A declarative definition artefact for workers/capabilities** - Claude Code subagent frontmatter, Agent Skills `SKILL.md`, ADK config, MS `AgentManifest`, Roo-Code `modeConfigSchema`, goose `Recipe`.
5. **A pluggable persistence interface with multiple backends.** OpenAI's ten Session backends; LangGraph's checkpointer conformance suite; MS `WorkflowCheckpoint`.
6. **An extension seam** separate from the tools: Claude Code hooks, ADK `BasePlugin`/callbacks, MS middleware, OpenAI `RunConfig`.
7. **An outbound event stream** (`emitEvent`, ADK `Event`, LangGraph streaming) - the surface an observer actually attaches to.

### Must-answer 2 - the parts that differ so much they should not be standardised

1. **The spec/workflow artefact set.** Kiro `requirements/design/tasks`; spec-kit `constitution/specify/plan/tasks`; OpenSpec `proposal/design/tasks`; BMAD's agent roles + phases; agent-os's standards+specs. **[FETCHED]** Böckeler: *"it is not just one thing."* **Do not standardise the spec format.**
2. **The orchestration topology.** **[PRIOR]** Only **sectioning** has unanimous production support; routing/classify-and-act/generate-and-filter have *no* independent evidence; correlated voting has evidence *against* it. Baking a topology into the harness picks a fight the evidence hasn't settled.
3. **The gate's semantics.** The three verticals need three shapes - **limit/threshold** (trading), **scope conformance** (pentest), **finding identity** (audit) - and finding identity is not even a pre-action gate. Put *one* interface and *N* semantics behind it.
4. **What "done" means / acceptance criteria.** Kiro's GIVEN-WHEN-THEN, spec-kit's checklists, Tessl's tags, BMAD's stories all disagree, and the same review shows the criteria count is easy to inflate.
5. **The agent/mode field set.** Claude Code's own version notes show the surface moving; ADK deprecated its config object. Freeze the *minimum* (identity + delegation + authority + sandbox + session + budget) and admit unknown fields only explicitly.
6. **The persistence backend and schema.** SQL/Redis/Mongo/Dapr all appear; the *interface* (put/put_writes/get_tuple/list) is stable, the backend is not.

### Must-answer 3 - which architecture to copy, and the first file to read

**Copy Anthropic's three-interface split - session / harness / sandbox - because it is the only architecture in the survey that is explicitly designed to outlast its own implementation** ("meta-harness", *"opinionated about the shape of these interfaces, not about what runs behind them"*), it names the concrete failure it fixed (the coupled container = pet), and it leaves the vertical control exactly where a vertical-agnostic harness can host it: **the gate and the evidence live in the harness; the action lives in the sandbox; the truth lives in the session.**

**First file to read:** https://platform.claude.com/docs/en/managed-agents/overview (the interface set), then https://www.anthropic.com/engineering/managed-agents (the rationale and the failure it fixed). Both are **[FETCHED]**. If a *code* artefact is required rather than prose: read `openai/openai-agents-python`'s `RunState` + `sessions` (the reloadable run state and the pluggable session) and `langgraph/libs/checkpoint-conformance/` (the checkpoint store as a specified interface) - these are the two hardest seams, written down as code rather than claimed in a post. **[PRIOR]** for those two paths.

**[OPINION]** For *this* repository the copy should be narrower than a rewrite: keep `.trellis/` as the running workflow layer, and make `src/core` the **harness** by giving it the three seams and a single caller, rather than adding a third layer. The failure to avoid is the one this file's code section confirms first-hand.

### Must-answer 4 - is there a project providing all nine capabilities in one running system?

**No. There is none in the set surveyed.** Stated plainly, with the closest partials:

- The four capability *families* are split across two project classes that do not overlap. **Runtime harnesses** (Anthropic Managed Agents, Claude Agent SDK, OpenAI Agents SDK, ADK, MS AF, LangGraph) own context management (2), the entry gate (4), session resumption (6), agents/subagents (7) and conventions-as-always-on-context (5) - but they have **no taskification (1), no checkable acceptance criteria (3), no PRD-planning artefact system (8), and no systematic error-recording loop that feeds back (9)**. **SDD toolkits** (Kiro, spec-kit, BMAD, OpenSpec, agent-os) own taskification (1), acceptance criteria (3), PRD planning (8) and conventions (5) - but they are **not running harnesses**: no entry gate (4), no session resumption (6), no runtime self-check (9).
- **Closest single system:** Claude Code / Claude Agent SDK + Managed Agents covers 2, 4, 5, 6, 7 well (session log, hooks/permission modes, CLAUDE.md/memory, subagent resume, subagents + skills). It is weak-to-absent on **1, 3, 8** (its plan mode was found to be unenforced markdown) and **9** (cross-session memory exists, but no failure-driven iteration contract).
- **Closest for the missing half:** GitHub Spec Kit covers **1, 3, 5, 8** declaratively, and Kiro adds 3 with GIVEN/WHEN/THEN criteria - but neither is a harness.
- **[PRIOR] Not a shipping project, but the relevant comparison:** this repository's own `.trellis/` is the only thing I found that provides **eight-ish of the nine in one running system** (taskification via `scripts/task.py`, context injection, the convergence check, hooks, 24 spec files, the workspace journal, agents, the brainstorm skill, break-loop/session-insight) - and it is not in the literature precisely because the nine-capability intersection is a *workflow-layer* question, not a framework question. **[OPINION]** That is the real finding: the nine are not a framework's capability list, they are a workflow's, and the gap that matters is not "who has all nine" but "which of the nine must be *load-bearing at the tool boundary*".

---

## Could not verify

- **Upstream source code in this session.** I could not re-fetch any GitHub file after the web limit; all code-level claims about OpenAI/ADK/LangGraph/MS/strands/cain/Armur come from **[PRIOR]** and were not independently reproduced by me.
- **The four repos whose metadata I never captured** - BMAD-METHOD, agent-os, OpenSpec, Tessl: **stars, licence, last-commit date are all unknown to me**, and I only have search snippets (BMAD via docs.bmad-method.org + two third-party blogs; agent-os via the GitHub README snippet + a review + a migration page; OpenSpec via the GitHub snippet + two blogs). Anything I wrote about their internals is snippet-level.
- **The SDD evidence base.** arXiv 2602.00180 was not read past its title/section-III snippet; the strongest "does it work" data points I have are **one practitioner review (Böckeler)** and **one Reddit thread title**, against **vendor ROI pages**. There is no reproducible benchmark here, and I am not going to invent one.
- **Anthropic Managed Agents' actual interface definitions** (method signatures beyond `execute/getSession/wake/emitEvent/getEvents`, error taxonomy, exactly-once semantics). The blog is prose; the docs page is conceptual. Neither is a spec.
- **OpenHands' current architecture** beyond the prior survey's "pivoted to a host". The blog that would document the boundary (`xwang.dev/blog/2026/openhands-sdk-claude-managed-agents/`) was a snippet I did not open.
- **Microsoft Agent Framework's licence and current commit cadence**, and AutoGen's exact last-commit date, in my own reading - only [PRIOR] and snippets.
- **Whether any of the nine capabilities is genuinely *enforced* in the SDD toolkits.** Their checklists are, by Böckeler's account, *"interpreted by AI, so there is no 100% guarantee that they will be respected."* I found no project whose acceptance criteria are machine-checked by the tool itself.

## Caveats / Not Found

- **The web outage is the dominant caveat.** Five pages were fetched under my own hand; the rest is snippet or prior survey. The prior survey is a secondary source *for me*, even though it was primary when written - I have marked every borrow.
- **Repo-identity inconsistency:** the same project appears as `All-Hands-AI/OpenHands` (89,144 stars) in `ground-truth-github-survey.md` and `OpenHands/OpenHands` (89,135 stars) in `base-selection-2026-09-25.md`. I could not settle which owner is current; the star delta (9) suggests two readings of one repo on two dates, but I am not certain.
- **Star counts and last-commit dates are snapshots**, mostly 2026-09-25, not today. No repo was executed by me; the prior survey also ran nothing. "Last commit" in the prior survey is `pushed_at` (any branch), which overstates activity for a repo whose default branch is stale.
- **Vendor-marketing exclusion:** I labelled as marketing, not evidence, `specdriven.com/guides/roi`, the Kiro/AWS *"three-week drug discovery"* case study, and the vendor framework-comparison pages (digitalapplied, respan). They were used only for **dates and version numbers**, never as proof of effectiveness.
- **Absence claims are weak.** "No project provides all nine" is a claim about the ~15 systems I actually looked at, not about the world. The prior survey makes the same disclaimer for code discovery (GitHub code search needs auth; `grep.app` was behind a bot check), so "no gate found in project X" is weaker than "a gate found in project Y".
- **The nine capabilities are themselves project-defined** (from the task PRD, derived from `.trellis/`). No external framework frames the same intersection, so "who has all nine" is necessarily answered against a rubric no shipping project was designed to be scored on.
- **Not found, and worth finding next:** a *reproducible* SDD outcome study; Managed Agents' interface spec; the OpenHands host-boundary write-up; BMAD/agent-os/OpenSpec metadata; and an inspection of `vxcontrol/pentagi` (flagged by the prior survey as the biggest uninspected repo, 24,951 stars).
