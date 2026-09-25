# Research: official framework forms (graph/state-machine), the MCP enforcement boundary, and the two local runtime-layer options

- Query: (1) LangGraph official docs on graph/state-machine execution, checkpointing/durable execution, and human-in-the-loop interrupts; (2) the MCP spec on transport + OAuth authorization, and exactly what MCP standardizes for approval vs what it leaves to the host; (3) the on-disk type definitions of `@earendil-works/pi-agent-core` (runtime-layer option A) plus the existing probe/results and the `@earendil-works/pi-ai` offline provider; (4) the official Cordis / `@deepseek-ai/dsh` docs for the plugin model and API-stability statements (runtime-layer option B).
- Scope: official/first-party only
- Date: 2026-09-25

## Method note

Two source classes are used and are labelled separately throughout:

- **[WEB]** — fetched over the network in this session. URL + page title given.
- **[DISK]** — read from this repository's working tree in this session. Path + line numbers given (the `file:line` form). These are first-party artifacts (published package `.d.ts`/`.js`, shipped docs, probe script, prior research note), not prose summaries.

No claim below is written from memory. Anything I could not fetch or read is in **Caveats / Not Found**.

---

## Findings

## 1. LangGraph (official docs)

### 1.1 The graph/state-machine execution model

**[WEB]** *Graph API overview* — https://docs.langchain.com/oss/python/langgraph/graph-api.md

The doc states the model in three components: "1. `State`: A shared data structure that represents the current snapshot of your application. … 2. `Nodes`: Functions that encode the logic of your agents. They receive the current state as input, perform some computation or side-effect, and return an updated state. 3. `Edges`: Functions that determine which `Node` to execute next based on the current state."

Concrete API surface named by the doc:

