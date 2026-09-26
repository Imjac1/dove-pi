# Research: frontier harness architecture, read from source

- **Query.** For each current shipping agent harness: where is the loop and who owns it; what is the
  pre-execution boundary and can an action route around it; what is a session, concretely; how is the
  model-visible context assembled each turn; how do subagents get context and what comes back; what
  happens when a tool call fails or is refused. Plus the four must-answers (core abstraction and
  replaceability; the convergent set named by file; the genuine differences; the first file to read).
- **Scope.** Six harness families, default branches, read this session:
  `anthropics/claude-agent-sdk-python` (+ `claude-agent-sdk-typescript`), `openai/openai-agents-python`,
  `google/adk-python`, `langchain-ai/langgraph` (+ its `prebuilt` and `checkpoint` packages),
  `All-Hands-AI/OpenHands` (which redirects to `OpenHands/OpenHands`) and the Python runtime it now
  depends on, `OpenHands/software-agent-sdk`, and `princeton-nlp/SWE-agent` (redirects to
  `SWE-agent/SWE-agent`).
  **Out of scope:** Trellis, `src/core/` of this repository, and any judgement about which harness to
  adopt. This file is description only.
- **Date.** 2026-09-26.
- **Fetch methods actually used.**
  - `raw.githubusercontent.com/<owner>/<repo>/main/<path>` for **every file I read**. It succeeded on
    every attempt.
  - `cdn.jsdelivr.net/gh/...` was wired in as a fallback for each fetch and was **never needed**. The
    only two 404s I hit were genuine path misses (`src/agents/handoffs.py`, which is now a package
    `src/agents/handoffs/`), not transport failures.
  - `ungh.cc/repos/<owner>/<name>` for stars / default branch / `pushedAt`, and
    `ungh.cc/repos/<owner>/<name>/files/<branch>` for **full recursive file lists** (used instead of the
    GitHub tree API for adk-python, langgraph, OpenHands and SWE-agent).
  - `api.github.com` for three recursive trees and five head-commit lookups. It returned **403 (rate
    limit) on the 6th commit call**, so head commits for OpenHands/OpenHands, OpenHands/software-agent-sdk
    and SWE-agent come from `ungh.cc`'s `pushedAt` instead. Labelled below.
  - `img.shields.io/github/stars/...json` for a first star reading.
  - **Not used:** the Managed Agents overview page and its interface documentation. I did not fetch it
    this session; where it is relevant I say so and mark the claim as inherited, not verified.

## Repositories, with the metadata the task requires

| repo | stars | last commit (head) | licence | notes |
| --- | --- | --- | --- | --- |
| `anthropics/claude-agent-sdk-python` | 8,167 | `36f95486ee`, 2026-09-25T22:32:23Z, "docs: update changelog for v0.2.160" | **MIT** | readable source, but the loop is not in it |
| `anthropics/claude-agent-sdk-typescript` | 1,771 | `fc99cf7e95`, 2026-09-25T22:55:29Z, "ci: pin the model for issue triage (#480)" | **NOT open source** - "(c) Anthropic PBC. All rights reserved. Use is subject to Anthropic's Commercial Terms of Service" (`LICENSE.md`) | **no `src/` on the default branch** - 50 files, README + examples + session-store examples. Closed |
| `openai/openai-agents-python` | 29,707 | `588826c5be`, 2026-09-25T22:05:13Z, "fix(sessions): reject blank SQLite branch names (#5179)" | MIT | |
| `google/adk-python` | 21,649 | `044a1ec3f4`, 2026-09-26T04:57:24Z, "fix: classify plugin output before persisting events" | Apache-2.0 | |
| `langchain-ai/langgraph` | 42,312 | `7daa3ab49d`, 2026-09-23T17:56:01Z, "feat(cli): place self-hosted deployments on a listener (#9056)" | MIT | prebuilt agent + HITL are being moved out to `langchain` |
| `OpenHands/OpenHands` | 89,203 | not fetched (403); `pushedAt` 2026-09-26T12:48:49Z | MIT | **default branch is now a TypeScript/Electron app ("Agent Canvas"), 2,382 files, no Python runtime** |
| `OpenHands/software-agent-sdk` | 1,172 | not fetched (403); `pushedAt` 2026-09-26T01:37:50Z | MIT | the Python agent runtime, split into `openhands-sdk` / `openhands-agent-server` / `openhands-tools` / `openhands-workspace` |
| `SWE-agent/SWE-agent` | 20,412 | not fetched (403); `pushedAt` 2026-09-21T22:02:50Z | MIT | |

**A redirect the parent should know about:** `All-Hands-AI/OpenHands` and `princeton-nlp/SWE-agent` both
resolve to new owners. More importantly, **the OpenHands Python agent runtime is no longer in the
OpenHands repository.** If any prior research in this task describes OpenHands as
`All-Hands-AI/OpenHands` with `openhands/controller/agent_controller.py`, that description is stale
against the branch I read.

## Exact files read

Whole-file reads are marked **full**; everything else is a definition index plus named line ranges.

**claude-agent-sdk-python** - `src/claude_agent_sdk/query.py` (**full**, 133 lines);
`src/claude_agent_sdk/_internal/query.py` (def index, then 577-706 read in body);
`src/claude_agent_sdk/types.py` (107-137 `AgentDefinition`, 1515-1745 `SessionKey`/`SessionStoreEntry`/
`SessionStore`, 1834-1880 `CanUseToolShadowedWarning`/`_whole_tool_allowed`/`_get_can_use_tool_shadowed_warning`);
`src/claude_agent_sdk/_internal/transport/subprocess_cli.py` (def index + `_find_bundled_cli`/
`_build_command`); `scripts/download_cli.py` (head); `src/claude_agent_sdk/_internal/sessions.py`
(grep for `subagent`, then the `list_subagents`/`get_subagent_messages` docstrings).

**openai-agents-python** - `src/agents/run.py` (def index, 590-720 read in body, grep for the driver loop);
`src/agents/run_internal/run_loop.py` (def index, 2418-2560 read in body);
`src/agents/run_internal/tool_execution.py` (def index, 1780-2060 and 2523-2798 read in body);
`src/agents/agent.py` (def index, 606-900 read in body); `src/agents/memory/session.py` (head);
`src/agents/handoffs/history.py` (def index, `nest_handoff_history` + `_nest_handoff_history_with_provenance`
read in body); `src/agents/extensions/handoff_filters.py` and `handoff_prompt.py` (heads).

**adk-python** - `src/google/adk/sessions/session.py` (**full**, 74 lines);
`src/google/adk/runners.py` (def index, 1030-1180 read in body);
`src/google/adk/flows/llm_flows/base_llm_flow.py` (def index, 351-465 read in body);
`src/google/adk/agents/base_agent.py` (def index only); `src/google/adk/flows/llm_flows/functions.py`
(now a re-export shim); `src/google/adk/flows/llm_flows/tools/_caller.py` (def index, 640-770 read in body,
758-950 scanned); `.../tools/_functions.py`, `.../tools/_confirmation.py`,
`.../core/_function_call_postprocessor.py`, `.../tools/_error_handler.py` (def indexes);
`src/google/adk/sessions/base_session_service.py` (method list); `src/google/adk/events/event.py`
(field list); `src/google/adk/tools/agent_tool.py` (def index, `run_async` read in body including the tail).

**langgraph** - `libs/langgraph/langgraph/pregel/_loop.py` (def index, `tick` 599-690 read in body);
`libs/langgraph/langgraph/pregel/main.py` (grep only: `while loop.tick()` at 2964 and 3437);
`libs/checkpoint/langgraph/checkpoint/base/__init__.py` (39-150 and 177-340 read in body);
`libs/prebuilt/langgraph/prebuilt/tool_node.py` (124-300 and 383-445 read in body, rest def-indexed);
`libs/prebuilt/langgraph/prebuilt/chat_agent_executor.py` (def index, `create_react_agent`
signature+docstring read); `libs/prebuilt/langgraph/prebuilt/interrupt.py` (**full**, 106 lines);
`libs/langgraph/langgraph/pregel/_messages.py` (def index + head).

**OpenHands/OpenHands** - `README.md` (fetched, head read); full recursive file list.

