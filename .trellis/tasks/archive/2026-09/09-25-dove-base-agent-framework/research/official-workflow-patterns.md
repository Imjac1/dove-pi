
# Research: Official workflow-pattern taxonomy (Anthropic first-party corpus + MCP / Agent Skills specs)

- Query: What is the official workflow/agent pattern taxonomy, and where do the first-party sources place the ENFORCEMENT boundary for tool approval, policy gates, context budgets, and long-horizon execution?
- Scope: official/first-party only (anthropic.com engineering docs, Claude Code / Agent SDK docs, agentskills.io spec, modelcontextprotocol.io spec). No blogs, Medium, Reddit, HN.
- Date: 2026-09-25

---

## 0. Sources actually fetched in this session

| # | URL | Page title | Version / date as shown |
|---|-----|-----------|--------------------------|
| S1 | https://www.anthropic.com/engineering/building-effective-agents | "Building effective agents" (Engineering at Anthropic) | "Published Dec 19, 2024"; page carries a 2026 update note (see §1.7) |
| S2 | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents | "Effective context engineering for AI agents" | "Published Sep 29, 2025" |
| S3 | https://www.anthropic.com/engineering/multi-agent-research-system | "How we built our multi-agent research system" | "Published Jun 13, 2025" |
| S4 | https://www.anthropic.com/engineering/writing-tools-for-agents | "Writing effective tools for agents — with agents" | "Published Sep 11, 2025" |
| S5 | https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills | "Equipping agents for the real world with Agent Skills" | "Published Oct 16, 2025"; "Update: ... open standard ... (December 18, 2025)" |
| S6 | https://code.claude.com/docs/en/agent-sdk/overview | "Agent SDK overview" (Claude Code Docs) | No publish/update date shown on page |
| S6a | https://code.claude.com/docs/en/agent-sdk/agent-loop | "How the agent loop works" | No date shown |
| S6b | https://code.claude.com/docs/en/agent-sdk/permissions | "Configure permissions" | No date shown |
| S6c | https://code.claude.com/docs/en/agent-sdk/hooks | "Intercept and control agent behavior with hooks" | No date shown |
| S6d | https://code.claude.com/docs/en/agent-sdk/user-input | "Handle approvals and user input" | No date shown |
| S6e | https://code.claude.com/docs/en/agent-sdk/subagents | "Subagents in the SDK" | No date shown |
| S6f | https://code.claude.com/docs/en/agent-sdk/sessions | "Work with sessions" | No date shown |
| S6g | https://code.claude.com/docs/en/agent-sdk/file-checkpointing | "Rewind file changes with checkpointing" | No date shown |
| S6h | https://code.claude.com/docs/en/agent-sdk/secure-deployment | "Securely deploying AI agents" | No date shown |
| S7 | https://agentskills.io/specification | "Specification" (Agent Skills) | No version/date shown |
| S7a | https://agentskills.io/home | "Agent Skills Overview" | No date shown |
| S7b | https://agentskills.io/skill-creation/best-practices | "Best practices for skill creators" | No date shown |
| S7c | https://agentskills.io/client-implementation/adding-skills-support | "How to add skills support to your agent" | No date shown |
| S8 | https://modelcontextprotocol.io/specification/2026-07-28/index | "Specification" (MCP) | Protocol revision **2026-07-28** (schema: `schema/2026-07-28/schema.ts`) |
| S8a | https://modelcontextprotocol.io/specification/2026-07-28/architecture/index | "Architecture" (MCP) | 2026-07-28 |
| S8b | https://modelcontextprotocol.io/specification/2026-07-28/server/index | "Overview" (MCP server features) | 2026-07-28 |
| S8c | https://modelcontextprotocol.io/specification/2026-07-28/server/tools | "Tools" (MCP) | 2026-07-28 |
| S8d | https://modelcontextprotocol.io/specification/2026-07-28/client/roots | "Roots" (MCP) | 2026-07-28 — **marked Deprecated** |
| S8e | https://modelcontextprotocol.io/specification/2026-07-28/client/sampling | "Sampling" (MCP) | 2026-07-28 — **marked Deprecated** |
| S8f | https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation | "Elicitation" (MCP) | 2026-07-28 |
| S8g | https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/index | "Authorization" (MCP) | 2026-07-28 |
| S8h | https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices | "Security Best Practices" (MCP) | 2026-07-28 |
| S8i | https://modelcontextprotocol.io/docs/2026-07-28/learn/client-concepts | "Understanding MCP clients" | 2026-07-28 |

URL-resolution notes (verified this session, not from memory):
- `https://docs.claude.com/en/api/agent-sdk/overview` → cross-origin redirect to `https://platform.claude.com`.
- `https://platform.claude.com/docs/en/api/agent-sdk/overview` → cross-origin redirect to `https://code.claude.com`.
- The live Agent SDK docs are therefore at **https://code.claude.com/docs/en/agent-sdk/...**, and every page has a plain-text twin at the same path + `.md` (e.g. `/docs/en/agent-sdk/permissions.md`). Docs index: `https://code.claude.com/docs/llms.txt`.
- MCP docs likewise serve `.md` twins; index at `https://modelcontextprotocol.io/llms.txt`.
- `https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview` redirects cross-origin to `https://www.anthropic.com` and could not be fetched (see Caveats).

---

## 1. S1 — The canonical pattern taxonomy ("Building effective agents", Dec 19 2024)

### 1.1 The workflow-vs-agent distinction (verbatim)

> "At Anthropic, we categorize all these variations as **agentic systems**, but draw an important architectural distinction between **workflows** and **agents**:
> - **Workflows** are systems where LLMs and tools are orchestrated through predefined code paths.
> - **Agents**, on the other hand, are systems where LLMs dynamically direct their own processes and tool usage, maintaining control over how they accomplish tasks."

### 1.2 Selection criteria ("When (and when not) to use agents")

> "we recommend finding the simplest solution possible, and only increasing complexity when needed. This might mean not building agentic systems at all. Agentic systems often trade latency and cost for better task performance..."
> "When more complexity is warranted, **workflows offer predictability and consistency for well-defined tasks**, whereas **agents are the better option when flexibility and model-driven decision-making are needed at scale**. For many applications, however, optimizing single LLM calls with retrieval and in-context examples is usually enough."

### 1.3 Building block

**The augmented LLM** — "an LLM enhanced with augmentations such as retrieval, tools, and memory." The doc points at MCP as one implementation. "For the remainder of this post, we'll assume each LLM call has access to these augmented capabilities."

### 1.4 The complete named pattern set (5 workflows + 1 agent)