- Main class: `StateGraph`, "parameterized by a user defined `State` object" (https://reference.langchain.com/python/langgraph/graph/state/StateGraph).
- State schema: "can be either a `TypedDict` or a `Pydantic` model"; `dataclass` for default values.
- Build/compile: `builder.add_node(name, fn)`, `graph.add_edge("node_a", "node_b")`, `graph.add_conditional_edges("node_a", routing_function)` (optional third arg = dict mapping routing-function output to next node name), `builder.add_edge(START, ...)`, `END`, then `graph_builder.compile(...)`. The doc warns: "You **MUST** compile your graph before you can use it."
- Node signature: `(state, config, runtime)` where `config` is a `RunnableConfig` ("contains configuration information like `thread_id` and tracing information like `tags`") and `runtime` is a `Runtime` ("runtime `context` and other information like `store`, `stream_writer`, `execution_info`, `server_info`, `heartbeat` …, and `control` (for graceful shutdown)").
- Runtime context is separate from graph state: `StateGraph(State, context_schema=ContextSchema)`, passed at invocation via `graph.invoke(inputs, context={...})`, read inside a node as `runtime.context.<field>`.
- Super-steps: "A super-step is a single 'tick' of the graph where all nodes scheduled for that step execute (potentially in parallel)." A node with multiple outgoing edges fans out: "**all** of those destination nodes will be executed in parallel as a part of the next superstep."
- Recursion limit: "the maximum number of super-steps the graph can execute during a single execution. Once the limit is reached, LangGraph will raise `GraphRecursionError`. Starting in version 1.0.6, the default recursion limit is set to 1000 steps." Current step is readable at `config["metadata"]["langgraph_step"]`.

**Reducers** (the "state schema" part most relevant to a shared, append-only evidence trail):

> "Each key in the `State` has its own independent reducer function. If no reducer function is explicitly specified then it is assumed that all updates to that key should override it."

> "Every reducer is a binary function with two positional arguments: **Left argument**: The current value already stored in state for that key. **Right argument**: The update for that key returned by a node." -> `new_value = reducer(left=current_state[key], right=node_update[key])`.

Default reducer: "ignores the left argument and replaces the state value with the right argument." Custom reducers attach per key with `Annotated[list[str], append_strings]`. The checkpointers doc notes that with a reducer, "the `bar` channel values contain outputs from both nodes".

**Graph migrations** — an explicit compatibility contract: for threads at the end of the graph you can change topology freely; "For threads currently interrupted, we support all topology changes other than renaming / removing nodes"; adding/removing state keys is fully backward/forward compatible; renamed keys lose saved state.

### 1.2 Checkpointers and durable execution — can a run resume after interruption?

**[WEB]** *Checkpointers* — https://docs.langchain.com/oss/python/langgraph/checkpointers.md
**[WEB]** *Persistence* — https://docs.langchain.com/oss/python/langgraph/persistence.md

Answer per the docs: **yes, and it is the core value proposition.** "A checkpointer saves a snapshot of graph state at each super-step, organized into **threads**."

Named APIs and fields:

- Compile with it: `builder.compile(checkpointer=checkpointer, store=store)`.
- Thread pointer: `config = {"configurable": {"thread_id": "thread-1"}}`. "The checkpointer uses `thread_id` as the primary key for storing and retrieving checkpoints. Without it, the checkpointer cannot save state or resume execution after an interrupt."
- Read state: `graph.get_state(config)` -> `StateSnapshot`, or a specific checkpoint via `config = {"configurable": {"thread_id": "1", "checkpoint_id": "..."}}`.
- `StateSnapshot` fields (from the doc's table): `values`; `next` ("Node names to execute next. Empty `()` means the graph is complete"); `config` (`thread_id`, `checkpoint_ns`, `checkpoint_id`); `metadata` (`source` = `"input"|"loop"|"update"`, `writes`, `step`); `created_at`; `parent_config`; `tasks`.
- Checkpoint namespace: `checkpoint_ns` is `""` for the root graph, `"node_name:uuid"` for a subgraph, joined with `|` when nested.
- **Pending writes**: "When a graph node fails mid-execution at a given super-step, LangGraph stores pending checkpoint writes from any other nodes that completed successfully at that super-step. When you resume graph execution from that super-step you don't re-run the successful nodes." Writes land in the checkpointer's `checkpoint_writes` table as task entries linked to the in-progress checkpoint. Caveat in the same doc: "These task writes are not full `StateSnapshot` checkpoints, so time travel resumes from full checkpoints at super-step boundaries."
- Checkpointer interface (what you implement for a custom backend): `BaseCheckpointSaver` with "`.put` - Store a checkpoint with its configuration and metadata"; "`.put_writes` - Store intermediate writes linked to a checkpoint"; "`.get_tuple` - Fetch a checkpoint tuple … This is used to populate `StateSnapshot` in `graph.get_state()`"; "`.list`"; plus a fifth base method covered by the conformance suite ("It covers all five base methods").
- Shipped implementations named: `langgraph-checkpoint` (`InMemorySaver`, `SerializerProtocol`), `langgraph-checkpoint-sqlite` (`SqliteSaver` / `AsyncSqliteSaver`), `langgraph-checkpoint-postgres` (`PostgresSaver` / `AsyncPostgresSaver`), `langgraph-checkpoint-mongodb`, `langchain-azure-cosmosdb`.
- Serialization: default `JsonPlusSerializer` (ormsgpack + JSON); `pickle_fallback=True` escape hatch; optional `EncryptedSerializer.from_pycryptodome_aes()` reading `LANGGRAPH_AES_KEY`, passed as the `serde=` argument to any saver. Alternative ciphers via `CipherProtocol`.
- Traps the doc itself lists: `MemorySaver` / `InMemorySaver` "store checkpoints in RAM. When the process restarts, all checkpoints are lost"; `PostgresSaver` `thread_id` must stay "under 255 characters"; checkpoints "accumulate" and should be pruned by retention policy.

**Durability modes** — named config values on any graph execution method, e.g. `graph.stream({"input": "test"}, durability="sync")`:

| Value | What the doc says |
|---|---|
| `"exit"` | "persists changes only when graph execution exits — successfully, with an error, or due to a human-in-the-loop interrupt … you cannot recover from system failures (like process crashes) mid-execution." |
| `"async"` | "persists changes asynchronously while the next step executes … a small risk that LangGraph does not write checkpoints if the process crashes during execution." |
| `"sync"` | "persists changes synchronously before the next step starts … providing high durability at the cost of some performance overhead." |

Storage-growth escape hatch: `DeltaChannel` ("stores only incremental deltas instead of the full accumulated value"), with a warning that it "requires `langgraph>=1.2` and is currently in beta. The API may change in future releases."

### 1.3 Human-in-the-loop: the interrupt mechanism, and whether it can block before a tool executes

**[WEB]** *Interrupts* — https://docs.langchain.com/oss/python/langgraph/interrupts.md
**[WEB]** *Interrupts* (JS/TS mirror) — https://docs.langchain.com/oss/javascript/langgraph/interrupts.md

The mechanism:

- Python: `from langgraph.types import interrupt`; call `interrupt(payload)` at any point inside a node. "The function accepts any JSON-serializable value which is surfaced to the caller."
- TS/JS: `import { interrupt } from "@langchain/langgraph";` and the resume value arrives as the return of `interrupt(...)`.
- Pause semantics (Python doc): "LangGraph suspends execution by raising an exception that signals the runtime to pause. This exception propagates up through the call stack and is caught by the runtime, which notifies the graph to save the current state and wait for external input."
- Resume: re-invoke with `Command(resume=...)` (TS: `Command({ resume: ... })`). "The value passed to `Command(resume=...)` becomes the return value of the `interrupt` call". Must reuse the same `thread_id`. With `invoke()` the payload surfaces under `result["__interrupt__"]`; with `graph.stream_events(..., version="v3")` it surfaces on `stream.interrupts` with `stream.interrupted` as the boolean.
- Multiple simultaneous interrupts: resume with a map keyed by interrupt id — `Command(resume={i.id: f"answer for {i.value}" for i in stream.interrupts})`.

**Can it block before a tool executes?** Yes — the doc's "Interrupts in tools" section (anchor `#interrupts-in-tools`) puts `interrupt()` *inside the tool function*:

> "You can also place interrupts directly inside tool functions. This makes the tool itself pause for approval whenever it's called, and allows for human review and editing of the tool call before it is executed."

The doc's example tool `send_email(to, subject, body)` calls `interrupt({... "message": "Approve sending this email?"})` and only then performs the side effect; on resume the payload can override the arguments ("Resume value can override inputs before executing") or the tool returns "Email cancelled by user". A full worked example shows the classic graph shape — `agent` node -> `add_conditional_edges("agent", should_continue, ["tool_node", END])` -> `tool_node` -> back to `agent` — compiled with `SqliteSaver(sqlite3.connect("tool-approval.db", check_same_thread=False))`.

There is also a dedicated approval pattern: a separate `approval_node` that returns `Command(goto="proceed")` / `Command(goto="cancel")` based on the resume value, documented under "### Approve or reject".

**Cost of the gate — read this before designing around it.** The doc's "Rules of interrupts" is explicit:

> "When execution resumes (after you provide the requested input), the runtime restarts the entire node from the beginning—it does not resume from the exact line where `interrupt` was called. This means any code that ran before the `interrupt` will execute again."

Consequences stated by the doc: do not wrap `interrupt` in bare `try/except` (it pauses by throwing); "Side effects called before `interrupt` must be idempotent"; multiple `interrupt` calls in one node are matched **strictly index-based**, so they must not be conditionally skipped or looped non-deterministically.

*My inference (not a doc claim):* the blocking guarantee is a **node/tool-boundary** guarantee, not a per-instruction guarantee. Anything the gate must prevent has to sit after the `interrupt()` inside the same node/tool body, and everything before it must be safe to re-run.

### 1.4 How it compares to a plain message-loop agent, per its own docs

**[WEB]** *Workflows and agents* — https://docs.langchain.com/oss/python/langgraph/workflows-agents.md
**[WEB]** *LangGraph overview* — https://docs.langchain.com/oss/python/langgraph/overview.md
**[WEB]** *Runtimes, frameworks, and harnesses* — https://docs.langchain.com/oss/python/concepts/products.md

The doc's own framing of the difference:

- "Workflows have predetermined code paths and are designed to operate in a certain order. Agents are dynamic and define their own processes and tool usage."
- "Agents are typically implemented as an LLM performing actions using tools. They operate in continuous feedback loops, and are used in situations where problems and solutions are unpredictable."
- Overview page: "LangGraph is a low-level orchestration framework and runtime for building, managing, and deploying long-running, stateful agents. … LangGraph gives you fine-grained control to mix deterministic, hand-coded steps with LLM-driven agentic steps in the same graph, so you can build bespoke agents that behave exactly the way your application requires."

Most decision-relevant: the doc renders the **plain message loop as an explicit graph**. The "Graph API" variant of the tool-calling agent is exactly two nodes plus a conditional edge:

    llm_call(state) -> {"messages": [llm_with_tools.invoke(... + state["messages"])]}
    tool_node(state)  -> for tool_call in state["messages"][-1].tool_calls: tool.invoke(tool_call["args"])
    should_continue(state) -> "tool_node" if last_message.tool_calls else END
    builder.add_node("llm_call", llm_call); builder.add_node("tool_node", tool_node)
    builder.add_edge(START, "llm_call")
    builder.add_conditional_edges("llm_call", should_continue, ["tool_node", END])
    builder.add_edge("tool_node", "llm_call")

*My inference:* the doc presents the same behaviour as a bare `while` loop, but materialised as graph state — which is precisely what makes checkpointing and `interrupt` possible at all, because the loop position and the pending tool calls become part of persisted state rather than stack frames.

The **layering taxonomy** on the products page is the cleanest first-party statement of who owns the loop, and it matches this repo's problem statement:

| Layer | First-party examples named | "Value add" listed | What it is |
|---|---|---|---|
| **Runtime** | LangGraph, Temporal, Inngest | Durable execution, Streaming, HITL, Persistence | "provide the tooling for running agents in production … **Low-level control**: Direct control over agent orchestration without high-level abstractions." |
| **Framework** | LangChain, Vercel AI SDK, CrewAI, OpenAI Agents SDK, Google ADK, LlamaIndex | Abstractions, Integrations | "provide abstractions like structured content blocks, **the agent loop**, and middleware" |
| **Harness** | Deep Agents SDK, Claude Agent SDK, Manus | Predefined tools, Prompts, Subagents | "opinionated, batteries-included frameworks with built-in tools and capabilities" |

The page's feature table maps human-in-the-loop to LangGraph `Interrupts`, LangChain `Human-in-the-loop middleware`, and Deep Agents `interrupt_on` parameter.

---

## 2. MCP authorization / enforcement boundary

Latest published revision on the docs index is **2026-07-28**; the index lists revisions 2026-07-28, 2025-11-25, 2025-06-18, 2025-03-26, 2024-11-05, and `draft`.

**[WEB]** index — https://modelcontextprotocol.io/llms.txt

### 2.1 Transport

**[WEB]** *Transports* (2026-07-28) — https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/index.md
**[WEB]** *Transports* (2025-06-18) — https://modelcontextprotocol.io/specification/2025-06-18/basic/transports.md

2026-07-28 restructures transports into a binding model. What it states:

- "MCP uses JSON-RPC to encode messages. JSON-RPC messages **MUST** be UTF-8 encoded."
- Two standard bindings: **stdio** ("newline-delimited messages over the standard streams of a client-launched subprocess") and **Streamable HTTP** ("each message is an HTTP POST to a single MCP endpoint; replies arrive as a JSON object or a request-scoped SSE stream").
- "Protocol semantics are identical on every transport. A transport is a **binding**: it defines how messages are framed and delivered, how request metadata is carried, and how cancellation and termination are signaled. It does not define what the messages mean".
- Direction constraint: "A binding **MUST** deliver client-sent *requests* and *notifications* to the server, and server-sent *responses* and *notifications* to the client. No other message direction exists: per the message patterns, **servers do not initiate JSON-RPC requests and clients do not send JSON-RPC responses**."
- Metadata moved into the body: "All protocol metadata travels in the message body: every request carries its protocol version and client capabilities in `_meta.io.modelcontextprotocol/*` fields." Streamable HTTP *may* mirror selected fields into HTTP headers; "The body remains the source of truth."
- Cancellation: "on stdio the client sends a `notifications/cancelled` notification; on Streamable HTTP it closes the request's response stream."
- Custom transports: clients and servers **MAY** add them, but **MUST** "preserve the JSON-RPC message format, the message patterns, and the per-request metadata model". Reliable bidirectional byte streams "**SHOULD** reuse the stdio framing".
- Backward compatibility: earlier revisions used "a connection-scoped session with an `initialize` handshake and allowed servers to initiate JSON-RPC requests"; implementors detect the counterpart's era and fall back per the versioning page.

The 2025-06-18 page is the classic form of the same two transports (stdio and Streamable HTTP, with `initialize` and `Mcp-Session-Id` semantics).

### 2.2 Authorization (OAuth)

**[WEB]** *Authorization* (2026-07-28) — https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/index.md
**[WEB]** *Authorization Security Considerations* (2026-07-28) — https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations.md

Scope statement, verbatim from the spec:

> "The Model Context Protocol provides authorization capabilities **at the transport level**, enabling MCP clients to make requests to restricted MCP servers on behalf of resource owners. This specification defines the authorization flow for HTTP-based transports."

> "Authorization is **OPTIONAL** for MCP implementations. When supported: Implementations using an HTTP-based transport **SHOULD** conform to this specification. Implementations using an STDIO transport **SHOULD NOT** follow this specification, and instead retrieve credentials from the environment."

Roles: "A protected *MCP server* acts as an OAuth 2.1 resource server … An *MCP client* acts as an OAuth 2.1 client, making protected resource requests on behalf of a resource owner. The *authorization server* is responsible for interacting with the user (if necessary) and issuing access tokens".

Normative requirements named:

- "Authorization servers **MUST** implement OAuth 2.1".
- "MCP servers **MUST** implement OAuth 2.0 Protected Resource Metadata (RFC9728)" and "MCP clients **MUST** use OAuth 2.0 Protected Resource Metadata for authorization server discovery."
- Discovery: authorization servers **MUST** provide at least one of RFC8414 metadata or OIDC Discovery; clients **MUST** support both.
- Client registration: clients **MUST** obtain a client ID via Client ID Metadata Documents (SHOULD-level), pre-registration, or Dynamic Client Registration (RFC7591, now **deprecated** and "retained for backwards compatibility").
- Scope guidance: servers **SHOULD** include a `scope` parameter in the `WWW-Authenticate` header on a 401; "Clients **MUST** treat the scopes provided in the challenge as authoritative for the current operation." Least-privilege ordering: use the challenge `scope` if present, else `scopes_supported`.
- Concrete wire example in the spec: `HTTP/1.1 401 Unauthorized` / `WWW-Authenticate: Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource", scope="files:read"`.
- PKCE: "MCP clients **MUST** implement PKCE … and **MUST** verify PKCE support before proceeding"; "**MUST** use the `S256` code challenge method when technically capable"; if `code_challenge_methods_supported` is absent from AS metadata, "MCP clients **MUST** refuse to proceed."
- Token audience binding: clients **MUST** include the `resource` parameter (RFC8707); servers **MUST** validate tokens were issued for their use.
- Transport security: "All authorization server endpoints **MUST** be served over HTTPS. All redirect URIs **MUST** be either `localhost` or use HTTPS."
- Mix-up defense: client records the `issuer` from validated AS metadata and validates the `iss` on the callback (RFC9207).

### 2.3 What MCP standardizes for approval — and what it leaves to the host

This is the boundary the framework decision hinges on. The tools spec is unambiguous.

**[WEB]** *Tools* (2026-07-28) — https://modelcontextprotocol.io/specification/2026-07-28/server/tools.md
**[WEB]** *Tools* (2025-06-18) — https://modelcontextprotocol.io/specification/2025-06-18/server/tools.md

Both revisions carry an identical `## User Interaction Model` section, verbatim:

> "Tools in MCP are designed to be **model-controlled**, meaning that the language model can discover and invoke tools automatically based on its contextual understanding and the user's prompts.
>
> However, implementations are free to expose tools through any interface pattern that suits their needs—**the protocol itself does not mandate any specific user interaction model**.
>
> For trust & safety and security, there **SHOULD** always be a human in the loop with the ability to deny tool invocations.
>
> Applications **SHOULD**: * Provide UI that makes clear which tools are being exposed to the AI model * Insert clear visual indicators when tools are invoked * Present confirmation prompts to the user for operations, to ensure a human is in the loop"

And the 2026-07-28 `## Security Considerations` split, verbatim:

> "1. Servers **MUST**: Validate all tool inputs / Implement proper access controls / Rate limit tool invocations / Sanitize tool outputs
> 2. Clients **SHOULD**: Prompt for user confirmation on sensitive operations / Show tool inputs to the user before calling the server, to avoid malicious or accidental data exfiltration / Validate tool results before passing to LLM / Follow the `$ref` resolution requirements … / Implement timeouts for tool calls / Log tool usage for audit purposes"

**Precise boundary (the answer to "what does MCP standardize for approval"):**

1. **Standardized by MCP:** transport framing (stdio / Streamable HTTP) [WEB transports]; OAuth 2.1 *client -> server* authorization, discovery, client registration, PKCE, resource indicators, scope challenge handling [WEB authorization]; server -> client **elicitation** for asking a user for input [WEB elicitation]; and JSON-RPC tool-call *mechanics* (`tools/list`, `tools/call`, `tools/list_changed` notification, `inputSchema` / `outputSchema` validation, `resultType: "input_required"` multi-round-trip requests).
2. **NOT standardized by MCP — explicitly left to the host/application:** whether a human is asked before a `tools/call`. The spec has **no** approval request/response message, no `approval` capability, no "pending approval" tool state, and no field by which a client tells a server "this call is awaiting human approval". The human-in-the-loop requirement is **SHOULD**, addressed to "Applications", and is described as UI work ("Provide UI…", "Present confirmation prompts…").
3. **The only enforcement lever the protocol itself gives a host** is negative: the client simply **does not send the `tools/call` request**. There is no protocol-level way for a client to make a *server* hold, gate, or re-ask; server-side enforcement is its own "proper access controls" plus whatever the OAuth scope on the presented token permits.

One further 2026-07-28 detail worth noting for a policy layer: the visible tool set is allowed to be authorization-dependent — "The set **MAY** vary by the authorization presented on the request — for example, returning only the tools the caller's granted scopes permit — since credentials are per-request input, not connection state." But the same paragraph forbids other variation: the set "**MUST NOT** vary per-connection or as a side effect of other requests on the connection."

### 2.4 Elicitation — the standardized "ask the user" primitive

**[WEB]** *Elicitation* (2026-07-28) — https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation.md

- Purpose: "a standardized way for servers to request additional information from users through the client during interactions."
- Two modes: `form` (in-band structured data with optional JSON Schema validation; "Data is exposed to the client") and `url` ("Out-of-band interaction via URL navigation. Data … must *not* pass through the MCP client").
- Wire shape: servers send an `InputRequiredResult` containing an `elicitation/create` request; required params `mode` and `message`.
- Capability declaration: clients **MUST** declare `elicitation` in `_meta.io.modelcontextprotocol/clientCapabilities`; "Servers **MUST NOT** send elicitation requests with modes that are not supported by the client."
- Client duties: "**MUST** Provide UI that makes it clear which server is requesting information / Respect user privacy and provide clear decline and cancel options / For form mode, allow users to review and modify their responses before sending / For URL mode, clearly display the target domain/host and gather user consent before navigation".
- Servers **MUST NOT** use form mode to request "passwords, API keys, access tokens, or payment credentials"; those **MUST** use URL mode.

*My inference:* elicitation is the nearest thing MCP has to an approval prompt, but it is a **server-initiated question**, not a client-side gate. A framework that needs "an approval gate can BLOCK a tool call" cannot get that from MCP; it must own the loop above the MCP client and decline to issue `tools/call`.

---

## 3. Local runtime-layer option A: `@earendil-works/pi-agent-core`

All of section 3 is **[DISK]**, read in this session. Version facts come from `package.json` on disk.

### 3.0 Package facts

**[DISK]** `node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-agent-core/package.json`

- `"name": "@earendil-works/pi-agent-core"`, `"version": "0.84.3"`, `"license": "MIT"`, `"author": "Mario Zechner"`, `"engines": { "node": ">=22.19.0" }`.
- `"repository": { "url": "git+https://github.com/earendil-works/pi.git", "directory": "packages/agent" }`.
- Exports (only three, plus `package.json`):
  - `"."` -> `./dist/index.d.ts` / `./dist/index.js`
  - `"./node"` -> `./dist/node.d.ts` / `./dist/node.js`
  - `"./session/testing"` -> `./dist/harness/session/testing/index.d.ts`
- Runtime deps: `@earendil-works/pi-ai ^0.84.3`, `@earendil-works/pi-telemetry ^0.84.3`, `diff`, `ignore`, `typebox 1.3.7`, `yaml`.
- **There is exactly one copy of this package on disk** (a glob for `**/node_modules/@earendil-works/pi-agent-core/package.json` matched only the nested path). `pi-coding-agent` is also `0.84.3` and declares `"@earendil-works/pi-agent-core": "^0.84.3"`, so the nested copy is what the whole tree resolves.

**[DISK]** `dist/node.d.ts` (3 lines) re-exports `NodeExecutionEnv` from `./harness/env/nodejs.ts` then `export * from "./index.ts"`.

### 3.1 Who owns the loop

**[DISK]** `dist/agent.d.ts:26-31` — the `Agent` class doc comment:

> "Stateful wrapper around the low-level agent loop. `Agent` owns the current transcript, emits lifecycle events, executes tools, and exposes queueing APIs for steering and follow-up messages."

**[DISK]** `dist/agent-loop.d.ts` — the loop itself is a set of exported free functions, i.e. the caller composes it:

    export declare function agentLoop(prompts: AgentMessage[], context: AgentContext, config: AgentLoopConfig, signal: AbortSignal | undefined, streamFn: StreamFn): EventStream<AgentEvent, AgentMessage[]>;
    export declare function agentLoopContinue(context: AgentContext, config: AgentLoopConfig, signal: AbortSignal | undefined, streamFn: StreamFn): EventStream<AgentEvent, AgentMessage[]>;
    export declare function runAgentLoop(prompts: AgentMessage[], context: AgentContext, config: AgentLoopConfig, emit: AgentEventSink, signal: AbortSignal | undefined, streamFn: StreamFn): Promise<AgentMessage[]>;
    export declare function runAgentLoopContinue(context: AgentContext, config: AgentLoopConfig, emit: AgentEventSink, signal: AbortSignal | undefined, streamFn: StreamFn): Promise<AgentMessage[]>;

**Verdict: the caller owns the loop.** The package is a library, not a host. There is no CLI, no permission system, and no policy layer in this package.

### 3.2 The agent/loop constructor

**[DISK]** `dist/agent.d.ts:5-25` — `AgentOptions`, verbatim:

    export interface AgentOptions {
        initialState?: Partial<Omit<AgentState, "pendingToolCalls" | "isStreaming" | "streamingMessage" | "errorMessage">>;
        convertToLlm?: (messages: AgentMessage[]) => Message[] | Promise<Message[]>;
        transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;
        streamFn: StreamFn;
        getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;
        onPayload?: SimpleStreamOptions["onPayload"];
        onResponse?: SimpleStreamOptions["onResponse"];
        beforeToolCall?: (context: BeforeToolCallContext, signal?: AbortSignal) => Promise<BeforeToolCallResult | undefined>;
        afterToolCall?: (context: AfterToolCallContext, signal?: AbortSignal) => Promise<AfterToolCallResult | undefined>;
        shouldStopAfterTurn?: (context: ShouldStopAfterTurnContext, signal?: AbortSignal) => boolean | Promise<boolean>;
        prepareNextTurn?: (signal?: AbortSignal) => Promise<AgentLoopTurnUpdate | undefined> | AgentLoopTurnUpdate | undefined;
        prepareNextTurnWithContext?: (context: PrepareNextTurnContext, signal?: AbortSignal) => Promise<AgentLoopTurnUpdate | undefined> | AgentLoopTurnUpdate | undefined;
        steeringMode?: QueueMode;
        followUpMode?: QueueMode;
        sessionId?: string;
        thinkingBudgets?: ThinkingBudgets;
        transport?: Transport;
        maxRetryDelayMs?: number;
        toolExecution?: ToolExecutionMode;
    }

`constructor(options: AgentOptions);` — `dist/agent.d.ts:59`. The constructor is implemented for real: `dist/agent.js` is ~16 KB of working code (`export class Agent`), and it defensively falls back — `const runtimeOptions = options ?? {}`, `this.convertToLlm = runtimeOptions.convertToLlm ?? defaultConvertToLlm`, `this.streamFunction = runtimeOptions.streamFn ?? getDefaultStreamFn()`.

Other loop-visible options: `toolExecution?: "sequential" | "parallel"` — default `"parallel"` per the `AgentLoopConfig` doc and `dist/types.d.ts:22` (`export type ToolExecutionMode = "sequential" | "parallel";`). Semantics per the doc: "`sequential`: each tool call is prepared, executed, and finalized before the next one starts. `parallel`: tool calls are prepared sequentially, then allowed tools execute concurrently."

Queueing API on `Agent` (`dist/agent.d.ts:83-94`): `steer(message)`, `followUp(message)`, `clearSteeringQueue()`, `clearFollowUpQueue()`, `clearAllQueues()`, `hasQueuedMessages()`; `QueueMode = "all" | "one-at-a-time"`. Run control: `abort()`, `get signal(): AbortSignal | undefined`, `waitForIdle(): Promise<void>`, `reset()`, `prompt(...)`, `continue()`.

### 3.3 `beforeToolCall` — can it BLOCK? What does it return?

**Yes. It is a hard block, verified in the compiled loop, not just the type.**

**[DISK]** `dist/types.d.ts:36-51`, verbatim:

    /**
     * Result returned from `beforeToolCall`.
     *
     * Returning `{ block: true }` prevents the tool from executing. The loop emits an error tool result instead.
     * `reason` becomes the text shown in that error result. If omitted, a default blocked message is used.
     */
    export interface BeforeToolCallResult {
        block?: boolean;
        reason?: string;
        /**
         * Hint that the agent should stop after the current tool batch when this call is blocked.
         * Early termination only happens when every finalized tool result in the batch sets this to true.
         */
        terminate?: boolean;
    }

**[DISK]** `dist/types.d.ts:74-86` — the argument shape:

    export interface BeforeToolCallContext {
        /** The assistant message that requested the tool call. */
        assistantMessage: AssistantMessage;
        /** The raw tool call block from `assistantMessage.content`. */
        toolCall: AgentToolCall;
        /** Validated tool arguments for the target tool schema. */
        args: unknown;
        /** Current agent context at the time the tool call is prepared. */
        context: AgentContext;
    }

**[DISK]** `dist/types.d.ts:236-243` — the hook contract on `AgentLoopConfig`:

> "Called before a tool is executed, **after arguments have been validated**. Return `{ block: true }` to prevent execution. The loop emits an error tool result instead. A blocked result can also set `terminate: true` to participate in the batch early-termination rule. The hook receives the agent abort signal and is responsible for honoring it."

**Where the block actually happens (compiled implementation):**

**[DISK]** `dist/agent-loop.js:393` `async function prepareToolCall(...)`; the branch is at `dist/agent-loop.js:417-431`:

    if (config.beforeToolCall) {
        const beforeResult = await config.beforeToolCall({
            assistantMessage,
            toolCall,
            args: validatedArgs,
            context: currentContext,
        }, signal);
        if (signal?.aborted) { return { kind: "immediate", result: createErrorToolResult("Operation aborted"), isError: true }; }
        if (beforeResult?.block) {
            const result = createErrorToolResult(beforeResult.reason || "Tool execution was blocked");
            if (beforeResult.terminate === true) { result.terminate = true; }
            return { kind: "immediate", result, isError: true };
        }
    }

Returning `kind: "immediate"` short-circuits `prepareToolCall` so `tool.execute(...)` is never reached. This holds in **both** execution modes: `executeToolCallsParallel` runs `prepareToolCall` for every call *before* any executor is scheduled, and the sequential path prepares-then-executes one call at a time.

Notes that matter for a policy layer:

- The hook is called **after schema validation** (`validateToolArguments(tool, preparedToolCall)`) and after the optional `prepareArguments` shim, so `args` is already shaped like `Static<TParameters>`.
- A **missing tool** never reaches the hook: `prepareToolCall` returns an error tool result immediately (`dist/agent-loop.js:394-401`).
- The hook runs inside a `try`: **throwing** from `beforeToolCall` is caught and converted into an error tool result — it does not crash the loop. *My inference:* a throwing gate is therefore fail-closed by construction, but a gate bug is also silent unless you log it.
- Blocking does **not** kill the session: the blocked call is finalized as an error tool result, and the loop proceeds. The existing probe confirms this by reaching the second scripted response (section 3.10).
- `terminate: true` on **every** finalized result in a batch is the batch-level early-stop rule: `shouldTerminateToolBatch(finalizedCalls) { return finalizedCalls.length > 0 && finalizedCalls.every((finalized) => finalized.result.terminate === true); }`.

`afterToolCall` is the complementary post-hook. **[DISK]** `dist/types.d.ts:60-72` — `AfterToolCallResult` with field-by-field replace semantics: `content` ("replaces the tool result content array in full"), `details`, `isError`, `usage`, `terminate`; "Omitted fields keep the original executed tool result values. There is no deep merge."

### 3.4 `transformContext`

**[DISK]** `dist/types.d.ts:164-172` — on `AgentLoopConfig`:

> "Optional transform applied to the context before `convertToLlm`. Use this for operations that work at the AgentMessage level: Context window management (pruning old messages); Injecting context from external sources. **Contract: must not throw or reject.** Return the original messages or another safe fallback value instead."

    transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;

Also present: `convertToLlm` (required on `AgentLoopConfig`, optional on `AgentOptions` with a `defaultConvertToLlm` fallback) — "Converts `AgentMessage[]` to LLM-compatible `Message[]` before each LLM call. … AgentMessages that cannot be converted (e.g., UI-only notifications, status messages) should be filtered out. Contract: must not throw or reject."

The `CustomAgentMessages` declaration-merging seam for domain message types is documented in `dist/types.d.ts` just above `AgentMessage` (the JSDoc example still names a stale module, `@mariozechner/agent`).

### 3.5 Event subscription API

**[DISK]** `dist/agent.d.ts:60-70`, verbatim:

    /**
     * Subscribe to agent lifecycle events.
     *
     * Listener promises are awaited in subscription order and are included in
     * the current run's settlement. Listeners also receive the active abort
     * signal for the current run.
     *
     * `agent_end` is the final emitted event for a run, but the agent does not
     * become idle until all awaited listeners for that event have settled.
     */
    subscribe(listener: (event: AgentEvent, signal: AbortSignal) => Promise<void> | void): () => void;

**[DISK]** `dist/types.d.ts:374-...` — the full `AgentEvent` union (10 members):

    export type AgentEvent =
      | { type: "agent_start" }
      | { type: "agent_end"; messages: AgentMessage[] }
      | { type: "turn_start" }
      | { type: "turn_end"; message: AgentMessage; toolResults: ToolResultMessage[] }
      | { type: "message_start"; message: AgentMessage }
      | { type: "message_update"; message: AgentMessage; assistantMessageEvent: AssistantMessageEvent }
      | { type: "message_end"; message: AgentMessage }
      | { type: "tool_execution_start"; toolCallId: string; toolName: string; args: any }
      | { type: "tool_execution_update"; toolCallId: string; toolName: string; args: any; partialResult: any }
      | { type: "tool_execution_end"; toolCallId: string; toolName: string; result: any; isError: boolean };

*My inference:* this event stream is the natural evidence-trail source (every tool start/end with args and result), but it is **observational** — it fires around execution, so it cannot itself block. Blocking must go through `beforeToolCall`.

### 3.6 Tool registration

**[DISK]** `dist/types.d.ts:339-...`, verbatim:

    export interface AgentTool<TParameters extends TSchema = TSchema, TDetails = any> extends Tool<TParameters> {
        /** Human-readable label for UI display. */
        label: string;
        /**
         * Optional compatibility shim for raw tool-call arguments before schema validation.
         * Must return an object that matches `TParameters`.
         */
        prepareArguments?: (args: unknown) => Static<TParameters>;
        /** Execute the tool call. Throw on failure instead of encoding errors in `content`. */
        execute: (toolCallId: string, params: Static<TParameters>, signal?: AbortSignal, onUpdate?: AgentToolUpdateCallback<TDetails>) => Promise<AgentToolResult<TDetails>>;
        /**
         * Per-tool execution mode override.
         * - "sequential": this tool must execute one at a time with other tool calls.
         * - "parallel": this tool can execute concurrently with other tool calls.
         *
         * If omitted, the default execution mode applies.
         */
        executionMode?: ToolExecutionMode;
    }

`AgentToolResult<T>` (`dist/types.d.ts:316-...`): `content: (TextContent | ImageContent)[]`, `details: T`, `usage?: Usage`, `addedToolNames?: string[]` ("Names of tools introduced by this result and available from this transcript point onward"), `terminate?: boolean`.

**Registration is by assignment to agent state**, not a registry method: `AgentState.tools` is an accessor pair — "Available tools. Assigning a new array copies the top-level array." Same for `messages`. Read via `agent.state.tools`; the probe constructs with `initialState: { systemPrompt, model, tools: [tool] }`.

The schema dialect is **typebox** (`import { Type } from "typebox"`, re-exported by `pi-ai`; `typebox 1.3.7` is a hard dep of both packages). `AgentTool` extends `Tool<TParameters>` from `pi-ai`.

Built-in harness tools (a separate, harness-level registry): `dist/harness/tools/index.d.ts` exports `createBashTool`, `createEditTool`, `createReadTool`, `createWriteTool` and their input/details types.

### 3.7 Session backend, durable execution, and resume — **and the stub finding**

This is where the picture changes materially from what the prior research note assumed.

**The durable-session layer is implemented.**

**[DISK]** `dist/harness/session/index.d.ts` exports `JsonlSessionRepo` (`./jsonl.ts`), everything from `./memory.ts` (`InMemorySessionStorage`, `InMemorySessionRepo`), everything from `./session.ts` (`class Session`), and `./types.ts` (`SessionStorage`, `SessionTree`, `SessionRepo`, `Entry`, `LaneRecord`, …).

**[DISK]** `dist/harness/session/session.d.ts` — `class Session<TMetadata extends SessionMetadata = SessionMetadata> implements SessionTree` with a real API: `getMetadata()`, `view(lane)`, `getLeafId()`, `getEntry(id)`, `getStats()`, `findEntries(query?)`, `findEntriesOnBranch(query & BranchBounds)`, `appendMessage(message)`, `appendCustomEntry(customType, data?)`, `getLanes()`, `createLane(lane, at)`, `moveLane(lane, to)`, `appendRecord(record)`, `findRecords(query?)`, `findOpenOperations(lane, options?)`, `getLog(options?)`.

**[DISK]** I verified by marker-scanning the compiled JS that the following are **real implementations, not stubs** (no `NotImplemented` / `unavailable(` markers; sizes 1.4 KB–23 KB): `harness/session/jsonl/repo.js` (8.5 KB), `harness/session/jsonl/storage.js` (9.1 KB), `harness/session/session.js` (9.2 KB), `harness/reducer.js` (19.5 KB), `harness/compaction/compaction.js` (23.2 KB), `harness/tools/{bash,read,write,edit}.js`, `harness/env/nodejs.js` (22.9 KB, `NodeExecutionEnv`).

**[DISK]** `dist/harness/reducer.d.ts` — the recovery algebra is exported:

- `validateRecordLog(input: RecordLogSlice): void` (`reducer.d.ts:97`) — "Validates a bounded lane recovery slice without reading or mutating session state."
- `reduceLaneState(input: LaneReductionInput): LaneReductionResult` (`reducer.d.ts:99`) — "Purely reconstructs one lane's orchestration state from its bounded recovery inputs."
- `type RecordLogCorruptionReason` — a closed set of 12 impossible-state codes (`multiple_open_operations`, `unknown_operation`, `record_after_finish`, `tool_call_mismatch`, `duplicate_tool_invocation`, …), with the rule: "Restore must reject such states rather than repair or continue it".
- `LaneState` carries `operation` (`kind: "run" | "compaction" | "navigation"`, `step`, `toolBatch`, `pendingSteer`, `pendingFollowUp`, `pendingWrites`, `deferred`, `overflowRecoveryUsed`), i.e. everything needed to rehydrate a mid-run loop position.

**But the orchestrator that would drive it is a stub.**

**[DISK]** `dist/harness/agent-harness.js`:

- `dist/harness/agent-harness.js:52-60` — `class UnavailableRegistry` whose only method throws:

      on(_name, _handler, _options) {
          throw this.isClosed() ? new HarnessClosed() : new HarnessNotImplemented(this.operation);
      }

- `dist/harness/agent-harness.js:83-84` — the constructor installs it for both registries:

      this.hooks  = new UnavailableRegistry("hooks.on",  () => this.closed);
      this.events = new UnavailableRegistry("events.on", () => this.closed);

- `dist/harness/agent-harness.js:105-107` — `static async create(options)` refuses to restore:

      const [record] = await options.session.findRecords({ limit: 1 });
      if (record !== undefined) throw new HarnessNotImplemented("create.restore");
      return { harness: new AgentHarness(options), suspended: [] };

- `dist/harness/agent-harness.js:115` onward — every run-level method rejects via `this.unavailable(op)` -> `Promise.reject(this.closed ? new HarnessClosed() : new HarnessNotImplemented(operation))`: `prompt`, `skill`, `promptFromTemplate`, `compact`, `navigateTree`, `resume`, `abort`, `steer`, `followUp`, `nextRun`, `cancelQueued`, `recordUsage`, `waitForIdle`, `runWhenIdle`, `peekAction`, `executeAction`, `runToCompletion`, `watch`, `lane`, `createLane`, `lanes`, `watchSession`.
- What **does** work on `AgentHarness`: `getLeafId()`, `getModel/setModel`, `getThinkingLevel/setThinkingLevel`, `getActiveTools/setActiveTools`, `getTools/setTools`, `getResources/setResources`, `getStreamOptions/setStreamOptions`, `getRetryPolicy/setRetryPolicy`, `getCompactionSettings/setCompactionSettings`, `getSteeringMode/setSteeringMode`, `getFollowUpMode/setFollowUpMode`, `close()`.

Corroborating evidence that this is the shipped state and not a local corruption: `pi-coding-agent` ships `dist/server/create-harness.js` exporting `createCodingAgentHarness(options): Promise<{ harness: AgentHarness; suspended: SuspendedOperation[] }>`, which imports `AgentHarness` from `@earendil-works/pi-agent-core` — i.e. it routes through the stub. Meanwhile the **working** product path is elsewhere: `pi-coding-agent/dist/core/agent-session.js` (51 KB) is the real session layer; its class doc says "AgentSession - Core abstraction for agent lifecycle and session management … Event subscription with automatic session persistence … Compaction (manual and auto) … Session switching and branching", and it drives the runtime `Agent` directly (`agent-session.js:222` assigns `this.agent.beforeToolCall = ...`; the constructor does `this._unsubscribeAgent = this.agent.subscribe(this._handleAgentEvent)`).

**Net resume/checkpoint story for option A (as shipped in 0.84.3):**

| Path | Status |
|---|---|
| `Agent` + `beforeToolCall` / `transformContext` / `subscribe` | **Works.** Fully implemented; probe-verified. |
| In-memory transcript across a process restart | **Not provided.** `Agent.reset()` "Clear transcript state, runtime state, and queued messages"; `Agent` holds `_state` in memory only. |
| Durable session storage (`JsonlSessionRepo`, `Session`, `InMemorySessionRepo`) | **Implemented and usable standalone.** |
| Lane-state recovery algebra (`reduceLaneState`, `validateRecordLog`, `RecordLogCorruption`) | **Implemented and exported.** |
| `AgentHarness` orchestration, `hooks.on`, `events.on`, `resume()`, restore-on-create | **Stubbed — rejects with `HarnessNotImplemented`.** |
| `createCodingAgentHarness()` (`pi-coding-agent/dist/server/create-harness.js`) | **Routes into the stub.** |
| Session-backend conformance harness | **Shipped and usable:** `@earendil-works/pi-agent-core/session/testing` -> `createSessionBackendConformance(factory)` returning `readonly SessionBackendConformanceCase[]` (`{ group, name, run(): Promise<void> }`); fixtures are `SessionBackendFixture extends AsyncDisposable` with `readonly repository: SessionRepo`; `SessionBackendFixtureFactory = () => Promise<SessionBackendFixture>`. |

*My inference:* option A is best described as **"runtime loop + durable-session substrate shipped; the opinionated durable harness is declared but not yet wired."** Adopting it means writing your own resume driver on top of `Session` / `reduceLaneState`, or consuming `pi-coding-agent`'s `AgentSession` (which is the harness layer, not the runtime layer).

### 3.8 The `AgentHarness` hook names and the `Hooks` / `Events` seam (type-level)

**[DISK]** `dist/harness/agent-harness.d.ts:303` — the complete `HookName` union, verbatim:

    export type HookName =
      | "before_run" | "before_resume" | "before_run_end" | "transform_context" | "before_request"
      | "before_payload" | "after_response" | "before_tool" | "after_tool"
      | "before_compaction" | "before_navigation";

**Note carefully: the `.d.ts` gives no return contract for these hooks.** `Hooks.on` is typed as:

    export interface Hooks {
        on(name: HookName, handler: (event: unknown) => unknown | Promise<unknown>, options?: { id?: string }): () => void;
    }

So `before_tool` at the *harness* level is **not** documented to block anything — the parameter is `unknown` and the return is `unknown`. The only hook in this package with a blocking contract readable from types is the **runtime-level** `beforeToolCall` of section 3.3. And in 0.84.3 you cannot even register a harness hook: `hooks.on` throws `HarnessNotImplemented` (section 3.7).

`Events` (harness) is likewise thin — `dist/harness/events.d.ts` defines only two event types, `run_start` (`{ lane, runId }`) and `run_end` (`{ lane, runId, outcome: "completed" | "aborted" | "failed", leafId }`), with `on<TType>(type, listener): () => void` and the explicit note: "Earlier events are not replayed and no current-state snapshot is provided; use a lane or session watch for both."

Other harness types worth naming: `AgentHarnessTool<TContext, TParameters, TDetails>` = `Omit<AgentTool<...>, "execute">` plus `execute(toolCallId, params, signal, onUpdate, context)` (extra `context` arg); `AgentHarnessOptions` (`session`, `models`, `model`, `tools?`, `toolContext?`, `systemPrompt?`, `resources?`, `retry?`, `compaction?`, `toolExecution?`, `drive?: "automatic" | "manual"`, …); `AgentLane` (`prompt`, `skill`, `compact`, `navigateTree`, `resume()`, `abort()`, `steer` / `followUp` / `nextRun`, `peekAction()` / `executeAction()` — the manual-drive step API —, `watch()`); `RunOutcome` = `completed | aborted | failed | suspended` where `suspended` carries a `DeferredHandle`; `SuspendedOperation` (`reason: "crash" | "deferred"`, `missing: { tools, models }`); `HarnessTool = AgentTool & { replay?: "never" | "safe" }`.

The `ExecutionEnv` / `FileSystem` / `Shell` capability interfaces are in `dist/harness/types.d.ts` with a hard invariant stated in the doc comment: "Operation methods must never throw or reject. All filesystem failures, including unexpected backend failures, must be encoded in the returned `Result`." `NodeExecutionEnv` is the Node implementation (`dist/node.d.ts`).

### 3.9 `@earendil-works/pi-ai` deterministic offline provider

**Yes — it exists, and it is first-party.**

**[DISK]** `node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/index.d.ts` includes `export * from "./providers/faux.ts";`.

**[DISK]** `dist/providers/faux.d.ts` — actual exports:

- `fauxProvider(options?: RegisterFauxProviderOptions): FauxProviderHandle` — "Faux provider for tests built on explicit `Models` collections", with the doc's own usage snippet: `const faux = fauxProvider(); const models = createModels(); models.setProvider(faux.provider); faux.setResponses([fauxAssistantMessage("hi")]);`
- `createFauxCore(options): { api, provider, models, stream, streamSimple, fetchDeferred, cancelDeferred, getModel, state, setResponses, appendResponses, getPendingResponseCount }`.
- Message builders: `fauxText(text): TextContent`, `fauxThinking(thinking): ThinkingContent`, `fauxToolCall(name, arguments_, options?: { id?: string }): ToolCall`, `fauxAssistantMessage(content: string | FauxContentBlock | FauxContentBlock[], options?: { stopReason?, deferred?, errorMessage?, responseId?, timestamp? }): AssistantMessage`.
- Scripting: `FauxResponseStep = AssistantMessage | FauxResponseFactory` where `FauxResponseFactory = (context, options, state, model) => AssistantMessage | Promise<AssistantMessage>`; plus `setResponses`, `appendResponses`, `getPendingResponseCount`, `unregister`.
- Determinism/control knobs: `FauxProviderState { callCount, deferredFetchCount, cancelledDeferred }`; `RegisterFauxProviderOptions` includes `deferred?: { pendingFetches?, pollAfterMs? }`, `tokensPerSecond?`, `tokenSize?: { min?, max? }`, plus `api?`, `provider?`, `models?: FauxModelDefinition[]`.

Also in `pi-ai`'s index and relevant to a loop host: `EventStream` (`./utils/event-stream.ts`, the return type of `agentLoop`), `Models` / `createModels` (`./models.ts`, `./models-store.ts`), `DeferredHandle`, `Transport`, `SimpleStreamOptions`, `StreamFunction`, `contentText`, `uuidv7`, `Type` (re-exported typebox).

### 3.10 The existing probe and its recorded results

**[DISK]** `.trellis/tasks/08-27-dove-interop-layer/research/probe-pi-agent-core.mjs` — the script:

- Resolves `pi-agent-core` / `pi-ai` by hand from either `node_modules/@earendil-works` or the nested `node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works` path, then `import(pathToFileURL(...))` — necessary because they are not direct deps of `dove-pi`.
- Builds `new Agent({ initialState: { systemPrompt, model: faux.getModel(), tools: [danger_write] }, streamFn, transformContext })` where `streamFn` captures the request context and delegates to `models.streamSimple(m, ctx, o)`.
- Gate under test: `options.beforeToolCall = async ({ toolCall }) => toolCall.name === 'danger_write' ? { block: true, reason: 'authorization-missing:no RoE file' } : undefined;`
- Two scripted responses: `fauxAssistantMessage([fauxToolCall('danger_write', { path: 'x.txt' })])` then `fauxAssistantMessage('final answer')`.
- `transformContext` appends `'[dove-state] objective=probe; authorization=missing'` and counts calls.
- Asserts: `toolExecuted` count, that the block reason reached the transcript, that the injected text reached the 2nd provider request, and that the run reached the second response.

**[DISK]** `.trellis/tasks/08-27-dove-interop-layer/research/base-selection-2026-09-25.md` records the run output verbatim:

    WITHOUT gate: toolExecuted=1
    WITH    gate: toolExecuted=0
    VERDICT gate blocks       : true
    VERDICT reason reaches LLM: true
    VERDICT context injected  : true

and a hook-coverage table marking **未实测 (not measured)** for: domain message types (declaration merging + `convertToLlm`), session persistence ("可插拔 session backend"), and the `harness/*` exports (compaction / effect-gate / reducer). Section 3.7 above closes the third of those with a static finding: the substrate exists, the orchestrator does not.

**Correction to that note's section 3 table, from this session:** the row "会话持久化 | 可插拔 session backend" should be read as *substrate present, driver stubbed* — see 3.7. The `harness/*` row is now answered.

---

## 4. Local runtime-layer option B: dsh / Cordis

### 4.1 What dsh and Cordis are

**[WEB]** *README* — https://github.com/deepseek-ai/deepseek-harness (fetched via https://api.github.com/repos/deepseek-ai/deepseek-harness/readme)

> "DeepSeek Harness (`dsh`) is an open-source agent harness developed by DeepSeek AI.
>
> It is built on an **everything-is-a-plugin** architecture and powered by Cordis, whose design is described in *A Programming Paradigm for Spatiotemporal Composability*."

**[WEB]** `@deepseek-ai/dsh` latest manifest — https://registry.npmjs.org/@deepseek-ai/dsh/latest

- `name: "@deepseek-ai/dsh"`, `version: "0.1.5-rc.3"`, `license: "MIT"`, `repository: { url: "git+https://github.com/deepseek-ai/deepseek-harness.git", directory: "apps/cli" }`, `bin: { dsh: "lib/bin.js" }`, `description: "dsh CLI: profile boot, plugin management, and the browser UI alias"`.
- Direct dependency of note: `"@deepseek-ai/cordis": "4.0.2"`, plus ~30 `@deepseek-ai/dsh-*` packages (`dsh-base`, `dsh-tool-bash`, `dsh-plan-mode`, `dsh-mcp-client`, …), all at `^0.1.5-rc.3`.
- dist-tags from the full packument (https://registry.npmjs.org/@deepseek-ai/dsh): `latest: 0.1.5-rc.3`, `next: 0.1.7-rc.2`, `alpha: 0.1.7-alpha.2`.

**[WEB]** `@deepseek-ai/cordis` latest manifest — https://registry.npmjs.org/@deepseek-ai/cordis/latest

- `version: "4.0.4"`, `license: "MIT"`, `description: "Meta-Framework for Modern JavaScript Applications"`, `repository.directory: "vendor/cordis"` — i.e. dsh **vendors** Cordis.
- Upstream `cordis` on npm: dist-tags `latest: 4.0.0-rc.10`, `next: 4.0.0-beta.5` (https://registry.npmjs.org/cordis). The upstream repo has moved to `cordiverse/cordis` ("Meta-Framework of Spatiotemporal Composability", https://api.github.com/repos/shigma/cordis).

### 4.2 The plugin / extension model

**[WEB]** *Cordis Primer* — https://deepseek-harness.github.io/deepseek-harness/en/reference/cordis-primer.md

Verbatim "Cordis In Five Ideas":

> - "**A plugin is a object that implements Service.** It can be a function with optional `inject` and `apply(ctx)` fields, or a `Service` subclass whose lifecycle Cordis mounts into the current context."
> - "**A context is a repository of services.** A service claims a stable `ctx.<key>` such as `ctx.tools`, `ctx.llm`, or `ctx.sessions` from a context; other plugins find services via key instead of importing a concrete implementation."
> - "**Declare service dependency via `inject`.** A plugin that names required services waits until those services exist, so load order is expressed through service requirements rather than manual boot sequencing."
> - "**Typed Events for communication.** Services declare event names through TypeScript declaration merging, then dispatch them as `emit`, `waterfall`, `parallel`, `serial`, or `bail` depending on whether listeners observe, wrap, fan out, run in order, or stop at the first bail value."
> - "**Registrations are reversible effects.** Prompt sections, tool schemas, adapters, providers, and listeners are installed through `ctx.effect()` or `ctx.on()` so reload and teardown unwind them predictably."

Dispatch modes table (verbatim): `emit` (not awaited, registration order, no return value); `waterfall` (not awaited, registration order, has return value); `parallel` (awaited, all in parallel, no return); `serial` (awaited, registration order, return); `bail` (not awaited, until one bails, return). "The dispatch mode is part of the event's public contract."

Waterfall semantics (verbatim): "`ctx.waterfall` is around-middleware. A listener receives `(...args, next)`. Call `next()` to delegate the possibly wrapped result to the next service; return without `next()` to short-circuit." … "For single-decision events, short-circuiting is the design. A policy listener can return without `next()` when it owns the decision".

Practical rules (verbatim): "Encapsulate behavior into plugins: a tool pipeline event belongs to `ctx.tools`, model streaming belongs to `ctx.llm`, and live agent coordination belongs to `ctx.agents`. Prefer events for interception and policy; prefer service methods for direct capability calls." … "Every registration should have a disposer".

**[WEB]** *DeepSeek Harness Architecture* — https://deepseek-harness.github.io/deepseek-harness/en/reference/index.md

> "Cordis is the framework under dsh: plugins contribute services, typed events, and reversible effects to a shared context. **Every part of the product is a plugin, including the model adapter, the tool registry, the session log, and the agent loop itself, so each is replaceable from configuration.**
>
> There is no privileged core to patch: you extend dsh by mounting a plugin beside the others, and registrations are effects that unwind when their plugin unloads."

Composition is declarative: **profiles** (`web`, `headless`, `sdk`, `sdk-minimal`, `acp`) stack **bundles**; a bundle declares itself in its own `package.json` under a `dsh` field (`dsh.profile` lists a profile's bundles, `dsh.bundle` points at a bundle's patch file). Layers apply in order: each bundle -> profile `cordis.patch.yml` -> home-level patch -> `--patch` overlay. `dsh --profile web --dump-config` prints the tree, and "Any row it prints can be replaced by a patch of your own."

Core packages table (verbatim, excerpt):

| Package | Owns | `ctx` key |
|---|---|---|
| `core/session` | The append-only `SessionEvent` log and in-memory store | `ctx.sessions` |
| `core/system-prompt` | Prompt-section and tool-schema assembly | `ctx.systemPrompt` |
| `core/tools` | The scoped tool registry and guarded execution pipeline | `ctx.tools` |
| `core/agent` | The `Agent` interface, live registry, and `agent/*` events | `ctx.agents` |
| `core/agent-loop` | The default driver implementing that interface | `ctx.agentLoop` |

`dsh-base` is described as "the shared first layer of the `web`, `headless`, `sdk`, and `acp` profiles: model adapters, tools, persistence, **sandbox and approval policy**, settings, credentials, telemetry."

### 4.3 What the official documentation says about API stability

Three separate first-party statements, all adverse:

1. **Cordis (the framework dsh is built on) — upstream README**, `packages/core/README.md`, verbatim:
   > "**Cordis is under active development. The API is not yet stable and may change without notice.**"
   > "Documentation: [cordis-primer](https://deepseek-harness.github.io/deepseek-harness/reference/cordis-primer) (**official documentation is still under construction**)"

   **[WEB]** https://raw.githubusercontent.com/cordiverse/cordis/master/packages/core/README.md

2. **dsh itself — repository README**, verbatim:
   > "## Developer preview
   > DeepSeek Harness is in *developer preview* and iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**
   > Review the [safety notice](SAFETY.md) before running the project."

   **[WEB]** https://github.com/deepseek-ai/deepseek-harness (README fetched via the GitHub API)

3. **Version-channel evidence**, consistent with (1) and (2):
   - `@deepseek-ai/dsh`: `latest` = `0.1.5-rc.3`; `next` = `0.1.7-rc.2`; `alpha` = `0.1.7-alpha.2`. **[WEB]** https://registry.npmjs.org/@deepseek-ai/dsh
   - upstream `cordis`: `latest` = `4.0.0-rc.10`; `next` = `4.0.0-beta.5`. **[WEB]** https://registry.npmjs.org/cordis
   - dsh vendors its own `@deepseek-ai/cordis` (`4.0.4`, `repository.directory: vendor/cordis`) — so the vendored fork and the upstream package version independently. **[WEB]** https://registry.npmjs.org/@deepseek-ai/cordis/latest

*My inference:* the earlier research note's framing — "Cordis API unstable is not sufficient reason to reject dsh" — is still right as *logic*, but the instability claim is now sourced from two independent first-party statements (Cordis README + dsh README's "THERE WILL BE COMPATIBILITY-BREAKING CHANGES"), not one.

### 4.4 Who owns the loop

**[WEB]** *Agent Turn And Step Lifecycle* — https://deepseek-harness.github.io/deepseek-harness/en/reference/agent-lifecycle.md

The **Driver** owns the loop. The doc's sequence diagram, verbatim step names:

`followup(content)` -> `agent/inbox/spliced` -> `agent/inbox/inserted` -> driver wakes -> `agent/status running` -> `turn/start` -> claim pending next-step input + one queued prompt -> `system-prompt/assemble` waterfall -> `agent/pre-step` waterfall -> `step/start` -> `agent/request` waterfall -> `llm/stream` waterfall -> `assistant/message` -> classify pending calls by `executionMode` -> per call: `tool/call` then "ordered pre, concurrent execute" then "ordered post" then `tool/result` -> `step/end` -> optional `agent/turn-stopping` -> `turn/end` -> `agent/status idle`.

Key invariants stated:

- "The `assistant/message` event records every successful provider call, including content-less and `max-tokens` finishes, and embeds the exact compact timed stream."
- "The returned `agent/pre-step` decision is **authoritative**; listeners wrapping `next()` preserve downstream messages … unless replacement is intentional." — i.e. a pre-step hook can reject the whole proposed step before any provider request.
- "It keeps durable replay facts on `session/event` and live control/status on `agent/*`." … "SDK users that need replayable transcript data should consume `session/event`; `agent/*` is the live coordination API".

**Who owns it, concretely:** `core/agent-loop` — "The default driver implementing that interface", `ctx.agentLoop` — and because "the agent loop itself" is a plugin, it is replaceable from configuration.

### 4.5 The approval gate — can it BLOCK a tool call before execution?

**Yes, and it is fail-closed by construction.**

**[WEB]** *User Approval* — https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/approval.md

Verbatim from the top of the page:

> "The user-approval seam of `dsh-user-approval` answers one question: may this specific action proceed? It owns the shared request/outcome vocabulary, the `ctx.approval` dispatch service, the `approval/request` answerer waterfall, the log-only audit pair, and the per-session `ask` / `never` policy. … **Callers such as `dsh-tools` and `dsh-tool-bash` consume the closed outcome and fail closed unless it is `allowed-once`.**"

The outcome type, verbatim:

    /**
     * Closed approval outcomes: a one-shot grant, explicit rejection, withdrawn
     * request, or unavailable answerer. Callers fail closed on `unavailable`.
     */
    type ApprovalOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'

> "`allowed-once` grants only the asked-about action; callers deny on `rejected`, `cancelled`, and `unavailable`. A missing, non-owning, throwing, or non-conforming answerer becomes `unavailable` rather than opening the gate."

Policy, verbatim: `type ApprovalPolicy = 'ask' | 'never'` —

> "`ask` (the default) — delegate to the composed answerers; with none composed the chain falls through to the fail-closed `'unavailable'`. `'never'` — never prompt anyone: every ask resolves `'rejected'` deterministically."

Service method, verbatim signature: `async request(req: ApprovalRequest): Promise<ApprovalOutcome>` —

> "`ctx.approval.request(req)` requires the requesting session to be inside an open turn. It appends `approval/asked`, obtains one outcome, appends the matching `approval/decided`, and resolves with that outcome. The `never` policy is enforced inside the service **before waterfall dispatch, so even an answerer registered later with `prepend` cannot bypass it**." … "`'allowed-once'` is the only grant." … "an idle ask rejects before appending anything."

Also: `setPolicy(agent: Agent, policy: ApprovalPolicy): void`, `overrideOf(session: Session): ApprovalPolicy | undefined`, and the read path `ctx.approval.effectivePolicy(session)`.

Request shape: `ApprovalRequest` carries `agent: Agent`, `toolName: string`, optional `callId?: ToolCallId`, optional `reason?: string`, optional `signal?: AbortSignal`. It "deliberately omits tool arguments: an answerer attaches the prompt to the already-streamed tool call through `callId` instead of rendering a second copy that could drift."

Audit: "Every request receives a fresh `ApprovalRequestId` … The brand pairs the `approval/asked` and `approval/decided` audit events". "The audit events are log-only and do not enter the model transcript."

Answerer extension point: the `approval/request` **waterfall** event — `'approval/request'(this: Scoped<Agent>, req: ApprovalRequestEvent, next: () => Promise<ApprovalOutcome>): Promise<ApprovalOutcome>` — "Return an outcome to claim the request or call `next()` to delegate. Scope-filtered dispatch … agent-scoped listeners receive only that agent."

**[WEB]** *Tool Execution Pipeline* — https://deepseek-harness.github.io/deepseek-harness/en/reference/tool-execution-pipeline.md

Where the gate sits in the pipeline (verbatim node labels and edges):

    tool/call (logged before execution)
      -> tools/pre-execute waterfall (hooks, permission, sandbox)
      -> guards (Registered monotonic guards: deny or abstain; identity protected)
      -> ctx.approval one-shot prompt (absent or unanswerable: deny)
      -> tools/execute waterfall (timeout, retry, metrics — around dispatch)
      -> Registered tool execute() body
      -> fs/write-intent | fs/edit-intent (tool-fs mutations only)
      -> tools/post-execute waterfall (accept, block, replace, add context)
      -> Registry outer normalization
      -> ToolDefinition.finalizeContent
      -> tools/result (synchronous notification, frozen authoritative outcome)
      -> tool/result session event (single model-facing outcome)

Edges stated: `pre -->|deny| denied`, `pre -->|ask| approval`, `approval -->|allowed-once| guards`, `approval -->|rejected, cancelled, unavailable| denied`, `guards -->|allow| around`, `guards -->|deny| denied`, where `denied` is labelled "**denied or approval refused / tool body skipped**".

Design note, verbatim: "Generic pre/post waterfalls host hooks and approval policy; `ctx.approval` resolves asks **before** monotonic guards, and owner policy that must not be reordered remains a registered guard. Around-dispatch concerns such as timeouts wrap `tools/execute`."

*My inference:* for the three verticals this is the strongest gate of the four options — it is a **pre-execute waterfall with a deny edge before the tool body**, it is fail-closed on every abnormal answerer state, it is enforced inside the service before dispatch so a later-registered answerer cannot bypass the `never` policy, and every ask/decision is logged as a durable, model-invisible audit pair.

### 4.6 Resume / checkpoint story

**[WEB]** *Session Persistence* — https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/persistence.md

Verbatim highlights:

- "The **durability seam** for the event log. `session.md` describes the in-memory `Session` — the append-only `SessionEvent` log that is the source of truth. This page describes how that log is made durable: the abstract `SessionPersistence` service, its provider model and shipped JSONL backend, the flush checkpoint, crash recovery, and the metadata header".
- Seam: one abstract service (`ctx.sessionPersistence`) exposing `create` / `open` / `stat` / `list` over the existing `SessionEvent` — "**no parallel persisted event type**" — where `create` and `open` return a per-session `SessionHandle` (`read` / `append` / `flush` / `close`) that "carries all log access and single-writer ownership." Shipped provider: `dsh-session-persistence-jsonl`.
- Single writer: "in-process single-writer ownership makes a second `open(id, 'write')` reject with `SessionAlreadyOwnedError` while an owner is active"; a mutation on a `read` handle is a `SessionReadOnlyError`.
- Durability barrier: "only a resolved `flush` promises it survives a crash — a backend may buffer or batch physical writes behind `append`." `flush` is "The durability barrier — the one operation that promises storage".
- Flush checkpoint: "`session/event` is a *synchronous* notification; the mounted backend routes it by session id into the active write handle's bounded write-behind window without blocking the producer … The first pending event starts a fixed internal batching window, and later events join without resetting its deadline." … "`session/flush` cancels the wait and drains through quiescence, so the loop still uses it as the ordering and error-observation checkpoint before claiming the next ordinary turn."
- **Crash recovery** — the section heading is literally "Crash recovery preserves an interrupted turn": "A log crashed mid-turn ends with an open `turn/start` and no `turn/end`. Persistence does **not** truncate or repair it … It returns the physically valid contiguous log; only the incomplete fragment of a torn physical tail, belonging to an append that never resolved, is discarded — complete records recovered from it (the JSONL backend partially decodes a torn Zstandard frame) are durably rewritten by the write path before the handle's first new append."
- **Who repairs:** "Repair is the reader's job: **resume (agent-loop)** reads the stored log through its write handle, computes `interruptedTurnClosers` — missing tool errors, any open `step/end`, and a synthetic `turn/end { reason: { kind: 'interrupted' } }` — and appends them through the same handle as an ordinary batch before publishing the Session. `interrupted` is the one `TurnEndReason` no loop emits."
- Refusal over repair: a backend that cannot faithfully interpret a log raises `SessionFormatUnsupportedError` ("distinct from `SessionPersistenceCorruptionError` because nothing is damaged").
- Header metadata that must survive resume: `origin?: 'subagent'`, `delegationDepth?: number` ("Persisted so a recursion budget survives restart and resume — a runtime-only depth would reset a resumed child to top-level"), `agentPreset?: string` ("Durable because the preset decides the session's tools and prompt: a resume that restored a different composition would replay history the model can no longer act on").

*My inference:* dsh's resume story is **stronger and more explicit** than what pi-agent-core ships today: the log is the source of truth, an interrupted turn is preserved rather than truncated, the repair is performed by the same driver that owns the loop, and the repair is itself an ordinary durable batch. The main risk is not design quality but section 4.3.

### 4.7 The extension seam

Summarised from 4.2: **mount a Cordis plugin**. Concretely, a third party adds behaviour by (a) implementing a function with `inject` / `apply(ctx)` or a `Service` subclass, (b) claiming or consuming a stable `ctx.<key>` service, (c) registering typed events via declaration merging and dispatching them with the declared mode, and (d) installing everything through `ctx.effect()` / `ctx.on()` so it unwinds on unload. Distribution is via `dsh plugin` / a profile + ordered patch files, and a repo opts into discoverability with the `dsh-plugin` GitHub topic.

For policy specifically, the documented interception points are the pipeline events (`tools/pre-execute`, `tools/execute`, `tools/post-execute`, `tools/result`), the `approval/request` waterfall, registered monotonic guards, and the loop-level events (`agent/pre-step`, `agent/request`, `agent/request-error`, `agent/turn-stopping`, `llm/stream`, `system-prompt/assemble`).

---

## 5. Must-answer matrix

| | **LangGraph** (official runtime) | **MCP** (protocol) | **A: pi-agent-core 0.84.3** | **B: dsh / Cordis** |
|---|---|---|---|---|
| **Who owns the loop** | You, expressed as a graph; LangGraph owns the runtime/super-step scheduler, checkpoint writes, and interrupt/resume | Nobody. MCP is a protocol; the *host* owns the loop. Tools are "**model-controlled**" and "the protocol itself does not mandate any specific user interaction model" | **You.** `Agent` "owns the current transcript, emits lifecycle events, executes tools" (`agent.d.ts:26-31`); `agentLoop` / `runAgentLoop` are exported free functions | **The Driver** (`ctx.agentLoop`, `core/agent-loop`) — but it is itself a plugin and "replaceable from configuration" |
| **Can an approval gate BLOCK a tool call before execution? Exact API + return shape** | **Yes**, via `interrupt()` placed inside the tool function or in a dedicated approval node before the tool node. Resume with `Command(resume=...)`. Payload surfaces on `stream.interrupts` / `result["__interrupt__"]` | **No protocol mechanism.** Approval is a **SHOULD**, addressed to "Applications": "there **SHOULD** always be a human in the loop with the ability to deny tool invocations … Present confirmation prompts to the user". The client's only enforcement is not sending `tools/call` | **Yes.** `beforeToolCall?: (context: BeforeToolCallContext, signal?: AbortSignal) => Promise<BeforeToolCallResult \| undefined>`; return `{ block?: boolean; reason?: string; terminate?: boolean }`. Returning `{ block: true }` makes the loop emit an error tool result instead of executing (`agent-loop.js:419-427`). Probe-verified: `toolExecuted` 1 -> 0 | **Yes, fail-closed.** `ctx.approval.request(req: ApprovalRequest): Promise<ApprovalOutcome>` with `ApprovalOutcome = 'allowed-once' \| 'rejected' \| 'cancelled' \| 'unavailable'`; "Callers … fail closed unless it is `allowed-once`". Enforced in the `tools/pre-execute` waterfall with an explicit deny edge: "denied or approval refused / tool body skipped" |
| **Resume / checkpoint story** | **Strongest, fully shipped.** `BaseCheckpointSaver` (`put` / `put_writes` / `get_tuple` / `list`), `thread_id` + `checkpoint_id`, `StateSnapshot`, checkpoint per super-step, **pending writes** so completed nodes are not re-run, durability modes `exit` / `async` / `sync`; savers for memory/SQLite/Postgres/Mongo/Cosmos; optional AES-encrypted serializer | **None.** MCP has no session/checkpoint concept. Resumption is entirely the host's problem (the client re-issues requests) | **Substrate yes, driver no.** `Session` / `JsonlSessionRepo` / `InMemorySessionRepo`, `reduceLaneState` / `validateRecordLog`, `RecordLogCorruption`, `session/testing` conformance all implemented — but `AgentHarness` rejects `prompt` / `resume` / `hooks.on` / `events.on` with `HarnessNotImplemented`, and `AgentHarness.create` throws on restore | **Strong.** Append-only `SessionEvent` log is the source of truth; `SessionPersistence` / `SessionHandle` (`append` / `flush`) with a JSONL backend; "Crash recovery preserves an interrupted turn"; resume (agent-loop) computes `interruptedTurnClosers` and appends them as an ordinary durable batch |
| **Extension seam** | Graph construction: `add_node`, `add_edge`, `add_conditional_edges`, `Command(goto=...)`; per-key reducers via `Annotated[...]`; `context_schema` / `Runtime`; `compile(checkpointer=, store=)`; subgraphs | Servers expose `tools`; clients may add transports; `elicitation` capability for server->client user input; client-side HITL is app UI | Assignment-based: `agent.state.tools` / `initialState.tools`; `AgentTool` with `prepareArguments`, `execute(toolCallId, params, signal, onUpdate)`, `executionMode`; hooks `beforeToolCall`, `afterToolCall`, `transformContext`, `convertToLlm`, `shouldStopAfterTurn`, `prepareNextTurn(WithContext)`, `getApiKey`, `onPayload`, `onResponse`; declaration merging on `CustomAgentMessages`; `agent.subscribe(listener)` | Mount a Cordis plugin: `inject` + `apply(ctx)` (or a `Service` subclass), stable `ctx.<key>` services, typed events with declared dispatch mode (`emit` / `waterfall` / `parallel` / `serial` / `bail`), reversible registrations via `ctx.effect()` / `ctx.on()`; profiles + ordered `cordis.patch.yml` layers |
| **First-party API-stability signal** | Versioned, documented compat contract incl. graph migrations and a 1.0.6 recursion-limit default; `DeltaChannel` flagged beta / `langgraph>=1.2` | Revisioned spec (2024-11-05 … 2026-07-28 + `draft`); approval language unchanged between 2025-06-18 and 2026-07-28 | `0.84.3`; `Agent` / `agent-loop` implemented and probe-verified; `AgentHarness` shipped as an explicit `HarnessNotImplemented` stub | dsh README: "**developer preview** … **THERE WILL BE COMPATIBILITY-BREAKING CHANGES**"; Cordis README: "**The API is not yet stable and may change without notice**"; npm `latest` = `0.1.5-rc.3` / `cordis@4.0.0-rc.10` |

---

## Caveats / Not Found

1. **`https://docs.langchain.com/oss/python/langgraph/durable-execution.md` returned HTTP 200 but the body is byte-identical to `persistence.md`** (same 5877 characters). There is no separate durable-execution page at that path; the durability-modes content lives on the checkpointers page. I did not find a page titled "durable execution" in the LangGraph doc set.
2. **I did not fetch the LangGraph JS/TS API reference pages** for `StateGraph` / `Annotation` / `BaseCheckpointSaver`. The JS mirror of the interrupts page was fetched (`interrupt` from `@langchain/langgraph`, `Command({ resume })`); everything else in section 1 is from the Python-side prose docs, which name Python identifiers (`TypedDict`, `Annotated`, `Command(goto=...)`, `compile(checkpointer=...)`). Treat the exact TS spelling of reducer annotations and `add_conditional_edges` as **not verified here**.
3. **I did not read the LangGraph source or package `.d.ts` files** — no LangGraph package is on this machine's disk, and I made no attempt to install one. Claims about LangGraph are documentation-level only.
4. **No `langgraph` version number is pinned by any fetched page** except the two in-text references (`langgraph>=1.2` for `DeltaChannel`, and "Starting in version 1.0.6" for the recursion limit). I could not determine the current release from first-party sources in this session.
5. **MCP: I did not fetch the JSON Schema reference** (`/specification/2026-07-28/schema.md`) or the `basic/index.md` `_meta` section. So the exact wire field names for `_meta.io.modelcontextprotocol/*` beyond what the transports page quotes are unverified.
6. **MCP: I did not fetch the "Security Best Practices" tutorial page** (`/docs/2026-07-28/tutorials/security/security_best_practices.md`), which the authorization page references for token-passthrough / confused-deputy. My statement that MCP standardizes no approval handshake is based on the Tools and Elicitation spec pages, not on that tutorial.
7. **`pi-agent-core`: the `before_tool` hook has no readable return contract.** The `Hooks.on` signature is `(event: unknown) => unknown | Promise<unknown>`, and I could not inspect a working implementation because `AgentHarness` ships it as `UnavailableRegistry`. I therefore cannot say from types or code whether `before_tool` was *intended* to block. Do **not** treat `before_tool` as a gate.
8. **The `AgentHarness` stub finding is static, not executed.** I read `dist/harness/agent-harness.js`, confirmed there is exactly one copy of the package on disk, and confirmed that `pi-coding-agent/dist/server/create-harness.js` imports `AgentHarness` from it. I did **not** run `createCodingAgentHarness()` end to end. If the parent needs certainty, calling `await AgentHarness.create(...)` or `harness.prompt("x")` and observing `HarnessNotImplemented` is the confirmation path.
9. **I did not verify `pi-agent-core`'s session substrate by execution either.** `JsonlSessionRepo`, `Session`, `reduceLaneState` are judged "implemented" from compiled-JS size and the absence of `NotImplemented` / `unavailable(` markers, plus their `.d.ts` contracts. The shipped conformance suite (`@earendil-works/pi-agent-core/session/testing`) is the intended way to prove a backend works.
10. **dsh: I did not run dsh.** Every dsh claim in section 4 is from its official documentation site, its repository README, and npm registry manifests. In particular I did not observe `ctx.approval.request` returning `allowed-once`, and I did not read the `dsh-user-approval` or `core/agent-loop` source — the doc page cites `packages/interaction/user-approval/src/index.ts` as the source of the types, but I did not fetch that file.
11. **dsh: the `approval/request` waterfall signature I quote is from a generated catalog block** on the approval page ("Generated from source by `scripts/gen-cordis-catalog.ts` … verified fresh by `pnpm run verify-cordis-catalog`"). It is first-party-generated, but it is generated, not hand-written prose.
12. **dsh: `SAFETY.md` is referenced by the README but I did not fetch it.** The README says to review it before running the project; that is a live open item for anyone adopting option B.
13. **dsh docs language: the site is primarily Chinese with an English mirror.** I used the `/en/` paths; the `llms.txt` states that both language sides differ only in locale-specific paired document paths.
14. **Upstream Cordis vs vendored Cordis diverge.** Upstream `cordis` is at `4.0.0-rc.10` (dist-tag `latest`) while dsh vendors `@deepseek-ai/cordis@4.0.4`. I did not diff them. Any statement about "the Cordis API" should specify which of the two.
15. **No star counts, download counts, or third-party comparisons were collected in this session** — out of scope for this file, and the prior note already flags stars as the only adoption proxy it could obtain.
16. **`github.com/earendil-works/pi` and `pi.dev` were not fetched over the network.** All Pi facts here come from on-disk package artifacts. The repository URL is quoted from `package.json` on disk, not verified live.