**OpenHands/software-agent-sdk** -
`openhands-sdk/openhands/sdk/conversation/impl/local_conversation.py` (def index, `run` 1904-2090 read);
`.../conversation/base.py` (def index); `.../conversation/state.py` (field list 82-260);
`.../conversation/conversation.py` (def index); `.../agent/agent.py` (def index, `_step` 645-840 scanned,
`_execute_actions` 570-645, `_requires_user_confirmation` 1046-1115, `_execute_action_event` 1384-1448 read);
`.../agent/base.py` (def index); `.../security/confirmation_policy.py` (def index);
`.../subagent/registry.py` (def index); full recursive file list.

**SWE-agent** - `sweagent/agent/agents.py` (def index, 533-560 / 936-1062 / 1061-1235 / 1235-1295 read in
body); `sweagent/agent/action_sampler.py`, `sweagent/tools/tools.py`,
`sweagent/agent/history_processors.py` (def indexes).

**Not read, and it matters:** `sweagent/models.py`, `sweagent/environment/swe_env.py`,
`sweagent/tools/commands.py`; `src/agents/handoffs/__init__.py`; ADK's
`src/google/adk/workflow/_node_runner.py` (the newer node runtime `Runner` delegates to);
`openhands-agent-server/*` bodies.

---
## What the sources state

Claims in this section are what a repository *says about itself* in prose, docstrings or licence text -
not what I traced through code. Each is labelled with where it was read.

1. **Anthropic, about its own SDK.** `claude-agent-sdk-python/README.md` and `query.py`'s docstring
   describe two entry modes: `query()` is "unidirectional ... stateless ... no interrupts", while
   `ClaudeSDKClient` is for "interactive, stateful conversations". `query.py` also documents five
   permission modes with their semantics in prose: `default` (CLI prompts for dangerous tools),
   `acceptEdits`, `plan` (plan-only, no tool execution), `bypassPermissions` ("Allow all tools (use with
   caution)"), `dontAsk` ("Deny anything not pre-approved by allow rules"), and `auto` ("A model
   classifier approves or denies each tool call").
2. **Anthropic, about the TS SDK's legal status.** `claude-agent-sdk-typescript/LICENSE.md`: "(c) Anthropic
   PBC. All rights reserved. Use is subject to Anthropic's Commercial Terms of Service." The README
   repeats it under "License and terms". The Python SDK is MIT. The TS repository also states its npm
   package `@anthropic-ai/claude-agent-sdk` is the distribution vehicle, and the repo itself ships
   examples and session-store examples.
3. **OpenAI, about handoffs versus agent-as-tool.** `src/agents/agent.py`, `as_tool` docstring, verbatim:
   "In handoffs, the new agent receives the conversation history. In this tool, the new agent receives
   generated input." and "In handoffs, the new agent takes over the conversation. In this tool, the new
   agent is called as a tool, and the conversation is continued by the original agent."
4. **LangChain, about the prebuilt agent's future.** `chat_agent_executor.py`, `create_react_agent`
   docstring: "This function is deprecated in favor of `create_agent` from the `langchain` package, which
   provides an equivalent agent factory with a flexible middleware system." `prebuilt/interrupt.py`
   module-wide deprecation: `HumanInterruptConfig`, `ActionRequest`, `HumanInterrupt` "has been moved to
   `langchain.agents.interrupt`".
5. **SWE-agent, about itself.** `sweagent/agent/agents.py`, `run` docstring: "This method contains the
   main loop that repeatedly calls `self._step` until the problem is solved." `forward_with_handling`
   docstring: "if the model outputs a bash command that has syntax errors, we will not execute it but
   requery the model for a corrected command."
6. **Anthropic Managed Agents Overview** - the session/harness/sandbox split,
   `execute(name,input)->string`, `wake(sessionId)`, `getSession(id)`, "the session is not the context
   window". **I did not fetch this page.** Those quotations are inherited from this task's sibling file
   `research/harness-shape-and-prior-art.md`, which recorded them as [FETCHED]. Treat as second-hand.
   It is vendor *engineering* writing, not vendor *marketing*; I name it as the former. No claim anywhere
   in the rest of this file comes from a vendor marketing page.

---

## What I read in code

### 1. Where is the loop, and who owns it?

Every answer below is the file that contains the driver, the file that contains one step, and whether a
caller can supply its own.

**claude-agent-sdk-python - the loop is not in the SDK at all.**
`query()` (`query.py`:11) builds an `InternalClient` and iterates `client.process_query`.
`SubprocessCLITransport` (`_internal/transport/subprocess_cli.py`:224) spawns the `claude` executable -
`_build_command` (:574) starts `[self._cli_path, "--output-format", "stream-json", "--verbose"]`, and
`_find_bundled_cli` (:341) looks for a binary in `_bundled/`. `scripts/download_cli.py`'s docstring:
"Download Claude Code CLI binary for bundling in wheel." The SDK then speaks newline-delimited JSON over
the child's stdio (`_LineFramer` :163, `_parse_stdout_line` :199).
**Conclusion: the loop is inside a closed native binary. There is no repository I can read that contains
it.** Everything in the SDK is transport, message parsing, session mirroring, and the client half of a
control protocol. **A caller cannot supply its own loop** through the documented surface. The only seam
that replaces it is `Transport` (the `query()` docstring says "the SDK calls its `connect()`, delivers the
prompt over `write()`"), and the docstring warns that on a custom transport "Command-line options in
`options` ... are not applied ... and store-backed session resume is skipped." Supplying a `Transport`
means implementing the entire control protocol yourself; it is a whole-harness replacement wearing a
plug's shape, not a loop plugin.

**openai-agents-python - loop owned by `AgentRunner._run_impl`, replaceable by design.**
Driver: `while True:` at `src/agents/run.py`:987, inside `_run_impl` which begins at :590. One turn is
`run_single_turn` (`run_internal/run_loop.py`:2418), which gathers the agent's tools, system prompt and
handoffs, assembles the input, calls `get_new_response` (:2553, the model call + retries + hooks), then
delegates to `get_single_step_result_from_response`. Turn accounting is `current_turn += 1` at run.py:1506
with the `max_turns` ceiling at :1507.
**Replaceable, explicitly:** `set_default_agent_runner(runner)` / `get_default_agent_runner()`
(run.py:196, :222). `Runner` (run.py:259) is a thin public facade over `AgentRunner` (run.py:548). Subclass
`AgentRunner`, install it, and the process's loop is yours.

**adk-python - three layers, and the ownership is split.**
- Entry: `Runner.run_async` (`src/google/adk/runners.py`:1030). Body-read: it resolves/creates the session,
  decides `agent_to_run` (via `_find_agent_to_run`, which reads the session's transfer history; or the root
  agent when the root coordinates task-mode sub-agents), and delegates to `_run_node_async`. It accepts an
  `invocation_id` "to resume an interrupted invocation".
- Step: `BaseLlmFlow.run_async` (`src/google/adk/flows/llm_flows/base_llm_flow.py`:352) - `while True:` at
  :356 - and `_run_one_step_async` (:389) whose docstring is exact: **"One step means one LLM call."**
- Newer path: `Runner.run_async` prefers `_run_node_async` for `BaseNode` agents, i.e. the node runtime in
  `src/google/adk/workflow/_node_runner.py`, which I did **not** read.
**Extensible, not replaceable.** The flow object itself is fixed, but `BaseLlmFlow` exposes
`replace_request_processor` / `insert_request_processor_before` / `insert_request_processor_after` /
`remove_request_processor` (:193, :217, :234, :264) - you can rewrite the *request pipeline* inside the
step. Note the event model is a generator: `AsyncGenerator[Event, None]` all the way down, which is
load-bearing for streaming and for the two loop layers sharing one event stream.

**langgraph - the loop is the engine, and it is not replaceable.**
`PregelLoop` (`libs/langgraph/langgraph/pregel/_loop.py`:158); `tick()` (:599) is **one superstep**:
it checks `self.step > self.stop`, computes `prepare_next_tasks(...)`, optionally re-applies pending
writes, and returns `True` if more work remains. Driver: `while loop.tick():` at
`libs/langgraph/langgraph/pregel/main.py`:2964 (sync) and :3437 (async). Async variant
`AsyncPregelLoop` at _loop.py:1722.
**What is replaceable is the graph, not the loop:** the state schema and its channel reducers
(`libs/langgraph/langgraph/channels/*`), the checkpointer, the store, and your nodes. `tick` is the
substrate.

**OpenHands - loop owned by `LocalConversation.run`, step owned by `Agent._step`.**
`run()`: `openhands-sdk/openhands/sdk/conversation/impl/local_conversation.py`:1904, a `while True:` that
calls `self.agent.step(self, on_event=self._on_event, on_token=self._on_token)` under a state lock, with
pause/stuck conditions checked before the step, a stop-hook veto ("Stop hook denied agent stopping") that
rewrites the status back to `RUNNING` and `continue`s, and an explicit confirmation-mode transition
(`WAITING_FOR_CONFIRMATION` to `RUNNING`) before each step.
`Agent.step` / `_step`: `.../agent/agent.py`:636 / :645. Body-read structure: if there are **unmatched
(pending) actions** on the active branch, execute those and return (the "implicit confirmation" path);
else if the last user message was blocked by a hook, stop; else resolve runtime metadata, build
`prepare_llm_messages(...)` from the cached view, call `self.llm.generate(...)`, `classify_response(...)`,
and dispatch to `_handle_tool_calls / _handle_content_response / _handle_no_content_response`.
**The step is replaceable** (`AgentBase` is an ABC with `step`/`astep`, and ACP agents are a separate
`agent_kind`); the conversation loop is not.

**SWE-agent - loop owned by `DefaultAgent.run`, and it is nine lines.**
`sweagent/agent/agents.py`:1265:

~~~text
self.setup(env=env, problem_statement=problem_statement, output_dir=output_dir)
self._chook.on_run_start()
step_output = StepOutput()
while not step_output.done:
    step_output = self.step()
    self.save_trajectory()
~~~

`step` (:1235) = `self.forward_with_handling(self.messages)` + history/trajectory bookkeeping.
`forward` (:1006) = one model query + `self.tools.parse_actions(output)` then `handle_action(step)`.
`handle_action` (:936) = `self._env.communicate(input=run_action, timeout=..., check=...)`.
**Replaceable:** `AbstractAgent` declares `step`/`run`, and `RetryAgent` (:257) is a working example of
replacing the loop by wrapping it.
**The architectural bet, stated by absence:** there is no tool registry and no JSON tool schema in this
path. The model emits a bash command; the environment runs it. `ToolHandler` is a *parser and config*, not
a dispatcher.
### 2. What is the pre-execution boundary, and can an action route around it?

**claude-agent-sdk-python - the boundary is a control-protocol callback the CLI calls back into the host.**
`Query._handle_control_request` (`_internal/query.py`:577) dispatches three subtypes, body-read:
- `can_use_tool` - the host's `can_use_tool(tool_name, input, context)`. An allow may return
  `updatedInput` (the arguments the CLI will actually use) and `updatedPermissions`; a deny returns a
  `message` and may set `interrupt` to end the run.
- `hook_callback` - the host's registered callback, addressed by `callback_id`, matched by
  `HookMatcher` (`types.py`:606) against hook events `PreToolUse`, `PostToolUse`,
  `PostToolUseFailure`, `UserPromptSubmit`, `Stop`, `SubagentStop`, `SubagentStart`, `PreCompact`,
  `Notification`, `PermissionRequest`, `SessionStart` (`types.py`:299-525).
- `mcp_message` - the host's in-process MCP server.
Anything else raises. The response is written back as a `control_response`; **failures are converted to an
error response with a string, not a raised exception** (:666-706).
**Can an action route around it? Yes, by configuration - and the SDK's own code says so.**
`CanUseToolShadowedWarning` (`types.py`:1835) documents that "can_use_tool is set but some tool calls are
auto-approved before it runs", and `_get_can_use_tool_shadowed_warning` produces: with
`permission_mode == "bypassPermissions"`, "can_use_tool will not be invoked: permission_mode
'bypassPermissions' auto-approves every tool call (except explicit deny rules) before the callback is
consulted. To gate every tool call, use a PreToolUse hook instead."
`_whole_tool_allowed` defines the second bypass: an `allowed_tools` entry with no `(...)` specifier, or an
empty or lone-wildcard specifier (`"Read"`, `"Read()"`, `"Read(*)"`), "allows a whole tool" outright.
The code's own remedy is a `PreToolUse` hook - which is still *executed by the CLI*, so the host never owns
the call site, only the verdict.

**openai-agents-python - the boundary is inside the loop, in the batch executor.**
`_FunctionToolBatchExecutor._run_single_tool`, `src/agents/run_internal/tool_execution.py`:1780. Order
body-read:
1. `function_needs_approval(...)` / a cached approval evaluation (:1903). If unresolved, the function
   **returns an interruption item instead of executing** - the tool is not called.
2. `_execute_tool_input_guardrails(...)` (:1931, and again at :2029 immediately before invoke). A
   `reject_content` behavior returns a message that becomes the tool's *output* (a
   `function_rejection_item`); a `raise_exception` behavior raises `ToolInputGuardrailTripwireTriggered`.