| Pattern | What it is (doc's wording) | Doc's "when to use" | Stated tradeoff / example |
|---|---|---|---|
| **Prompt chaining** | "decomposes a task into a sequence of steps, where each LLM call processes the output of the previous one. You can add programmatic checks (see 'gate' in the diagram) on any intermediate steps to ensure that the process is still on track." | "ideal for situations where the task can be easily and cleanly decomposed into fixed subtasks." | "The main goal is to trade off **latency for higher accuracy**, by making each LLM call an easier task." Examples: marketing copy → translate; outline → check criteria → write doc. |
| **Routing** | "classifies an input and directs it to a specialized followup task. This workflow allows for separation of concerns, and building more specialized prompts." | "complex tasks where there are **distinct categories that are better handled separately**, and where classification can be handled accurately, either by an LLM or a more traditional classification model/algorithm." | "Without this workflow, optimizing for one kind of input can hurt performance on other inputs." Example: route easy → Claude Haiku 4.5, hard → Claude Sonnet 4.5. |
| **Parallelization** | "LLMs can sometimes work simultaneously on a task and have their outputs aggregated programmatically." Two variants: **Sectioning** (independent subtasks in parallel) and **Voting** (same task run multiple times for diverse outputs). | "effective when the divided subtasks can be parallelized for speed, or when **multiple perspectives or attempts are needed for higher confidence results**." | Examples: guardrail model screening user queries alongside the main model; vulnerability review with several different prompts each flagging problems; multiple judges with vote thresholds. |
| **Orchestrator-workers** | "a central LLM dynamically breaks down tasks, delegates them to worker LLMs, and synthesizes their results." | "complex tasks where you **can't predict the subtasks needed** (in coding, for example, the number of files that need to be changed and the nature of the change in each file likely depend on the task)." | Key difference from parallelization: "its **flexibility**—subtasks aren't pre-defined, but determined by the orchestrator based on the specific input." Examples: coding products making complex multi-file changes; multi-source search. |
| **Evaluator-optimizer** | "one LLM call generates a response while another provides evaluation and feedback in a loop." | "particularly effective when we have **clear evaluation criteria**, and when **iterative refinement provides measurable value**." Two signs of good fit: "(1) LLM responses can be demonstrably improved when a human articulates their feedback; and (2) the LLM can provide such feedback." | Examples: literary translation with nuance; multi-round search where the evaluator decides whether further searches are warranted. |
| **Agents** (not a workflow) | "Agents are ... LLMs using tools based on environmental feedback in a loop." "Agents begin their work with either a command from, or interactive discussion with, the human user. Once the task is clear, agents plan and operate independently, potentially returning to the human for further information or judgement. During execution, it's crucial for the agents to gain '**ground truth**' from the environment at each step (such as tool call results or code execution)... Agents can then **pause for human feedback at checkpoints or when encountering blockers**. The task often terminates upon completion, but it's also common to include **stopping conditions (such as a maximum number of iterations)** to maintain control." | "open-ended problems where it's difficult or impossible to predict the required number of steps, and where you **can't hardcode a fixed path**. The LLM will potentially operate for many turns, and you must have **some level of trust in its decision-making**. Agents' autonomy makes them ideal for scaling tasks in **trusted environments**." | "The autonomous nature of agents means **higher costs, and the potential for compounding errors. We recommend extensive testing in sandboxed environments, along with the appropriate guardrails.**" Examples: a coding agent resolving SWE-bench tasks; the "computer use" reference implementation. |

> Source: S1 (https://www.anthropic.com/engineering/building-effective-agents).

### 1.5 Anti-patterns / "do not do this" in S1

1. **Don't reach for a framework by default.** "they often create extra layers of abstraction that can obscure the underlying prompts and responses, making them harder to debug. They can also make it tempting to add complexity when a simpler setup would suffice." → "**We suggest that developers start by using LLM APIs directly**... If you do use a framework, **ensure you understand the underlying code. Incorrect assumptions about what's under the hood are a common source of customer error.**"
2. **Don't add complexity without measured benefit.** "you should consider adding complexity **only when it demonstrably improves outcomes**."
3. **Don't start with the most sophisticated system.** "Success in the LLM space isn't about building the most sophisticated system. It's about building the right system for your needs. Start with simple prompts, optimize them with comprehensive evaluation, and add multi-step agentic systems only when simpler solutions fall short."
4. **Don't ship agents without sandboxing + guardrails** (see §1.4 "Agents" tradeoff row).

### 1.6 Three stated core principles for implementing agents (verbatim)

> - "Maintain **simplicity** in your agent's design."
> - "Prioritize **transparency** by explicitly showing the agent's planning steps."
> - "Carefully craft your **agent-computer interface (ACI)** through thorough tool documentation and testing."

### 1.7 Coding agents, long-horizon tasks, and ACI in S1

**Coding agents (Appendix 1.B).** The doc says agents are particularly effective for coding because:
> - "Code solutions are **verifiable through automated tests**;
> - Agents can **iterate on solutions using test results as feedback**;
> - The problem space is **well-defined and structured**; and
> - Output quality can be **measured objectively**."

And the important qualifier:
> "whereas automated testing helps verify functionality, **human review remains crucial for ensuring solutions align with broader system requirements**."

Also: "Both applications illustrate how agents add the most value for tasks that require **both conversation and action, have clear success criteria, enable feedback loops, and integrate meaningful human oversight**."

**Tool / ACI design (Appendix 2, "Prompt engineering your tools").** Stated rules:
- "Give the model enough tokens to 'think' before it writes itself into a corner."
- "Keep the format close to what the model has seen naturally occurring in text on the internet."
- "Make sure there's no formatting 'overhead' such as having to keep an accurate count of thousands of lines of code, or string-escaping any code it writes."
- "think about how much effort goes into human-computer interfaces (HCI), and plan to invest just as much effort in creating good agent-computer interfaces (ACI)."
- "**Poka-yoke your tools.** Change the arguments so that it is harder to make mistakes."
- Concrete case: "we actually spent more time optimizing our tools than the overall prompt. For example, we found that the model would make mistakes with tools using relative filepaths after the agent had moved out of the root directory. To fix this, we changed the tool to **always require absolute filepaths**—and we found that the model used this method flawlessly."

**Long-horizon.** S1 itself does not have a long-horizon section; it defers to stopping conditions ("maximum number of iterations") and checkpoints. The long-horizon material lives in S2 (§2).

**⚠ S1 carries its own freshness caveat (fetched 2026-09-25):**
> "Note: Much of the tooling landscape described in this post has changed since December 2024. For our current approach, see how we built Claude Managed Agents and the Managed Agents documentation."

Inference (mine): the *pattern taxonomy itself* is presented as stable, but the *tooling* section (framework list, cookbook links) is explicitly stale. Treat S1 as the taxonomy source, not as the current product-surface source.

---

## 2. S2 — Context engineering, budgets, compaction, sub-agents, JIT retrieval

Source: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents ("Effective context engineering for AI agents", Sep 29, 2025).

### 2.1 Context budget model (stated)

- "**context rot**: as the number of tokens in the context window increases, the model's ability to accurately recall information from that context decreases."
- "Context, therefore, must be treated as a **finite resource with diminishing marginal returns**... LLMs have an '**attention budget**'."
- Mechanism claimed: transformer attention gives "n² pairwise relationships for n tokens"; "models have less experience with, and fewer specialized parameters for, context-wide dependencies."
- "These factors create a **performance gradient rather than a hard cliff**."
- Guiding principle: "**find the smallest possible set of high-signal tokens** that maximize the likelihood of some desired outcome."
- Note: "**minimal does not necessarily mean short**; you still need to give the agent sufficient information up front."

### 2.2 Component-level guidance

- **System prompts** — "the right altitude is the Goldilocks zone between two common failure modes": brittle if-else hardcoding vs. vague high-level guidance. Recommended sectioning: "`<background_information>`, `<instructions>`, `## Tool guidance`, `## Output description`" via XML tags or Markdown headers.
- **Tools** — "Because tools define the contract between agents and their information/action space, it's extremely important that tools promote efficiency". Anti-pattern named: "One of the most common failure modes we see is **bloated tool sets** that cover too much functionality or lead to ambiguous decision points about which tool to use. **If a human engineer can't definitively say which tool should be used in a given situation, an AI agent can't be expected to do better.**"
- **Examples** — "we do **not** recommend" stuffing a laundry list of edge cases into a prompt; curate "diverse, canonical examples".

### 2.3 Just-in-time retrieval and progressive disclosure

- "agents built with the 'just in time' approach maintain **lightweight identifiers** (file paths, stored queries, web links, etc.) and use these references to **dynamically load data into context at runtime using tools**."
- Claude Code example: "The model can write targeted queries, store results, and leverage Bash commands like `head` and `tail` to analyze large volumes of data without ever loading the full data objects into context."
- "**progressive disclosure**—in other words, allows agents to incrementally discover relevant context through exploration... file sizes suggest complexity; naming conventions hint at purpose; timestamps can be a proxy for relevance."
- Tradeoff stated: "runtime exploration is slower than retrieving pre-computed data. Not only that, but **opinionated and thoughtful engineering is required** to ensure that an LLM has the right tools and heuristics... Without proper guidance, an agent can waste context by misusing tools, chasing dead-ends, or failing to identify key information."
- **Hybrid strategy** (what Claude Code does): "CLAUDE.md files are naively dropped into context up front, while primitives like `glob` and `grep` allow it to navigate its environment and retrieve files just-in-time". The doc explicitly flags: "The hybrid strategy might be better suited for contexts with **less dynamic content, such as legal or finance work**."

### 2.4 Long-horizon context management (the section most relevant to this framework)

Definition: "Long-horizon tasks require agents to maintain coherence, context, and goal-directed behavior over sequences of actions where the **token count exceeds the LLM's context window**. For tasks that span **tens of minutes to multiple hours of continuous work**, like large codebase migrations or comprehensive research projects".

Three named techniques: **compaction**, **structured note-taking**, **multi-agent architectures**.

**Compaction.**
- "taking a conversation nearing the context window limit, summarizing its contents, and reinitiating a new context window with the summary."
- "In Claude Code... we implement this by passing the message history to the model to summarize and compress the most critical details. The model **preserves architectural decisions, unresolved bugs, and implementation details while discarding redundant tool outputs or messages**. The agent can then continue with this compressed context **plus the five most recently accessed files**."
- Risk: "**overly aggressive compaction can result in the loss of subtle but critical context whose importance only becomes apparent later.**" Tuning advice: "Start by **maximizing recall**... then iterate to improve **precision**".
- "One of the safest lightest touch forms of compaction is **tool result clearing**, most recently launched as a feature on the Claude Developer Platform."

**Structured note-taking ("agentic memory").**
- "the agent regularly writes notes persisted to memory **outside of the context window**. These notes get pulled back into the context window at later times."
- Examples: "Claude Code creating a to-do list, or your custom agent maintaining a **NOTES.md** file".
- "After context resets, the agent reads its own notes and continues multi-hour training sequences..."
- Named product surface: "As part of our Sonnet 4.5 launch, we released a **memory tool in public beta** on the Claude Developer Platform... through a file-based system."

**Sub-agent architectures.**
- "specialized sub-agents can handle focused tasks with **clean context windows**. The main agent coordinates with a high-level plan while subagents perform deep technical work... Each subagent might explore extensively, using tens of thousands of tokens or more, but **returns only a condensed, distilled summary of its work (often 1,000-2,000 tokens)**."
- "the detailed search context remains **isolated within sub-agents**, while the lead agent focuses on synthesizing and analyzing the results."
- Selection table (verbatim):
> - "Compaction maintains conversational flow for tasks requiring extensive back-and-forth;
> - Note-taking excels for iterative development with clear milestones;
> - Multi-agent architectures handle complex research and analysis where parallel exploration pays dividends."

### 2.5 S2's definition of "agent"

> "we've gravitated towards a simple definition for agents: **LLMs autonomously using tools in a loop.**"

---

## 3. S3 — Multi-agent (orchestrator-worker) as the long-horizon research pattern

Source: https://www.anthropic.com/engineering/multi-agent-research-system ("How we built our multi-agent research system", Jun 13, 2025).

**Architecture stated:** "an orchestrator-worker pattern, where a lead agent coordinates the process while delegating to specialized subagents that operate in parallel." The description names the concrete roles: **LeadResearcher** (writes its plan to **Memory** to persist context, "since if the context window exceeds 200,000 tokens it will be truncated"), **Subagents** (independent web searches, interleaved thinking), and a **CitationAgent** that "processes the documents and research report to identify specific locations for citations. This ensures all claims are properly attributed to their sources."

**Evidence-producing work — directly relevant:** the CitationAgent is the doc's own answer to an auditable evidence trail, and the eval rubric explicitly includes "**citation accuracy** (do the cited sources match the claims?)".

**Measured claims (stated, attributed to Anthropic's internal evals):**
- "a multi-agent system with Claude Opus 4 as the lead agent and Claude Sonnet 4 subagents outperformed single-agent Claude Opus 4 by **90.2%** on our internal research eval."
- "token usage by itself explains **80%** of the variance [on BrowseComp], with the number of tool calls and the model choice as the two other explanatory factors." (Together: "three factors explained **95%** of the performance variance".)
- Cost: "agents typically use about **4×** more tokens than chat interactions, and multi-agent systems use about **15×** more tokens than chats."

**Stated "when NOT to use multi-agent" (anti-pattern):**
> "some domains that require all agents to share the same context or involve many dependencies between agents are **not a good fit** for multi-agent systems today. For instance, **most coding tasks involve fewer truly parallelizable tasks than research**, and LLM agents are not yet great at coordinating and delegating to other agents in real time."

**Production-reliability statements (directly relevant to a long-running base agent):**
- "**Agents are stateful and errors compound.** Agents can run for long periods of time, maintaining state across many tool calls. This means we need to durably execute code and handle errors along the way. Without effective mitigations, minor system failures can be catastrophic for agents. When errors occur, we can't just restart from the beginning... Instead, we built systems that can **resume from where the agent was** when the errors occurred."
- "We combine the adaptability of AI agents built on Claude with **deterministic safeguards like retry logic and regular checkpoints**."
- "**Agents make dynamic decisions and are non-deterministic between runs, even with identical prompts.** This makes debugging harder."
- "we **proactively mitigated unintended side effects by setting explicit guardrails** to prevent the agents from spiraling out of control."
- Evaluation: "we usually **can't just check if agents followed the 'correct' steps** we prescribed in advance. Instead, we need flexible evaluation methods that judge whether agents **achieved the right outcomes while also following a reasonable process**."

**Effort-budget heuristics the doc encodes in prompts** (useful precedent for a policy budget): "Simple fact-finding requires just **1 agent with 3-10 tool calls**, direct comparisons might need **2-4 subagents with 10-15 calls each**, and complex research might use **more than 10 subagents**".

---

## 4. S4 — Tool / ACI design principles (companion to S1 Appendix 2)

Source: https://www.anthropic.com/engineering/writing-tools-for-agents ("Writing effective tools for agents — with agents", Sep 11, 2025).

Named anti-patterns and rules:
- "**More tools don't always lead to better outcomes.** A common error we've observed is tools that merely wrap existing software functionality or API endpoints—whether or not the tools are appropriate for agents."
- "**Too many tools or overlapping tools can also distract agents from pursuing efficient strategies.**"
- Consolidate: prefer `schedule_event` over `list_users`+`list_events`+`create_event`; `search_logs` over `read_logs`; `get_customer_context` over `get_customer_by_id`+`list_transactions`+`list_notes`.
- Namespacing: "Namespacing (grouping related tools under common prefixes) can help delineate boundaries between lots of tools... e.g., `asana_search`, `jira_search`".
- Return high-signal context; "eschew low-level technical identifiers (for example: `uuid`, `256px_image_url`, `mime_type`)". "merely resolving arbitrary alphanumeric UUIDs to more semantically meaningful and interpretable language... significantly improves Claude's precision in retrieval tasks".
- Token budget precedent: "**For Claude Code, we restrict tool responses to 25,000 tokens by default.**"
- Verbosity control: expose a `response_format` enum (`DETAILED` / `CONCISE`).
- "input parameters should be unambiguously named: instead of a parameter named `user`, try a parameter named `user_id`."
- Pointer to enforcement-relevant metadata: "if you're writing tools for an MCP server, **tool annotations help disclose which tools require open-world access or make destructive changes**."

---

## 5. S6 — Claude Agent SDK: what the SDK owns vs. what the caller owns

Source: https://code.claude.com/docs/en/agent-sdk/overview (+ `.md` twins).

### 5.1 Who runs the loop (stated)

> "An agent is an application that completes a task by planning its own steps and calling tools... The Agent SDK gives you the same tools, **agent loop**, and context management that power Claude Code, programmable in Python and TypeScript."

> "Both the TypeScript and Python SDKs **bundle a native Claude Code binary**, so most installs need no separate Claude Code install."

Positioning table (verbatim rows):
- **Agent SDK** — "Embed Claude Code's agent in your own Python or TypeScript application, **in a process you operate**" → "A library that runs the Claude Code binary, with Claude Code's capabilities, such as built-in tools, permissions, sessions, and hooks."
- **Client SDK** — "Call the Claude API directly from your own code" → "Direct access to the Claude API... **You write the tool loop yourself**, or let the client SDK's beta tool runner drive it."
- **Managed Agents** — "Have Anthropic host the agent, configured through the Claude API" → "A **hosted agent harness that runs the agent loop**, with sessions in an Anthropic-managed cloud sandbox or a self-hosted sandbox."

**Inference for this task:** the Agent SDK is the option where *your process* owns the loop — i.e., where a gate can actually block. The Client SDK leaves the loop to you entirely (you must build the gate); Managed Agents moves the loop into Anthropic's harness.

### 5.2 Capabilities table (the API surface the SDK owns)

| Capability | What it does | Doc link |
|---|---|---|
| Built-in tools | Read, write, edit files, run commands, search the web | /docs/en/tools-reference |
| **Hooks** | Run custom code at key points in the agent lifecycle | /docs/en/agent-sdk/hooks |
| **Subagents** | Spawn specialized agents for focused subtasks | /docs/en/agent-sdk/subagents |
| MCP | Connect external tools and data sources via MCP | /docs/en/agent-sdk/mcp |
| **Permissions** | "Control which tools run automatically, which need approval" | /docs/en/agent-sdk/permissions |
| **Sessions** | "Maintain context across exchanges, resume or fork later" | /docs/en/agent-sdk/sessions |
| Skills, commands, memory | Load from project `.claude/` and `~/.claude/` | /docs/en/agent-sdk/skills |
| Plugins | Package skills, agents, hooks, and MCP servers | /docs/en/agent-sdk/plugins |

### 5.3 The loop, message types, and turn/budget limits (S6a)

Loop: "**Receive prompt → Evaluate and respond → Execute tools → Repeat → Return result.**" "Each full cycle is one turn."
Message types yielded: `SystemMessage` (subtypes `init`, `compact_boundary`, `informational`, `worker_shutting_down`), `AssistantMessage`, `UserMessage`, `StreamEvent`, `ResultMessage`.
Limits: "`max_turns` / `maxTurns`, which **counts tool-use turns only**" and "`max_budget_usd` / `maxBudgetUsd` to cap turns based on a spend threshold." Doc's recommendation: "**Setting a budget is a good default for production agents.**"
Automatic compaction exists: `SystemMessage` subtype `"compact_boundary"` "fires after compaction".

### 5.4 Permissions — the six-step evaluation order (S6b) — **this is the enforcement core**

Verbatim order:

1. **Hooks** — "Run hooks first. A hook can **deny the call outright** or pass it on. A hook that returns `allow` does not skip the deny and ask rules below; those are evaluated regardless of the hook result. A `PreToolUse` hook allow also can't approve an `rm` or `rmdir` removal targeting a critical path."
2. **Deny rules** — "If a deny rule matches, the tool is **blocked, even in `bypassPermissions` mode**."
3. **Ask rules** — "If an ask rule matches, the call falls through to your `canUseTool` callback for confirmation, **even in `bypassPermissions` mode**."
4. **Permission mode** — applies `bypassPermissions` / `acceptEdits` / `plan` / fall-through.
5. **Allow rules** — `allowed_tools` / settings.json.
6. **`canUseTool` callback** — "If not resolved by any of the above, call your `canUseTool` callback for a decision. In `dontAsk` mode, this step is skipped and the tool is **denied**."

**Permission modes table (verbatim):**

| Mode | Description | Tool behavior (abridged, doc's wording) |
|---|---|---|
| `default` | Standard permission behavior | "calls that need approval and match no allow rule trigger your `canUseTool` callback" |
| `dontAsk` | Deny instead of prompting | "Any call that would otherwise prompt is **denied**... `canUseTool` is **never called**" |
| `acceptEdits` | Auto-accept file edits | "File edits and filesystem operations (`mkdir`, `rm`, `mv`, etc.) are automatically approved" — "Both apply only to paths inside the working directory or `additionalDirectories`" |
| `bypassPermissions` | Bypass permission checks | "Tools run without permission prompts, **except for the actions no mode auto-approves**" |
| `plan` | Planning mode | "file edits are **never auto-approved** and prompt through your `canUseTool` callback" |
| `auto` | Model-classified approvals | "A model classifier approves or denies permission prompts" |

**Critical warnings (verbatim, load-bearing for the framework):**
- "**Auto-approved tools never reach `canUseTool`.** A tool call approved at any earlier step... skips your `canUseTool` callback, so **permission checks you put there are silently bypassed for that tool**."
- "**For checks that must run on every tool call, use a `PreToolUse` hook: hooks run before every other step, and a hook deny applies even in `bypassPermissions` mode.**"
- "**`allowed_tools` does not constrain `bypassPermissions`.** ... Setting `allowed_tools=["Read"]` alongside `permission_mode="bypassPermissions"` still approves every tool, including `Bash`, `Write`, and `Edit`. If you need `bypassPermissions` but want specific tools blocked, use `disallowed_tools`."
- For a locked-down agent the doc recommends pairing `allowedTools` with `permissionMode: "dontAsk"`:
```typescript
const options = {
  allowedTools: ["Read", "Glob", "Grep"],
  permissionMode: "dontAsk"
};
```
- Deny semantics: `disallowed_tools=["Bash"]` **removes the tool definition** from the request ("Claude does not see the tool and cannot attempt it"); `disallowed_tools=["Bash(rm *)"]` keeps Bash but denies matching calls "**in every permission mode, including `bypassPermissions`**".
- A TS-only diagnostic exists for silent bypass: the SDK emits a Node warning with code **`CLAUDE_SDK_CAN_USE_TOOL_SHADOWED`** when a `canUseTool` callback is shadowed by `permissionMode: 'bypassPermissions'` or by bare `allowedTools` entries.
- **Subagent inheritance:** "A subagent runs in the parent session's permission mode unless you set `permissionMode` on its `AgentDefinition` and the parent session is in `default`, `dontAsk`, or `plan` mode. Even then, Claude Code **never applies a `"bypassPermissions"` value**." And: "Subagents may have different system prompts and **less constrained behavior** than your main agent, so inheriting `bypassPermissions` grants them full, autonomous system access."

### 5.5 Hooks (S6c)

Hook events (both SDKs unless noted): `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch` (TS-only), `UserPromptSubmit`, `UserPromptExpansion` (TS-only), `MessageDisplay` (TS-only), `Stop`, `StopFailure` (TS-only), `SubagentStart`, `SubagentStop`, `PreCompact`, `PostCompact` (TS-only), plus `PermissionRequest` (referenced from the permissions and user-input pages).
Doc's own stated use cases include: "**Block dangerous operations** before they execute, like destructive shell commands or unauthorized file access"; "**Log and audit** every tool call for compliance, debugging, or analytics"; "**Require human approval** for sensitive actions like database writes or API calls".
Output contract: `hookSpecificOutput.permissionDecision` ∈ `"allow" | "deny" | "ask" | "defer"`, plus `permissionDecisionReason` and `updatedInput`. Priority: "**`deny` takes priority over `defer`, which takes priority over `ask`, which takes priority over `allow`. If any hook returns `deny`, the operation is blocked regardless of other hooks.**"
Async escape hatch: returning `{async: true, asyncTimeout: N}` lets the agent continue immediately — "**Async outputs can't block, modify, or inject context**".
`defer` exists specifically for long-running approvals: from S6d — "If a user might take longer to respond than your process can reasonably stay running, register a `PreToolUse` hook that returns the `defer` decision instead of waiting in the callback, **so the process can exit and resume later from the persisted session**."

### 5.6 Approvals / user input (S6d)

- `canUseTool` (Python: `can_use_tool`) fires for (1) tool-needs-approval and (2) the `AskUserQuestion` tool.
- "The callback can **stay pending indefinitely. Execution remains paused until your callback returns.**"
- Same warning restated: "**The callback never fires for auto-approved tools.**"
- `PermissionRequest` hook is the sanctioned way to "send external notifications (Slack, email, push) when Claude is waiting for approval."

### 5.7 Subagents (S6e)

Three creation paths: programmatic `agents` parameter (recommended), filesystem markdown in `.claude/agents/`, and the built-in `general-purpose` subagent reachable via the `Agent` tool.
`AgentDefinition` fields shown: `description` (required — "Natural language description of when to use this agent"), `prompt` (required — system prompt), `tools` (tool allow-list), `model`, `permissionMode`.
Stated benefits: "**Context isolation**... only its final message returns to the parent"; "**Parallelization**"; "**Specialized instructions and knowledge**"; "**Tool restrictions** — subagents can be limited to specific tools, reducing the risk of unintended actions."

### 5.8 Sessions (S6f)

- "A session is the conversation history the SDK accumulates while your agent works. It contains your prompt, **every tool call the agent made, every tool result, and every response**. The SDK writes it to disk automatically."
- Explicit scope limit: "**Sessions persist the conversation, not the filesystem.** To snapshot and revert file changes the agent made, use file checkpointing."
- Options: `continue_conversation=True` / `continue: true` (most recent session in cwd), `resume=<session id>`, **fork** ("creates a new session that starts with a copy of the original's history. The original stays unchanged"), `persistSession: false` (TS) / `CLAUDE_CODE_SKIP_PROMPT_HISTORY` (Python).
- External persistence: /docs/en/agent-sdk/session-storage — "Mirror Agent SDK session transcripts to your own object store, key-value store, or database so other hosts can resume your sessions."

### 5.9 Checkpointing (S6g)

- "File checkpointing tracks file modifications made through the **Write, Edit, and NotebookEdit tools** during an agent session, allowing you to rewind files to any previous state."
- Enable with `enable_file_checkpointing=True` / `enableFileCheckpointing: true`; capture a checkpoint UUID from `UserMessage.uuid`; restore with `rewind_files()` (Python) / `rewindFiles()` (TS); result type `RewindFilesResult` with a `skippedLinks` count.
- **Coverage gap stated verbatim:** "**Only changes made through the Write, Edit, and NotebookEdit tools are tracked. Changes made through Bash commands (like `echo > file.txt` or `sed -i`) are not captured by the checkpoint system, and neither are edits a subagent applies**, except a skill with `context: fork` that runs in the foreground."
- "File rewinding restores files on disk to a previous state. It **does not rewind the conversation itself.**"

### 5.10 Deployment security (S6h) — where the enforcement boundary really sits

- Threat model: "their behavior can be influenced by the content they process: files, webpages, or user input. This is sometimes called **prompt injection**." "**Defense in depth is still good practice though.** For example, if an agent processes a malicious file that instructs it to send customer data to an external server, **network controls can block that request entirely.**"
- **The single most decision-relevant sentence for this framework:**
  > "Before executing bash commands, Claude Code parses them into an AST and matches the result against your permission rules... This is a **permission gate, not a sandbox**; apart from built-in safety checks such as the critical-path check on `rm` and `rmdir` and the protected paths list, **it does not infer whether a command is dangerous from its target path or effects.**"
- Named principle: "**A security boundary separates components with different trust levels. For high-security deployments, you can place sensitive resources (like credentials) outside the boundary containing the agent.**" Example given: a proxy outside the agent environment injects the API key so "the agent can make API calls, but **it never sees the credential itself**."
- **Least privilege** table: Filesystem ("Mount only needed directories, prefer read-only"), Network ("Restrict to specific endpoints via proxy"), Credentials ("Inject via proxy rather than exposing directly"), System capabilities ("Drop Linux capabilities in containers").
- **Defense in depth** layers: "Container isolation; Network restrictions; Filesystem controls; Request validation at a proxy."
- Isolation tech table with stated strengths: "Sandbox runtime — Good (secure defaults), Very low overhead, Low complexity"; "Containers (Docker) — Setup dependent"; "gVisor — Excellent (with correct setup), Medium/High"; "VMs (Firecracker, QEMU) — Excellent (with correct setup), High". Sandbox runtime = `@anthropic-ai/sandbox-runtime`, using `bubblewrap` (Linux) / `sandbox-exec` + Seatbelt (macOS).
- Stated invariant: "In all of these configurations, Claude Code (or your Agent SDK application) runs **inside** the isolation boundary... The security controls described below restrict what the agent can access from within that boundary."

---

## 6. S7 — Agent Skills specification (agentskills.io)

Source: https://agentskills.io/specification ("Specification", Agent Skills). Related: S7a home, S7b best practices, S7c client implementation, and S5 (Anthropic engineering announcement).

### 6.1 What a skill is, on disk

> "A skill is a directory containing, at minimum, a `SKILL.md` file:
```
skill-name/
├── SKILL.md          # Required: metadata + instructions
├── scripts/          # Optional: executable code
├── references/       # Optional: documentation
├── assets/           # Optional: templates, resources
└── ...               # Any additional files or directories
```"

### 6.2 Frontmatter fields and stated limits

| Field | Required | Constraints (verbatim from spec) |
|---|---|---|
| `name` | Yes | "Max 64 characters. Lowercase letters, numbers, and hyphens only. Must not start or end with a hyphen." Further: "May only contain unicode lowercase alphanumeric characters (a-z, 0-9) and hyphens"; "Must not contain consecutive hyphens (--); **Must match the parent directory name**" |
| `description` | Yes | "Max 1024 characters. Non-empty. Describes what the skill does and when to use it." "Should include specific keywords that help agents identify relevant tasks" |
| `license` | No | "License name or reference to a bundled license file." |
| `compatibility` | No | "Max 500 characters. Indicates environment requirements (intended product, system packages, network access, etc.)." |
| `metadata` | No | "Arbitrary key-value mapping" — "a map from string keys to string values" |
| `allowed-tools` | No | "Space-separated string of pre-approved tools the skill may use. **(Experimental)**" — example: `allowed-tools: Bash(git:*) Bash(jq:*) Read` |

### 6.3 Progressive disclosure (the spec's normative tiers)

> "1. **Metadata** (~100 tokens): The `name` and `description` fields are loaded at startup for all skills
> 2. **Instructions** (< 5000 tokens recommended): The full `SKILL.md` body is loaded when the skill is activated
> 3. **Resources** (as needed): Files (e.g. those in `scripts/`, `references/`, or `assets/`) are loaded only when required"

**Module-count / size guidance stated:**
- "**Keep your main `SKILL.md` under 500 lines.** Move detailed reference material to separate files."
- "Keep file references **one level deep** from `SKILL.md`. Avoid deeply nested reference chains."
- "Note that the agent will load this **entire file** once it's decided to activate a skill. Consider splitting longer `SKILL.md` content into referenced files."

S7b restates: "The specification recommends keeping `SKILL.md` under 500 lines and 5,000 tokens — just the core instructions the agent needs on every run." And gives the *why* for JIT references: "'Read `references/api-errors.md` if the API returns a non-200 status code' is more useful than a generic 'see references/ for details.'"

S7c gives the client-side token budget table:

| Tier | What's loaded | When | Token cost |
|---|---|---|---|
| 1. Catalog | Name + description | Session start | "~50-100 tokens per skill" |
| 2. Instructions | Full `SKILL.md` body | When the skill is activated | "<5000 tokens (recommended)" |
| 3. Resources | Scripts, references, assets | When the instructions reference them | Varies |

### 6.4 Trust / enforcement statements in the Skills corpus (important)

S7c, "Trust considerations" (verbatim):
> "**Project-level skills come from the repository being worked on, which may be untrusted** (e.g., a freshly cloned open-source project). Consider **gating project-level skill loading on a trust check** — only load them if the user has marked the project folder as trusted. **This prevents untrusted repositories from silently injecting instructions into the agent's context.**"

S7c also documents the discovery locations and the collision rule ("**project-level skills override user-level skills**"), the scanning bounds ("max depth of 4-6 levels, max 2000 directories"), and a lenient-validation policy ("Warn on issues but still load the skill when possible"; "Description is missing or empty → **skip the skill**").

S5 (Anthropic engineering, "Equipping agents for the real world with Agent Skills", Oct 16 2025 / updated Dec 18 2025) states the security posture:
> "Skills provide Claude with new capabilities through instructions and code. While this makes them powerful, it also means that **malicious skills may introduce vulnerabilities in the environment where they're used or direct Claude to exfiltrate data and take unintended actions.** We recommend **installing skills only from trusted sources.** When installing a skill from a less-trusted source, **thoroughly audit it before use.** ... pay attention to instructions or code within the skill that instruct Claude to connect to potentially untrusted external network sources."

S5 also gives the canonical "levels of progressive disclosure" framing and the key property: "Agents with a filesystem and code execution tools don't need to read the entirety of a skill into their context window... **the amount of context that can be bundled into a skill is effectively unbounded.**" Skills are stated to be supported "across Claude.ai, Claude Code, the Claude Agent SDK, and the Claude Developer Platform."

---

## 7. S8 — Model Context Protocol spec (protocol revision 2026-07-28)

Source: https://modelcontextprotocol.io/specification/2026-07-28/index ("Specification", MCP).

### 7.1 The primitive set as of 2026-07-28

**Server features (S8b, with the spec's own control-hierarchy table):**

| Primitive | Control | Description | Example |
|---|---|---|---|
| Prompts | **User-controlled** | "Interactive templates invoked by user choice" | Slash commands, menu options |
| Resources | **Application-controlled** | "Contextual data attached and managed by the client" | File contents, git history |
| Tools | **Model-controlled** | "Functions exposed to the LLM to take actions" | API POST requests, file writing |

**Client features (S8i):** Elicitation (current), Roots (**deprecated**), Sampling (**deprecated**). The spec index summary lists only: "Clients may offer the following features to servers: **Elicitation**".

**⚠ Taxonomy drift from the older canonical five-primitive set — verified, not inferred:**
- S8d: "**Deprecated**: The Roots feature is deprecated as of protocol version `2026-07-28` ([SEP-2577](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2577))... it remains in the specification for **at least twelve months** after this revision's release... New implementations **SHOULD NOT** adopt it; existing implementations **SHOULD** migrate to passing directories or files via tool parameters, resource URIs, or server configuration."
- S8e: "**Deprecated**: The Sampling feature is deprecated as of protocol version `2026-07-28` ([SEP-2577])... New implementations **SHOULD NOT** adopt it; existing implementations **SHOULD** migrate to **integrating directly with LLM provider APIs**."

**Inference:** a design written against "tools/resources/prompts/sampling/roots" as five co-equal primitives is now partly stale. As of 2026-07-28 the live server primitive set is prompts/resources/tools, and the live client primitive is elicitation.

**Extensions (S8, index):** Tasks ("Asynchronous execution of long-running operations, with polling, mid-flight input, and durable handles"), Skills over MCP, MCP Apps. "Extensions are always opt-in and require explicit support from both client and server, negotiated during initialization."

### 7.2 What MCP does and does NOT say about approval / authorization — **the direct answer**

**(a) The protocol explicitly disclaims enforcement. S8, index, verbatim:**
> "While **MCP itself cannot enforce these security principles at the protocol level**, implementors **SHOULD**:
> 1. Build robust consent and authorization flows into their applications
> 2. Provide clear documentation of security implications
> 3. Implement appropriate access controls and data protections
> 4. Follow security best practices in their integrations
> 5. Consider privacy implications in their feature designs"

And, in the same "Key Principles" list:
> "**Hosts must obtain explicit user consent before invoking any tool**"
> "Users must explicitly consent to and understand all data access and operations"
> "Users must retain control over what data is shared and what actions are taken"

**(b) The Tools page puts the human in the loop outside the protocol. S8c, verbatim:**
> "Tools in MCP are designed to be **model-controlled**, meaning that the language model can discover and invoke tools automatically... However, implementations are free to expose tools through any interface pattern that suits their needs—**the protocol itself does not mandate any specific user interaction model.**"

> "For trust & safety and security, there **SHOULD always be a human in the loop with the ability to deny tool invocations.** Applications **SHOULD**: Provide UI that makes clear which tools are being exposed to the AI model; Insert clear visual indicators when tools are invoked; **Present confirmation prompts to the user for operations, to ensure a human is in the loop**."

**(c) The architecture doc assigns enforcement to the HOST. S8a, verbatim:**
> "### Host — The host process acts as the container and coordinator:
> - Creates and manages multiple client instances
> - **Controls client connection permissions and lifecycle**
> - **Enforces security policies and consent requirements**
> - **Handles user authorization decisions**
> - Coordinates AI/LLM integration and sampling
> - Manages context aggregation across clients"

And, in Design Principles:
> "3. Servers should not be able to read the whole conversation, nor 'see into' other servers... **Cross-server interactions are controlled by the host. Host process enforces security boundaries.**"

**(d) Roots are explicitly NOT an access-control mechanism. S8d, verbatim:**
> "Roots inform servers about the directories and files the client considers relevant, so that servers can focus their operations accordingly. **They are informational guidance rather than an access-control mechanism. The protocol does not enforce that servers stay within roots.**"

**(e) Authorization in MCP is transport-level, OAuth-based, and OPTIONAL. S8g, verbatim:**
> "Authorization is **OPTIONAL** for MCP implementations. When supported: Implementations using an HTTP-based transport **SHOULD** conform to this specification. Implementations using an STDIO transport **SHOULD NOT** follow this specification, and instead retrieve credentials from the environment."
> "The Model Context Protocol provides authorization capabilities **at the transport level**, enabling MCP clients to make requests to restricted MCP servers on behalf of resource owners. This specification defines the authorization flow **for HTTP-based transports**."

Standards: OAuth 2.1 (draft-ietf-oauth-v2-1-13), RFC6750, RFC8414, RFC7591, RFC8707, RFC9728, RFC9207, OAuth Client ID Metadata Documents, OIDC Discovery. Roles: MCP server = OAuth 2.1 **resource server**; MCP client = OAuth 2.1 **client**; authorization server is separate and "beyond the scope of this specification."

**(f) Tool annotations are untrusted input. S8c, verbatim:**
> "**For trust & safety and security, clients MUST consider tool annotations to be untrusted unless they come from trusted servers.**"

**(g) Per-tool approval can be *requested* by the server, but the client still decides. S8c:**
- `tools/call` may return `resultType: "input_required"` with `inputRequests` (an `elicitation/create`) and `requestState`; the client retries with `inputResponses` and a **different JSON-RPC `id`** ("the JSON-RPC `id` **MUST** be different between the initial request and the retry").
- Authorization-scoped tool lists are allowed: "The set **MAY** vary by the authorization presented on the request — for example, returning only the tools the caller's granted scopes permit".

**(h) Security duties split between server and client (S8c, "Security Considerations", verbatim):**
> "1. Servers **MUST**: Validate all tool inputs; Implement proper access controls; Rate limit tool invocations; Sanitize tool outputs
> 2. Clients **SHOULD**: **Prompt for user confirmation on sensitive operations**; **Show tool inputs to the user before calling the server**, to avoid malicious or accidental data exfiltration; Validate tool results before passing to LLM; ... Implement timeouts for tool calls; **Log tool usage for audit purposes**"

**(i) Elicitation's hard secrets rule (S8f, verbatim):**
> "Servers **MUST NOT** use form mode elicitation to request sensitive information such as passwords, API keys, access tokens, or payment credentials. Servers **MUST** use URL mode for interactions involving such sensitive information."
> Clients "**MUST**": "Provide UI that makes it clear which server is requesting information"; "Respect user privacy and provide clear decline and cancel options"; "For form mode, allow users to review and modify their responses before sending"; "For URL mode, clearly display the target domain/host and **gather user consent before navigation** to the target URL".

**Bottom line (source-grounded): MCP has no in-protocol approval/enforcement boundary. Approval is explicitly a host/application concern; the protocol only *advises* (SHOULD/MUST NOT on the parties) and delegates enforcement to the host process.**

---

## 8. Must-answer synthesis

### 8.1 The complete named pattern set, with the sources' own selection criteria

Workflow patterns (S1): **prompt chaining, routing, parallelization (sectioning | voting), orchestrator-workers, evaluator-optimizer.** Plus the non-workflow category **agent** (model-directed loop), built on the **augmented LLM**.

Selection criteria, in the sources' own words:
- Simplest thing first: "finding the simplest solution possible, and only increasing complexity when needed" (S1); "do the simplest thing that works" (S2).
- Fixed, decomposable subtasks → **prompt chaining** (latency-for-accuracy).
- Distinct input categories + accurate classification → **routing**.
- Parallelizable subtasks or need for multiple perspectives/votes → **parallelization**.
- Unpredictable subtask decomposition → **orchestrator-workers** (S1: "in coding, for example, the number of files that need to be changed... depend on the task").
- Clear evaluation criteria + measurable iterative gain → **evaluator-optimizer**.
- Open-ended, unknown step count, cannot hardcode a path, trust in model decisions, trusted environment → **agent**.
- Breadth-first, parallelizable, exceeds one context window, many complex tools → **multi-agent / orchestrator-worker** (S3). Explicit non-fit: "most coding tasks involve fewer truly parallelizable tasks than research" (S3).
- Long-horizon context strategy choice (S2): compaction for back-and-forth; note-taking for milestone-based iteration; sub-agents for parallel research/analysis.

### 8.2 Which patterns the sources tie to long-running / safety-gated / evidence-producing work

| Concern | Patterns / mechanisms the sources actually tie to it |
|---|---|
| **Long-running** | Agent loop with stopping conditions ("maximum number of iterations", S1); `max_turns`/`maxTurns` + `max_budget_usd`/`maxBudgetUsd` (S6a); compaction + structured note-taking + sub-agents (S2); orchestrator-worker with Memory-persisted plan (S3); `defer` on `PreToolUse` so the process can exit and resume from a persisted session (S6c/S6d); sessions `continue`/`resume`/`fork` and external session storage (S6f); "durably execute code" + resume-from-failure (S3). |
| **Safety-gated** | `PreToolUse` hooks (only gate that runs before every other step and applies even under `bypassPermissions`, S6b/S6c); deny rules ("blocked, even in `bypassPermissions` mode"); `dontAsk` + `allowedTools` as the locked-down default; `canUseTool` for interactive approval; `plan` mode for propose-without-execute; `PermissionRequest` hook for external approval routing; subagent `permissionMode` inheritance rules; MCP "human in the loop with the ability to deny tool invocations" (S8c); Skills trust-gating for untrusted project folders (S7c). |
| **Evidence-producing** | `PostToolUse` hook to "Log all file changes to audit trail" (S6c, doc's own example); MCP "Log tool usage for audit purposes" (S8c); sessions persist "every tool call the agent made, every tool result, and every response" (S6f) + external session storage (S6f); file checkpointing with per-message checkpoint UUIDs (S6g); CitationAgent + citation-accuracy rubric (S3); "Prioritize transparency by explicitly showing the agent's planning steps" (S1); observability via OpenTelemetry and cost/todo tracking (S6 capabilities index). |
| **General-purpose** | Prompt chaining, routing, parallelization (sectioning/voting), evaluator-optimizer, and the augmented LLM building block are presented without long-horizon or safety framing. `evaluator-optimizer` is the one general workflow with a natural evidence artifact (the critique). |

### 8.3 Where the sources say the ENFORCEMENT boundary lives (quotes)

1. **The model is NOT the boundary.** S1: agents "must have some level of trust in its decision-making" and need "appropriate guardrails"; S3: "we proactively mitigated unintended side effects by setting explicit guardrails". Nothing in S1–S5 asserts the model enforces policy.
2. **The harness/SDK is the first enforcement point, and only if the caller wires it.** S6b/S6c: hooks run first, "a hook deny applies even in `bypassPermissions` mode"; "For checks that must run on every tool call, use a `PreToolUse` hook"; deny rules "blocked, even in `bypassPermissions` mode".
3. **A runtime gate is explicitly NOT a sandbox.** S6h, verbatim: "**This is a permission gate, not a sandbox**; ... it does not infer whether a command is dangerous from its target path or effects."
4. **The real boundary is an OS/process/network boundary outside the agent.** S6h: "A security boundary separates components with different trust levels. For high-security deployments, you can place sensitive resources (like credentials) **outside the boundary containing the agent**"; "In all of these configurations, Claude Code (or your Agent SDK application) runs **inside** the isolation boundary".
5. **In MCP, the boundary is the HOST, not the protocol.** S8 index: "**MCP itself cannot enforce these security principles at the protocol level**"; S8a: Host "**Enforces security policies and consent requirements**", "**Handles user authorization decisions**", "**Host process enforces security boundaries**"; S8d: roots "are **informational guidance rather than an access-control mechanism**".
6. **MCP authorization is transport-level and OPTIONAL.** S8g: "Authorization is **OPTIONAL** for MCP implementations"; STDIO implementations "**SHOULD NOT** follow this specification, and instead retrieve credentials from the environment."

### 8.4 Explicit anti-patterns / "do not do this" statements (consolidated)

- "**More tools don't always lead to better outcomes.**" / "Too many tools or overlapping tools can also distract agents" / "**bloated tool sets**" are "one of the most common failure modes" (S4, S2).
- "we do **not** recommend" stuffing edge-case laundry lists into prompts (S2).
- "**Don't hesitate to reduce abstraction layers and build with basic components as you move to production**" (S1); "don't hesitate to reduce abstraction layers" + "**ensure you understand the underlying code**" (S1).
- "you should consider adding complexity **only when it demonstrably improves outcomes**" (S1).
- "**most coding tasks involve fewer truly parallelizable tasks than research**" → multi-agent is not a fit (S3).
- "**Auto-approved tools never reach `canUseTool`**" → don't put mandatory checks in `canUseTool` (S6b).
- "`allowed_tools` does **not** constrain `bypassPermissions`" → don't rely on allow-lists as a deny mechanism (S6b).
- "Only changes made through the Write, Edit, and NotebookEdit tools are tracked" → don't assume checkpointing covers Bash or subagent edits (S6g).
- "Sessions persist the conversation, **not the filesystem**" (S6f).
- "**Async outputs can't block, modify, or inject context**" → don't use `async: true` for gates (S6c).
- "clients **MUST** consider tool annotations to be **untrusted** unless they come from trusted servers" (S8c).
- "Servers **MUST NOT** use form mode elicitation to request sensitive information" (S8f).
- "**New implementations SHOULD NOT adopt** [Roots/Sampling]" as of 2026-07-28 (S8d, S8e).
- "install skills only from trusted sources"; "gating project-level skill loading on a trust check" (S5, S7c).
- "**Async outputs**... **Use them only for side effects**" (S6c).

---

## Caveats / Not Found

1. **`platform.claude.com/docs/en/agents-and-tools/agent-skills/overview(.md)` was unreachable.** Both the HTML and `.md` forms returned a cross-origin redirect to `https://www.anthropic.com`, which this session's fetcher will not follow automatically, and I could not determine the final target path. The Agent Skills content above therefore comes from **agentskills.io** (the spec) and the **anthropic.com/engineering** Agent Skills article, not from the Claude Platform docs page. The platform page's own wording on progressive disclosure and limits is therefore **not** quoted here.
2. **`docs.claude.com/en/api/agent-sdk/*` and `platform.claude.com/docs/en/api/agent-sdk/*` are redirect stubs**, not the live docs. The live Agent SDK docs are at **code.claude.com/docs/en/agent-sdk/**. Any older tutorial or internal doc that cites `docs.claude.com/en/api/agent-sdk/...` is citing a path that no longer resolves directly. `code.claude.com/docs/en/api/agent-sdk/overview` returns **404** (verified).
3. **The Agent SDK docs pages carry no publish/update date or SDK version string** on the fetched pages (only scattered per-feature "requires Claude Code v2.1.NNN or later" notes, e.g. v2.1.199, v2.1.212, v2.1.216, v2.1.218, v2.1.259, v2.1.267). I did not pin a single docs version.
4. **S1 is explicitly stale on tooling.** Its own banner says the tooling landscape changed since Dec 2024 and redirects to "Claude Managed Agents". I could not fetch the Managed Agents docs in this session (not attempted; out of assigned scope), so the *current* tooling/framework recommendation is **not** verified here — only the pattern taxonomy is.
5. **MCP `annotations` hint fields were not verifiable.** The 2026-07-28 Tools page mentions `annotations` ("Optional properties describing tool behavior") and warns clients to treat them as untrusted, but the page as fetched contains **no** `readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint` definitions (searches for "hint", "destructive", "readOnly", "idempotent", "openWorld" on that page all returned nothing). The hint vocabulary may have moved to `/specification/2026-07-28/schema`, which I did not fetch. **Do not cite hint field names as current without checking the schema page.**
6. **MCP `/specification/2026-07-28/client/index.md` returns "Page Not Found."** The client-feature index lives only in `llms.txt`; I read the individual `client/roots`, `client/sampling`, `client/elicitation` pages directly instead.
7. **Anthropic's "Managed Agents" and "a harness for every task / dynamic workflows in Claude Code"** are referenced by the sources I read (S1 banner, S6 overview) but were **not fetched**. They may contain the current, more explicit statement of who owns the loop and where gates live. Flagged as the highest-value follow-up.
8. **No first-party source in this corpus states a numeric context budget** for the base agent's own context window (only relative guidance: "~100 tokens" per skill catalog entry, "<5000 tokens" per `SKILL.md`, "under 500 lines", "25,000 tokens" default tool-response cap in Claude Code, "200,000 tokens" as the point at which the Research lead agent's context truncates). If the parent needs a hard budget number for the framework, it is **not sourced here**.
9. **Nothing fetched states a policy-decision audit-log schema** (fields, signing, retention). The sources say *to* log ("Log all file changes to audit trail", "Log tool usage for audit purposes") but specify no format. This is an inference gap, not a finding.
10. Dates in the "Sources" table are the publication dates printed on the pages. Where I wrote "No date shown", the page genuinely displayed none.