3. `hooks.on_tool_start(tool_context, public_agent, func_tool)` and the agent's own hooks, gathered
   concurrently (:2040).
4. `_invoke_tool_and_run_post_invoke(...)` then `_invoke_function_tool_with_metadata(...)` (:2079).
5. `_execute_tool_output_guardrails(...)` (:2128) - can replace the result with a rejection message.
The tools themselves never see steps 1-3. `execute_approved_tools` (:2523) is the HITL resume path and goes
straight from an approved interruption to `execute_function_tool_calls` - **it re-checks the approval
status but does not re-run the input guardrails.** **Routing around:** the boundary belongs to
`execute_function_tool_calls`, not to the tool object, so anything holding the `FunctionTool` and calling
`on_invoke_tool` directly is outside it. Tools declared `is_enabled=False` are hidden from the model but
still present in the map.

**adk-python - a six-step pipeline with a confirmation gate that holds for every tool.**
`_execute_single_prepared_call`, `.../llm_flows/tools/_caller.py`:759. Body-read order (the code's own
comments number them):
1. plugin `run_before_tool_callback` (:797) - may override the response entirely.
2. agent `canonical_before_tool_callbacks` (:807).
3. If the tool name resolved to nothing, the before-tool callbacks get their chance first; then
   `run_on_tool_error_callbacks` / `build_tool_not_found_response` answer the call, and after-tool
   callbacks are skipped "because they describe a tool run that did not happen" (:815-833).
4. Otherwise `_apply_confirmation_gate(tool, function_args, tool_context)` (:714, called at :847), then
   `tool_runner()`. If the gate raises, it is handled like a tool that raises.
5. plugin `run_after_tool_callback`; 6. `canonical_after_tool_callbacks`, which may substitute the response.
Separately, `_prepare_single` (:665) makes an explicit decision worth noting: "No callback and no tool runs
here. The before-tool callbacks belong to the execute phase, next to the after-tool callbacks they pair
with" - the prepare/execute split was introduced so that a turn with no awaits completes one call before
starting the next.
The refusals themselves, `_apply_confirmation_gate`: if the tool requires confirmation and
`tool_context.tool_confirmation` is `None`, the gate calls `request_confirmation(hint=...)`, sets
`skip_summarization = True` with the comment "The pause is not a tool result for the model to summarize;
without this the flow re-invokes the model, which calls the tool again", and returns
`{'error': 'This tool call requires confirmation, please approve or reject.'}`. If a confirmation exists
and is not confirmed, it returns `{'error': 'This tool call is rejected.'}`. Note the asymmetry the author
chose and documented: "The hook is declared to answer with a bool, so anything other than True lets the
call through."
**Routing around:** the gate is in `_execute_single_prepared_call`, so an `AgentTool`/`BaseTool` whose
`run_async` invokes a sibling tool directly skips steps 1-6 entirely. The plugin's before-tool callback is
also explicitly allowed to answer *without* the gate.

**langgraph - the boundary is an optional wrapper the graph author installs, plus two interrupt mechanisms.**
- `ToolNode(wrap_tool_call=..., awrap_tool_call=...)`, `libs/prebuilt/langgraph/prebuilt/tool_node.py`:743,
  :755. `_run_one` (:1014) calls the wrapper; **if no wrapper is configured it goes straight to
  execution** (:1044-1055).
- The wrapper's argument is a `ToolCallRequest` (:133) of `{tool_call, tool, state, runtime}` with an
  `override()` method (:160, returns a replaced dataclass) and an `execute` callable whose docstring says
  it **"CAN BE CALLED MULTIPLE TIMES"** (:236). So the wrapper can rewrite arguments, short-circuit by
  returning a `ToolMessage` without executing, or implement retry itself.
- Two interrupt granularities: `interrupt_before` / `interrupt_after` pause *between* supersteps
  (`_loop.py`:657-662 raises `GraphInterrupt()`), and the graph-level `interrupt()` pauses *inside* a node.
- `.../prebuilt/interrupt.py` is **entirely deprecated** - the HITL middleware moved to
  `langchain.agents.interrupt`.
**Routing around: yes, trivially and by design.** `ToolNode` is a node you put on an edge. Any other node
may call the underlying function or invoke a model with bound tools without going through it. The boundary
is a component, not a checkpoint on a path.

**OpenHands - three gates, and a refusal is persisted state.**
1. `Agent._requires_user_confirmation(state, action_events)`, `agent.py`:1046. Body-read: a single
   `FinishAction`/`ThinkAction` never needs confirmation; if a `security_analyzer` is registered it maps
   `analyze_pending_actions(...)` to risks, else all risks are `UNKNOWN`; then
   `any(state.confirmation_policy.should_confirm(risk) for risk in risks)` sets
   `execution_status = WAITING_FOR_CONFIRMATION` and returns `True`. The policies are
   `AlwaysConfirm` / `NeverConfirm` / `ConfirmRisky(threshold)` (`security/confirmation_policy.py`).
2. Hooks write into the session: `ConversationState.blocked_actions: dict[action_id -> reason]` and
   `blocked_messages: dict[message_id -> reason]` (`conversation/state.py`:153, :159) with
   `block_action` / `pop_blocked_action` / `block_message` / `pop_blocked_message` (:650-676). `_step` reads
   `state.pop_blocked_message(state.last_user_message_id)` before doing anything else. **A hook refusal is
   durable session data, not a return value.**
3. Per-tool: `_extract_security_risk` (:1089) reads a `security_risk` field out of the tool arguments, but
   only when a `security_analyzer` is configured; read-only tools are exempt; an invalid enum raises.
**Routing around: yes, through public API.** `BaseConversation.execute_tool(tool_name, action)`
(`conversation/base.py`:368, implemented at `local_conversation.py`:3111) invokes a tool directly, and
`rerun_actions` (:3006) re-executes recorded actions. Neither passes through `_execute_actions` /
`_requires_user_confirmation`. Additionally, `_step`'s first branch executes **unmatched pending actions**
immediately and returns - that is the "implicit confirmation" model, where calling `run()` a second time is
the approval.

**SWE-agent - the boundary is a string filter over the command, in the tool handler.**
`ToolHandler.should_block_action(action)` (`sweagent/tools/tools.py`:353), called at the top of
`handle_action` (`agents.py`:944) raising `_BlockedActionError`. Configuration is `ToolFilterConfig`
(tools.py:29) with a `blocklist_error_template`. There is also `guard_multiline_input` (:382) and a
deliberate `"exit"` command shortcut.
**Routing around:** within the loop, no - every action is a bash string and every one passes through
`handle_action`. But the boundary is a *regular-expression/prefix filter over a command string*, not a
semantic policy, and it lives in the agent, so a different `AbstractAgent` subclass can omit it. The real
containment in SWE-agent is the environment (`SWEEnv`, a container) - which I did not read.
### 3. What is a session, concretely?

This is where the six diverge most, so I give the type, what persists it, and what is deliberately absent.

**claude-agent-sdk-python - an opaque JSONL transcript file owned by the CLI, optionally mirrored out.**
- The type the host sees: `SessionStoreEntry` (`types.py`:1537), "One JSONL transcript line ... The concrete
  shape is the CLI's on-disk transcript format (a large discriminated union). That union is internal, so
  this is a minimal structural supertype - adapters should treat entries as pass-through blobs;
  round-tripping `json.dumps`/`json.loads` is the only required invariant."
- The key: `SessionKey{project_key, session_id, subpath?}` (:1515). "Main transcripts have no `subpath`;
  subagent transcripts include a `subpath` like `subagents/agent-{id}`." `project_key` defaults to a
  sanitized cwd and is explicitly meant to be a tenant ID in multi-tenant deployments.
- What persists it: **the CLI writes to local disk; the `SessionStore` is a mirror.** Verbatim from
  `SessionStore`'s docstring: "The subprocess still writes to local disk under `CLAUDE_CONFIG_DIR`; the
  adapter receives a secondary copy." `append` is "Called AFTER the subprocess's local write succeeds -
  durability is already guaranteed locally." The SDK "never deletes from your store unless you call
  `delete_session_via_store()`". Only `append` and `load` are required; `list_sessions`,
  `list_session_summaries`, `delete`, `list_subkeys` are optional and probed "at runtime ... the SDK never
  uses `isinstance` for this".
- Resume: `load` is called in the SDK parent *before* subprocess spawn, and "The result is materialized to
  a temporary JSONL file; the subprocess resumes from that file using its existing resume code."
- **Not in it:** the model-visible context. There is a `get_context_usage()` *control request* (:788) and a
  `PreCompactHookInput` *notification* (`types.py`:387) - both are evidence that context accounting and
  compaction live in the CLI, not in the session object the host can see.

**openai-agents-python - a flat item list behind a Protocol, or a server-side conversation.**
`Session` (`src/agents/memory/session.py`), a `runtime_checkable` Protocol with `session_id`,
`session_settings`, `get_items(limit=None)`, `add_items(items)`, `pop_item()`, `clear_session()`.
Implementations in the same package: `sqlite_session.py`, `openai_conversations_session.py`,
`openai_responses_compaction_session.py`. **No events, no state dict, no branches, no checkpoints** - the
session is *the model input list*, nothing more.
In parallel, the SDK supports a server-managed conversation: `conversation_id` / `previous_response_id` /
`auto_previous_response_id` (run.py:600-604), tracked by `OpenAIServerConversationTracker`, with
`server_manages_conversation` branching the input preparation and
`server_conversation_tracker.prepare_input(original_input, generated_items)` inside `run_single_turn`.
`session_persistence.py` in `run_internal` is the write path; `rewind_session_items` exists for
conversation-lock retries. **So "session" here has two incompatible meanings and the code branches on which
one is in play.**

**adk-python - a Pydantic model holding both accumulated state and an ordered event log.**
`Session` (`src/google/adk/sessions/session.py`, all 74 lines read): `id`, `app_name`, `user_id`,
`state: dict[str, Any]` ("Current persisted session state"), `events: list[Event]` ("Ordered event
history ... including user, model, and tool events"), `last_update_time`, and a private
`_storage_update_marker` "used for stale-session detection".
`Event` (`src/google/adk/events/event.py`:86) subclasses `LlmResponse` and carries `invocation_id`,
`author`, `actions: EventActions`, `output`, `node_info`, `long_running_tool_ids`, `branch`,
`isolation_scope`, `id`, `timestamp`.
Persistence is a **service contract**, not the model: `BaseSessionService`
(`sessions/base_session_service.py`) = `create_session`, `get_session`, `list_sessions`, `delete_session`,
`get_user_state`, `append_event`, `flush`, plus private `_commit_event_to_session`, `_apply_temp_state`,
`_trim_temp_delta_state`, `_update_session_state`. There is also a `GetSessionConfig` (with
`num_recent_events`) and a `ListSessionsResponse`. **`temp:` prefixed state is explicitly transient**
(`_trim_temp_delta_state`). **This is the closest of the six to "append-only log + materialized state",
with the projection being the `state` dict rather than the message list.**

**langgraph - a snapshot of every channel, per superstep, under a thread id.**
`Checkpoint` (`libs/checkpoint/langgraph/checkpoint/base/__init__.py`:93) = `{v, id, ts, channel_values,
channel_versions, versions_seen, updated_channels}`; `id` is "both unique and monotonically increasing, so
can be used for sorting"; `versions_seen` is "Map from node ID to map from channel name to version seen.
... Used to determine which nodes to execute next."
`CheckpointMetadata` (:39) = `{source: "input"|"loop"|"update"|"fork", step, parents, run_id,
counters_since_delta_snapshot}`. `CheckpointTuple` (:140) = `(config, checkpoint, metadata, parent_config,
pending_writes)`.
Persistence: `BaseCheckpointSaver` (:177) = `get_tuple` / `list` / `put` / `put_writes` / `delete_thread` /
`delete_for_runs` (+ async variants), with a pluggable `JsonPlusSerializer`. `_loop.py` writes a checkpoint
per superstep (`_put_checkpoint` :1081) and records intermediate `writes` against a `task_id`, which is why
resume can restore even partially completed supersteps.
**Absent: the model's context.** Conversation history is just one channel (`messages` via a reducer).
Compaction, summarization and prompt assembly are not the checkpointer's business. Time travel and forks
fall out of `{id monotonic, parents, pending_writes}` for free - and note that `fork` is a first-class
`metadata.source` value, i.e. branching is in the on-disk schema.

**OpenHands - a branching event tree with a movable HEAD, plus derived state that is never persisted.**
`ConversationState` (`conversation/state.py`:82), public fields: `id`, `agent`, `workspace`,
`persistence_dir`, `max_iterations`, `stuck_detection`, `execution_status`, `confirmation_policy`,
`security_analyzer`, `activated_knowledge_skills`, `activated_path_rules`, `invoked_skills`,
`blocked_actions`, `blocked_messages`, `last_user_message_id`, `leaf_event_id`, `head_is_empty`, `stats`,
`secret_registry`, `tags`, `agent_state`, `hook_config`.
Private attrs, explicitly "NOT Fields": `_fs: FileStore`, `_events: EventLog` ("now the storage for
events"), `_view: View`, `_view_branch_leaf`, `_view_lock`, `_cipher`, `_autosave_enabled`,
`_on_state_change`, `_write_guard`, `_lock: FIFOLock`, `_save_depth`, `_dirty`.
The tree is real: `leaf_event_id` is commented "Movable HEAD of the conversation tree";
`head_is_empty` "Distinguishes a deliberate empty HEAD (`navigate_to(None)`) from an unset
`leaf_event_id` ... Persisted so the empty HEAD survives a save/reload"; `active_branch(limit)` (:295)
walks it; `navigate_to` and `fork` exist on the conversation.
**What is absent, in the author's own words:** the view is "Derived state - never persisted. Cached
projection of `_events` for the *active branch*, lazily updated on read." (`state.py`:235-241). The model
input is computed per step by `prepare_llm_messages`. `condense()` is a separate operation
(`local_conversation.py`:2957). This is exactly the split the Managed Agents material describes as
"the session is not the context window" - and here it is visible in the field list.

**SWE-agent - there is no session type.**
State is instance attributes: `self.history` (list of dicts, filtered by `entry["agent"] == self.name`),
`self.trajectory` (list of `TrajectoryStep`), `self.info`. Persistence is `save_trajectory` writing
`traj_path` and `get_trajectory_data()` re-reading it at the end of `run`. **Resume is replay**
(`sweagent/run/run_replay.py`), not checkpoint restore. A harness can be useful with no session abstraction
at all; this is the existence proof.

### 4. How is context built for the model each turn?

- **openai-agents-python.** `_prepare_turn_input_items(original_input, generated_items,
  reasoning_item_id_policy)` (`run_internal/run_loop.py`:339) is called in `run_single_turn` (:2492) unless a
  server conversation tracker is present. Then `get_new_response` calls
  `maybe_filter_model_input(agent=public_agent, run_config=..., input_items=input,
  system_instructions=system_prompt)`, applies `deduplicate_input_items_preferring_latest`, and proceeds.
  Instructions come from `gather_with_cancel(execution_agent.get_system_prompt(context_wrapper),
  execution_agent.get_prompt(context_wrapper))`. `run_config.call_model_input_filter` is the documented
  insertion point for editing the model-visible list. Session items are merged in earlier by
  `prepare_input_with_session(...)`.
- **adk-python.** `_preprocess_async` (`base_llm_flow.py`:463) iterates `self._iter_request_processors()`
  and lets each yield events; `_call_llm_async` (:618) sends the built `LlmRequest`. The relevant
  processors live in `flows/llm_flows/{contents,instructions,identity}.py` and
  `flows/llm_flows/prompt/*`, with `_BaseLlmProcessor` as the base. So **context assembly is a pipeline of
  named, replaceable processors**, and the pipeline itself is mutable at runtime via
  `insert_request_processor_before/after`.
- **langgraph.** No library function. The prebuilt assembles via `_get_prompt_runnable`
  (`chat_agent_executor.py`:137) and validates via `_validate_chat_history` (:243); the general mechanism is
  the `messages` channel with an `add_messages` reducer. Context shaping is the graph author's prompt
  function - which is why `langchain`'s middleware is where the prebuilt agent's future assembly logic is
  going. `pregel/_messages.py` is about *streaming* messages out, not building them in.
- **OpenHands.** `prepare_llm_messages(...)` called from `Agent._step` (`agent.py`, around :688) against
  `conversation.state.view()` (`state.py`:340), described as a "cached, incrementally-maintained view", with
  `enforced_view_snapshot` / `rebuild_view` as fallbacks. The code references
  `OpenHands/software-agent-sdk#3053` for why the view is incremental. Note the explicit comment that a
  routed model's "real endpoint limit drives condensation on the first step" - context budget is resolved
  before assembly.
- **SWE-agent.** `messages` (`agents.py`:540), the whole of it:

~~~text
filtered_history = [entry for entry in self.history if entry["agent"] == self.name]
messages = filtered_history
for processor in self.history_processors:
    messages = processor(messages)
return messages
~~~

  The processors (`history_processors.py`) are `LastNObservations(n)` (omit all but the last N
  observations), `ClosedWindowHistoryProcessor`, `CacheControlHistoryProcessor`, `RemoveRegex`,
  `TagToolCallObservations`, `ImageParsingHistoryProcessor`, `DefaultHistoryProcessor` - each a pure
  `History -> History`. **This is the cheapest credible implementation of "context shaping as a composable
  pipeline" that I found anywhere in the set.**
- **claude-agent-sdk-python.** Not readable. The client side sees messages arrive pre-assembled; the only
  context-related things exposed are a `get_context_usage()` control request and a `PreCompact` hook.
### 5. How are subagents given context, and what comes back?

- **openai-agents-python - two mechanisms with opposite context rules.**
  - *Handoff*: `agent.as_tool`'s docstring, read in code, is the authoritative contrast: "In handoffs, the
    new agent receives the conversation history ... takes over the conversation."
  - *Agent as tool* (`agent.py`:606): "the new agent receives generated input" and "the conversation is
    continued by the original agent". Input is built by `resolve_agent_tool_input(params, schema_info,
    input_builder)`; parameters default to a structured `AgentAsToolInput` schema; a custom `input_builder`
    can bypass it. The nested run is a real `Runner.run(...)` with a fresh nested `ToolContext` and approval
    propagation via `_nested_approvals_status`. **What comes back:** `custom_output_extractor` if supplied,
    else the nested run's final output, and the docstring states the fallback precisely - "When output
    guardrails ran, empty final outputs are preserved; otherwise, empty final outputs fall back to the
    latest nonempty message or tool output from the nested run."
  - **The compression mechanism, read in body:** `nest_handoff_history`
    (`src/agents/handoffs/history.py`:83) and `_nest_handoff_history_with_provenance` (:107). Before a
    handoff, the previous transcript (built from `input_history`, `pre_handoff_items`, `new_items`) is
    flattened, partitioned into items "forwarded verbatim" versus items folded into a summary
    (`_should_forward_pre_item` :643, `_should_forward_new_item` :654), and passed through
    `default_handoff_history_mapper` (:321) or `_build_summary_message` (:386). Provenance of everything
    folded into the summary is retained as `NestedHistoryOwnedItem` so session history stays intact.
    **The stated pitfall, verbatim:** "Summarize the previous transcript for the next agent without
    redacting sensitive data. ... Tool arguments and outputs from those source fields can therefore remain
    in the generated summary text. Sanitize all three source fields before calling this function."
    `extensions/handoff_filters.remove_all_tools` is the convenience filter that strips
    `ToolCallItem`/`ToolCallOutputItem`/`ReasoningItem`/`MCP*`/`ToolApprovalItem` from history and items.
- **adk-python - a fresh session, filtered parent state, one message in, last content out, state deltas
  merged back.** `AgentTool.run_async` (`src/google/adk/tools/agent_tool.py`:109, body-read):
  - Input: if the wrapped agent has an input schema, a **single** user Content whose text is
    `input_value.model_dump_json(exclude_none=True)` with the comment "The text must stay a bare JSON
    document: the node runtime re-validates it against this same schema, so any prose here fails that
    parse." Otherwise the `request` argument or `json.dumps(args, sort_keys=True)`.
  - Child session: `Runner(app_name=child_app_name, agent=self.agent, artifact_service=ForwardingArtifactService(tool_context), session_service=InMemorySessionService(), memory_service=InMemoryMemoryService(), ...)`
    - **a brand-new in-memory session service**, seeded with
    `state_dict = {k: v for k, v in tool_context.state.to_dict().items() if not k.startswith('_adk')}`.
    So the child gets the parent's *state minus ADK internals*, not the parent's event history.
  - Run mode: the nested `RunConfig` is copied with `support_cfc=False` and
    `streaming_mode=StreamingMode.NONE`, and the comment says why: "The nested run's events are not
    forwarded to the caller; only the last event's content becomes the response. ... a caller streaming
    without aggregation would leave only a partial chunk in the last event, so always run unary."
  - **What comes back:** loop over the child's events keeping only `last_content`/`last_error_message`/
    `last_grounding_metadata`; forward every `event.actions.state_delta` into the parent with
    `tool_context.state.update(...)`; then `merged_text = '\n'.join(text parts that are not thought)`, and
    if the agent has an output schema, `validate_schema(output_schema, merged_text)`.
  - The parent's tool response is therefore the child's **last non-thought text, schema-validated**, plus a
    state merge - and if `skip_summarization` is set the parent skips summarizing it.
  - *Alternative*: ADK also supports `sub_agents` with `transfer_to_agent`, where the transfer happens
    **inside the same event log and the same session** (the event carries `author` and `branch`), and
    `Runner` re-finds the current agent from session history on resume (`_find_agent_to_run`).
- **langgraph.** A subagent is a subgraph on a node. In/out is whatever the node's input schema reads and
  its return value writes; isolation is which channels you route. There is no built-in child-output
  compressor - the node's return value *is* the compression, usually one message. `pregel/_algo.py` and the
  `Send` payload (`tool_node.py`, `ToolCallWithContext` :286) distribute parallel tool calls.
- **OpenHands.** `openhands-sdk/openhands/sdk/subagent/{schema,load,registry}.py`. `registry.py` is a
  **file-based** registry: `register_file_agents(work_dir)`, `register_plugin_agents(...)`,
  `register_agent_if_absent`, `agent_definition_to_factory(...)`, and a factory is
  `Callable[[LLM], Agent]` (`AgentFactory`). So a subagent is a declarative file that is instantiated with
  an LLM on demand. Separately, `AgentBase.ask_agent(question)` (`agent/base.py`:1049) and the `AskAgent`
  tool, and an "agent delegation" example. **What comes back for the file-based subagents I did not read in
  code** - see Could not verify.
- **SWE-agent.** No first-class subagent. Three near-misses, all of which make the *tool boundary* the
  subagent boundary: `ActionSampler`'s `AskColleagues` (`action_sampler.py`:49) samples several completions
  and merges them with a "colleague discussion"; `BinaryTrajectoryComparison` (:153) uses an LLM judge to
  pick among candidate actions; and the `review_on_submit_m` tool (`tools/review_on_submit_m/bin/submit`)
  triggers a separate reviewer model call. `sweagent/agent/reviewer.py` exists as its own module.
- **claude-agent-sdk-python.** `AgentDefinition` (`types.py`:108) is the declaration: `description`,
  `prompt`, `tools`, `disallowedTools`, `model`, `skills`, `memory`, `mcpServers`, `initialPrompt`,
  `maxTurns`, `background`, `effort`, `permissionMode`. **What comes back is not in this repository.**
  What *is* here is post-hoc reading of the child's own transcript:
  `list_subagents(session_id, ...)` and `get_subagent_messages(...)` (`_internal/sessions.py`:1286, :1328)
  scan `~/.claude/projects/<project>/<sessionId>/subagents/agent-<agentId>.jsonl` and rebuild the child's
  chain via `_build_subagent_chain` (:1246), with the comment "Subagent transcripts are simpler than main
  sessions - no compaction". Store-backed variants `list_subagents_from_store` /
  `get_subagent_messages_from_store` (:1896, :1945) scan `subkeys` prefixed `subagents/`. The compression
  of the child's result into the parent's context happens inside the CLI.

### 6. When a tool call fails or is refused, what happens?

- **SWE-agent - the most explicit error taxonomy in the set, and the most transferable artefact.**
  `forward_with_handling` (`agents.py`:1062) is a `while n_format_fails < self.max_requeries:` loop around
  `forward(history)`, with three outcomes per exception class:
  - *Requery the model with a rendered template:* `FormatError` (`tools.config.format_error_template`),
    `_BlockedActionError` (`tools.config.filter.blocklist_error_template`), `ContentPolicyViolationError`
    (plain resample), `BashIncorrectSyntaxError` (`templates.shell_check_error_template`),
    `_RetryWithOutput`, `_RetryWithoutOutput`. `get_model_requery_history(...)` (:789) builds the new
    history from the template plus the failed `step.to_template_format_dict()`.
  - *Exit, after attempting to salvage a patch:* `_ExitForfeit`, `_TotalExecutionTimeExceeded`,
    `CommandTimeoutError`, `ContextWindowExceededError`, `CostLimitExceededError`, `RetryError`,
    `SwerexException`, `RuntimeError`, bare `Exception` - each via
    `handle_error_with_autosubmission(exit_status, message)` then `attempt_autosubmission_after_error`
    (:823), with a distinct `exit_status` string per class (`exit_forfeit`, `exit_context`, `exit_cost`,
    `exit_api`, `exit_environment_error`, `exit_error`).
  - *Propagate:* `KeyboardInterrupt`, `EOFError`, `TotalCostLimitExceededError`.
  A refusal (`_BlockedActionError`) is thus a **first-class control-flow outcome with its own template and
  its own requery budget**, and hopeless failure still tries to extract a patch from the environment.
- **langgraph.** `ToolNode(handle_tool_errors=...)` (`tool_node.py`:743). `_default_handle_tool_errors`
  (:383): "If the tool is a tool invocation error, return its message. Otherwise, raise the error." - so by
  default **only `ToolInvocationError` becomes a `ToolMessage`; anything else kills the run**.
  `_handle_tool_error` (:394) renders `TOOL_CALL_ERROR_TEMPLATE.format(error=repr(e))`, an explicit string,
  or a callable. `_infer_handled_types` (:444) derives the handled exception types from a handler's
  annotation. `pregel/_retry.py` and `RetryPolicy` handle retries at the node level. Validation errors are
  filtered separately (`_filter_validation_errors` :510).
- **openai-agents-python.** Tool failures route through the tool's `failure_error_function` (default
  `default_tool_error_function`, `util/_tool_errors.py`) which converts them into a message for the model;
  `failure_error_function=None` raises instead. Refusals via guardrails become tool *outputs* (see 2).
  Model-call failures have a separate retry path (`run_internal/model_retry.py`) and app-supplied
  `error_handlers` (`run_error_handlers.py`). Redaction has its own tests
  (`tests/test_default_tool_error_redaction.py`).
- **adk-python.** `tools/_error_handler.py`: `run_on_tool_error_callbacks(...)` (:99),
  `detect_error_type_for_telemetry(...)` (:37), `build_tool_not_found_response(...)` (:79). In
  `_execute_single_prepared_call`, a raised tool error and a raised gate error take the same path (:853):
  `error_response = await _tool_error_handler.run_on_tool_error_callbacks(...)`. An unknown tool name is
  answered *after* the before-tool callbacks get a chance, deliberately, and after-tool callbacks are
  skipped because "they describe a tool run that did not happen".
- **OpenHands.** `_execute_action_event` (`agent.py`:1384) catches `ValueError` from the tool and converts
  it: "Tool execution raised a ValueError ... Convert to AgentErrorEvent so the agent can correct itself"
  gives one `AgentErrorEvent(error=..., tool_name=..., tool_call_id=..., classification=AGENT_OUTCOME)`.
  Non-`ValueError` exceptions propagate out of the worker thread. `_emit_tool_error` (:1163) is the
  LLM-visible error path. So a *recoverable* argument error becomes an event the model reads; an
  unrecoverable error kills the step.
- **claude-agent-sdk-python.** The host's callback raising produces a `control_response` with
  `subtype: "error"` and a string, which the CLI then handles; a `can_use_tool` denial carries a `message`
  and optionally `interrupt: true`. Tool-level failures are visible to the client as result messages
  (`ResultMessage`, `_error_result_text` :85, `PostToolUseFailureHookInput`) but are classified inside the
  CLI. Note also `_maybe_end_run` / `_arm_run_end_ceiling` / `run_end_ceiling_ms` (`_internal/query.py`:63,
  :975) - an explicit run-end timeout the client enforces.

---
## The four must-answers

### (1) Core abstraction per harness, and whether the loop is replaceable

| harness | core abstraction | loop replaceable? |
| --- | --- | --- |
| claude-agent-sdk-python | **the control protocol between a host and a closed harness binary** (query/stream-json + control requests) | **No.** Not in the SDK. Only `Transport` replaces the whole binary |
| openai-agents-python | **the turn, executed by a swappable `AgentRunner`** over a flat item list | **Yes, explicitly** - `set_default_agent_runner` |
| adk-python | **the event**, produced by a generator-based flow over an append-only session log | Extensible, not replaceable - mutate the request-processor pipeline |
| langgraph | **the checkpointed superstep** over a typed channel state | No - the loop *is* the product; the graph is what you supply |
| OpenHands (SDK) | **the branching event tree with a movable HEAD**, driven by a pluggable Agent | Step replaceable (`AgentBase`), conversation loop not |
| SWE-agent | **the bash action to observation pair**, recorded as a trajectory | Yes - `AbstractAgent` plus `RetryAgent` as precedent |

### (2) The convergent set - what every one of them has, named by file

1. **A stepper and a driver, separated.** `run_single_turn`/`_run_impl`:987; `_run_one_step_async`/
   `base_llm_flow.py`:356; `PregelLoop.tick`/`main.py`:2964; `Agent._step`/`local_conversation.py`:1904;
   `DefaultAgent.step`/`agents.py`:1279. (Claude: inside the binary.)
2. **A step/result type.** `SingleStepResult`; `Event`; `Checkpoint` + `pending_writes`; `ActionEvent` +
   `ObservationEvent`; `StepOutput`. (Claude: `Message` / `ResultMessage`.)
3. **A pre-execution function that is not the tool.** `_execute_tool_input_guardrails` +
   `function_needs_approval`; `_apply_confirmation_gate` + before-tool callbacks; `wrap_tool_call`;
   `_requires_user_confirmation` + `blocked_actions`; `should_block_action`; the `can_use_tool` control
   request.
4. **A before/after hook surface on the model and the tool.** `RunHooks.on_llm_start/on_tool_start` +
   `Agent.hooks`; the plugin manager + `canonical_before_tool_callbacks`; langgraph callbacks +
   `wrap_tool_call`; `hooks/conversation_hooks.py` + the `HookExecutionEvent`; `AbstractAgentHook` with
   `on_model_query`/`on_action_started`/`on_action_executed`; the `PreToolUse`/`PostToolUse` hook union.
5. **Tools that are not bash strings** (all but SWE-agent). `FunctionTool.on_invoke_tool`;
   `BaseTool.run_async`; `BaseTool` + `ToolNode`; `ToolDefinition`/`tool/registry.py`; MCP tools.
6. **Context derived per turn, never the durable state.** `_prepare_turn_input_items` +
   `call_model_input_filter`; `_preprocess_async` + request processors; the author's prompt function over
   the `messages` channel; `prepare_llm_messages` over `state.view()`; `messages` + history processors;
   the CLI + `get_context_usage()`.
7. **Some durable log.** `Session`/`sqlite_session.py`; `Session.events` + `append_event`; `Checkpoint`
   under a `thread_id`; `EventLog` + `FileStore`; the `.traj` file; the CLI's JSONL + `SessionStore`.
8. **A ceiling.** `max_turns` (run.py:1507); `max_llm_calls` (named in `agent_tool.py`'s comment); `stop`
   (`_loop.py`:606) + `recursion_limit`; `max_iterations` (state.py:108); `total_execution_timeout` /
   `max_requeries` / `CostLimitExceededError`; `AgentDefinition.maxTurns` + `run_end_ceiling_ms`.

That list is the convergent set. It is short and it is boring, which is the finding: **these eight items are
the whole of what six independent teams converged on.** Everything else is a variation.

### (3) Where they genuinely differ - and whether it is architecture or taste

**Architecture (not taste):**

1. **What "session" means.** `get_items`/`add_items`/`pop_item` (flat list) vs `Session{state, events}` +
   `append_event` (log + projection) vs `Checkpoint{channel_values, channel_versions, versions_seen}`
   (state snapshot per superstep) vs `ConversationState{leaf_event_id, head_is_empty}` (branching tree,
   movable HEAD, view "never persisted") vs a `.traj` file vs an opaque `SessionStoreEntry` JSONL union.
   **`pop_item()` cannot express a fork. A channel snapshot cannot express "the user edited message 3". A
   branch tree cannot answer "the last N items" without walking the branch.** These are not six spellings
   of one thing.
2. **Whether a refusal is data or control flow.** OpenAI: a guardrail rejection *becomes the tool's
   output* and the turn continues. ADK: the gate returns an error response **and** sets
   `skip_summarization = True` to stop the loop re-asking. SWE-agent: a refusal **throws**, and the requery
   loop converts it into a prompt with its own budget. OpenHands: a refusal is **persisted session state**
   (`WAITING_FOR_CONFIRMATION`, `blocked_actions`) that halts the loop until `run()` is called again.
   Claude: a control-protocol response from the host, optionally with `interrupt: true`.
   Four placements of one concept in four different control structures.
3. **Where subagent context comes from.** Full history + takeover (handoff) vs generated input + parent
   continues (`as_tool`) vs fresh session + filtered state + last-content-out + state-deltas-back
   (`AgentTool.run_async`) vs same session, same event log, control transfer (`sub_agents` +
   `transfer_to_agent`) vs a subgraph node vs a file that yields a factory (OpenHands) vs a tool that makes
   an LLM call (SWE-agent) vs delegated to a binary with post-hoc transcript reads (Claude). ADK
   *deliberately* isolates the child's session and *deliberately* merges state deltas back; OpenAI's handoff
   *deliberately* hands over the history. Different failure modes by construction: state leakage versus
   context blowup.
4. **Whether the loop is the product.** LangGraph ships the durable loop and is being pushed *down* into a
   runtime - the prebuilt agent and the HITL middleware are both deprecated out to `langchain`
   (`create_react_agent`'s docstring; `prebuilt/interrupt.py`). Everyone else ships an agent with a loop
   inside. Anthropic ships neither: it ships a session/harness/sandbox interface with the harness closed.
5. **Whether refusals are re-enterable.** OpenHands' confirmation is *resumable by calling `run()` again*,
   with the pending action found by `ConversationState.get_unmatched_actions(state.active_branch())`
   (`state.py`:677, called from `_step` :654). OpenAI's is resumable from a `RunState` with `interruptions`.
   LangGraph's is resumable from a checkpoint with `pending_writes`. ADK's is resumable via
   `tool_confirmation` on the tool context plus `invocation_id`. SWE-agent cannot resume a refused action at
   all - it re-asks or exits. That is a capability difference, not a style difference.

**Taste, not architecture:** the names (runner / loop / engine / controller / conversation / agent);
whether tools are JSON functions or bash strings; whether hooks are typed discriminated unions (Claude,
ADK's `EventActions`) or `Callable[..., Awaitable[None]]` (openai, OpenHands); whether the runner is one
2,646-line file (`run.py`) or 27 files under `run_internal/`; async-first (openai, ADK, langgraph,
OpenHands) versus sync-first with async bolted on (SWE-agent, whose whole environment call is
`self._env.communicate(...)`) versus generator-based (ADK's `AsyncGenerator[Event, None]` everywhere, which
is unusual and load-bearing).

### (4) The single file to read first, per harness

| harness | read this first | why |
| --- | --- | --- |
| claude-agent-sdk-python | `src/claude_agent_sdk/_internal/query.py` | the only loop-adjacent readable artefact: the control protocol (`can_use_tool` :577, `hook_callback`, `mcp_message`, run-end ceiling :63/:975). The harness itself is not readable |
| openai-agents-python | `src/agents/run.py` (from `_run_impl` :590; driver `while True` :987) | then `run_internal/tool_execution.py`:1780 for the boundary |
| adk-python | `src/google/adk/flows/llm_flows/base_llm_flow.py` (`run_async` :352, `_run_one_step_async` :389) | `runners.py` is orchestration *around* it; the step semantics ("one step means one LLM call") live here |
| langgraph | `libs/langgraph/langgraph/pregel/_loop.py` (`PregelLoop` :158, `tick` :599) | then `libs/checkpoint/langgraph/checkpoint/base/__init__.py` for the durable unit |
| OpenHands | `openhands-sdk/openhands/sdk/agent/agent.py` (`_step` :645) **plus** `.../conversation/impl/local_conversation.py` (`run` :1904) | boundary and loop are in two files, deliberately |
| SWE-agent | `sweagent/agent/agents.py` | **one file contains the entire harness** - `run` :1265, `step` :1235, `forward` :1006, `forward_with_handling` :1062, `handle_action` :936, `messages` :540 |

---
## What is transferable to a harness

Ordered by how much it changes what you build, not by how easy it is.

1. **The session/context split, as a persisted invariant rather than a convention.** OpenHands' `View`
   being "Derived state - never persisted" (`state.py`:235) and ADK's `temp:`-prefixed state being trimmed
   (`_trim_temp_delta_state`) are two mechanisms for the same rule: *the durable log and the model-visible
   projection are different objects with different lifetimes*. A harness that keeps them in one field will
   eventually persist a projection and call it a session.
2. **A refusal taxonomy with requery budgets, from SWE-agent.** `forward_with_handling` (`agents.py`:1062)
   is the concrete pattern: name each failure mode, decide *requery / exit-with-salvage / propagate*, render
   the requery as a prompt template, cap it, and give each exit a distinct status string. Most harnesses
   have one of these; SWE-agent has the whole matrix in about 170 lines. Copy the shape: **refusal is not
   an error, it is a branch.**
3. **Compression with retained provenance, from OpenAI's handoff history.** `nest_handoff_history`
   (`handoffs/history.py`:83) folds the transcript into a summary while keeping `NestedHistoryOwnedItem`
   provenance so session history stays lossless, and separates "forwarded verbatim" from "folded" by
   predicate (`_should_forward_pre_item` :643). Its docstring also names the trap: the summary is **not**
   redacted. If a harness compresses child output, it should compress with the same two properties:
   verbatim-vs-summarized decided by a predicate, and provenance kept so the durable record is unaffected.
4. **Context shaping as a pipeline of pure functions, from SWE-agent.** `History -> History` processors
   (`history_processors.py`), composed in a list, chained in `messages` (:540). A harness can expose this
   as its context policy and get composability, testability and replay for free - `LastNObservations` alone
   is a complete "don't blow the window" strategy.
5. **A pre-execution boundary that is one function, in the loop, over a request object you can rewrite.**
   LangGraph's `wrap_tool_call(request, execute)` with an immutable `request.override()` and an `execute`
   that may be called repeatedly (`tool_node.py`:236) is the cleanest interface of the six: policy can
   rewrite, short-circuit, cache, or retry, and the tool cannot see it. OpenAI's `_run_single_tool` ordering
   (approval, input guardrail, hook, invoke, output guardrail) is the reference *order*.
6. **A non-bypassable boundary is a different thing from a configurable one, and Claude's SDK proves it.**
   `_get_can_use_tool_shadowed_warning` (`types.py`) is the clearest available evidence that a
   configuration-driven gate *silently degrades*: `bypassPermissions` makes the callback unreachable, and
   whole-tool `allowed_tools` entries pre-approve before it runs. If the harness has one policy surface, the
   harness must be able to say whether it is currently in force. **The sibling file
   `research/live-gate-and-the-seam.md` is about exactly this; this is the frontier evidence for it.**
7. **Explicit seams for replacement, and naming which ones are real.** OpenAI names its loop
   (`set_default_agent_runner`) and its session (`Session` Protocol). LangGraph names its durable unit
   (`Checkpoint` / `BaseCheckpointSaver`) and its serializer. ADK names its context pipeline
   (`insert_request_processor_before`). A harness that declares "this is the loop, this is the state, this
   is the context builder" makes its own architecture auditable - which is what this task is trying to do to
   `src/core/`.
8. **A ceiling on every unbounded quantity, named.** Turns (`max_turns`), LLM calls (`max_llm_calls`),
   supersteps (`stop`), iterations (`max_iterations`), wall time and cost (`total_execution_timeout`,
   `CostLimitExceededError`), requeries (`max_requeries`), run duration (`run_end_ceiling_ms`), and
   consecutive timeouts (`max_consecutive_execution_timeouts`). Every harness has at least four.

## Could not verify

- **The Claude Code loop, its context assembler, its compaction, and its subagent-result compression.**
  All inside the `claude` binary that `scripts/download_cli.py` fetches at build time. Every Claude claim
  above is about the *client* side of the protocol. **I could not read the loop for the most widely deployed
  of these six harnesses**, and I present none of the above as if I had.
- **The TypeScript SDK's source.** The default branch has no `src/` and the licence is proprietary. I read
  its README, its `LICENSE.md`, and its file list. Nothing more.
- **ADK's `Runner.run_async` is read, but `_run_node_async` / `src/google/adk/workflow/_node_runner.py` is
  not** - and `Runner` now prefers that path for `BaseNode` agents. My statement "the step is
  `BaseLlmFlow.run_async`" is true for the classic `LlmAgent` path; for node-runtime agents there is an
  orchestration layer I did not read.
- **OpenHands' `_ActionBatch` (`agent.py`:185-374: `prepare`/`aprepare`/`_truncate_at_finish`/`emit`/
  `finalize`).** I read the def index, not the bodies. My claim that the confirmation gate is evaluated
  *before* the batch executes rests on `_requires_user_confirmation`'s body and `_step`'s branch structure,
  not on reading `_ActionBatch`. Also unread: `AskAgent`'s return shape, `_handle_tool_calls`
  (`response_dispatch.py`), `AgentBase.init_state`, and all of `openhands-agent-server/*`.
- **OpenAI's `handoffs/__init__.py`** (the `Handoff` type and `HandoffInputData` shape) - I read
  `handoffs/history.py` and the `extensions` helpers, which import from it, but not the parent module.
- **langgraph's `Send` API and subgraph state isolation**, `pregel/_algo.py` bodies, and whether `interrupt()`
  interacts with `wrap_tool_call` (I read both mechanisms but not their composition).
- **SWE-agent's `models.py`, `environment/swe_env.py`, `tools/commands.py`, `problem_statement.py`.** So I
  cannot say how the environment is isolated or how the model layer retries - only that
  `RetryError`/`SwerexException` surface at the agent level with their own `exit_status` values.
- **Head commits for `OpenHands/OpenHands`, `OpenHands/software-agent-sdk` and `SWE-agent/SWE-agent`.** The
  GitHub API returned 403 after five calls. Those rows use `ungh.cc`'s `pushedAt`, which includes pushes to
  any branch, not only the default.
- **The Anthropic Managed Agents overview and its interface documentation.** Not fetched this session. See
  "What the sources state" item 6.
- **I ran none of this code.** Every "can an action route around the boundary" answer is from reading the
  call graph, not from executing a bypass. Where the argument depends on a public method being callable with
  the right objects (OpenHands' `execute_tool`, langgraph calling a tool outside `ToolNode`), it is an
  inference from the signature, and I label it as such.

## Caveats / Not Found

- **Method honesty.** Whole files were read only for claude's `query.py`, ADK's `session.py`, langgraph's
  `prebuilt/interrupt.py`, and named regions of SWE-agent's `agents.py`. Everything else is a definition
  index plus named line ranges, and I have said which. Line numbers drift with the commits listed.
- **Fetch honesty.** raw.githubusercontent.com served every file; the jsdelivr mirror was never needed.
  ungh.cc supplied stars, `pushedAt` and full file lists. api.github.com supplied three trees and five head
  commits, then rate-limited. The two 404s I hit were real path changes (`src/agents/handoffs.py` is now a
  package), not blocks.
- **Licence asymmetry worth flagging explicitly.** `claude-agent-sdk-python` is MIT;
  **`claude-agent-sdk-typescript` is not open source at all** ("(c) Anthropic PBC. All rights reserved").
  If any planned work assumed both SDKs were readable or vendorable, that assumption is wrong for the
  TypeScript one.
- **The OpenHands finding is a correction, not a nuance.** `All-Hands-AI/OpenHands` (89k stars) is now a
  frontend/desktop application, and the Python runtime moved to `OpenHands/software-agent-sdk` (1.2k stars).
  Any argument in this task that depends on "what OpenHands' agent controller does" needs to cite the
  software-agent-sdk, and any repository-metadata table written before today that lists
  `All-Hands-AI/OpenHands` as the agent runtime is stale.
- **The two smallest repositories are the most instructive.** SWE-agent (20k stars, a single 1,295-line
  `agents.py` containing the whole harness) and the 74-line ADK `Session` model carry more architectural
  signal than the 4,365-line langgraph `main.py` or the 2,646-line `run.py`. If the parent reads only two
  files from this research, they should be `sweagent/agent/agents.py` and
  `libs/checkpoint/langgraph/checkpoint/base/__init__.py` - the two extremes of the session question, and
  between them they frame it.
- **No vendor marketing was used.** The only vendor prose cited is (a) licence text, (b) docstrings in the
  repositories, and (c) the Managed Agents engineering material, which I did not fetch and which is
  engineering writing rather than marketing.
