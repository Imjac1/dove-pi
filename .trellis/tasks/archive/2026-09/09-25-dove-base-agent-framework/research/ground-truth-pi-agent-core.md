# Ground truth: `@earendil-works/pi-agent-core` runtime surface

- Query: Does the runtime layer expose a real blocking gate, and how fat is it?
- Scope: local package type definitions, read directly by the main session
- Date: 2026-09-25
- Package: `@earendil-works/pi-agent-core` 0.84.3 (nested dependency of
  `pi-coding-agent` 0.84.3; also published standalone on npm, latest 0.87.1)
- Files read:
  - `dist/index.d.ts`, `dist/agent.d.ts`, `dist/types.d.ts`

## 1. The blocking gate is real and precisely specified

Verbatim from `dist/types.d.ts`:

```typescript
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

/** Context passed to `beforeToolCall`. */
export interface BeforeToolCallContext {
    assistantMessage: AssistantMessage;
    toolCall: AgentToolCall;
    args: unknown;
    context: AgentContext;
}
```

So the gate is **pre-execution, argument-level, and enforced by the loop**, not a prompt
instruction. `reason` is written into the tool result, so the block is visible to the model.

## 2. The full hook set on the loop

From `dist/agent.d.ts`, `AgentOptions`:

```typescript
initialState?: Partial<...>;
convertToLlm?: (messages: AgentMessage[]) => Message[] | Promise<Message[]>;
transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;
streamFn: StreamFn;                                  // REQUIRED - the caller supplies the model transport
getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;
onPayload?: SimpleStreamOptions["onPayload"];
onResponse?: SimpleStreamOptions["onResponse"];
beforeToolCall?: (context: BeforeToolCallContext, signal?: AbortSignal) => Promise<BeforeToolCallResult | undefined>;
afterToolCall?: (context: AfterToolCallContext, signal?: AbortSignal) => Promise<AfterToolCallResult | undefined>;
shouldStopAfterTurn?: (context: ShouldStopAfterTurnContext, signal?: AbortSignal) => boolean | Promise<boolean>;
prepareNextTurn?: (signal?: AbortSignal) => Promise<AgentLoopTurnUpdate | undefined> | AgentLoopTurnUpdate | undefined;
prepareNextTurnWithContext?: (context: PrepareNextTurnContext, signal?: AbortSignal) => Promise<AgentLoopTurnUpdate | undefined> | AgentLoopTurnUpdate | undefined;
steeringMode?: QueueMode;        // "all" | "one-at-a-time"
followUpMode?: QueueMode;
sessionId?: string;
thinkingBudgets?: ThinkingBudgets;
transport?: Transport;
maxRetryDelayMs?: number;
toolExecution?: ToolExecutionMode;   // "sequential" | "parallel"
```

Three consequences that matter for the base-framework decision:

1. **`streamFn` is required and caller-supplied.** The model call is not owned by the
   package. A framework built on this can substitute any provider, including a scripted
   offline one, without patching the package.
2. **`transformContext` runs per request** and can rewrite the whole message array before
   the provider call. This is where a context-admission boundary would live.
3. **`prepareNextTurn` / `prepareNextTurnWithContext` return `AgentLoopTurnUpdate`**
   (`{ context?, model?, thinkingLevel? }`), so model and context can be swapped between
   turns of one run.

The `Agent` class doc, verbatim:

> `Agent` owns the current transcript, emits lifecycle events, executes tools, and
> exposes queueing APIs for steering and follow-up messages.

## 3. `afterToolCall` merge semantics

```typescript
export interface AfterToolCallResult {
    content?: (TextContent | ImageContent)[];   // replaces the tool result content array in full
    details?: unknown;                          // replaces details in full
    isError?: boolean;
    usage?: Usage;
    terminate?: boolean;                        // early termination only if EVERY result in the batch sets it
}
```

This is a post-execution redaction/normalization hook - the place to strip secrets or
truncate an oversized tool result before it re-enters the transcript.

## 4. The decisive finding: the package is not just a loop, it is also a harness

`dist/index.d.ts` re-exports far more than the loop:

| Export group | Contents |
|---|---|
| `agent.ts` | `Agent`, `AgentOptions` - the thin stateful loop |
| `agent-loop.ts` | `runAgentLoop`, `runAgentLoopContinue` - the low-level loop functions |
| `harness/agent-harness.ts` | `AgentHarness` - a full opinionated harness |
| `harness/session/index.ts` | session backend, lane state, `reduceLaneState`, `validateRecordLog` |
| `harness/skills.ts` | skills |
| `harness/tools/index.ts` | a tool set |
| `harness/system-prompt.ts` | system prompt construction |
| `harness/compaction/*` | `compact`, `shouldCompact`, `estimateContextTokens`, `calculateContextTokens`, `findCutPoint`, `generateSummary`, `DEFAULT_COMPACTION_SETTINGS` |
| `harness/telemetry.ts` | span schemas (`AGENT_TELEMETRY_SCHEMAS`, `AI_TELEMETRY_SCHEMA`, `HARNESS_TELEMETRY_SCHEMA`) |
| `harness/types.ts` | `Skill`, `ExecutionEnv`, `FileSystem`, `Shell`, `ShellExecOptions`, `AgentHarnessTool`, `AgentHarnessResources` |
| `harness/prompt-templates.ts`, `harness/messages.ts`, `harness/result.ts` | supporting contracts |
| `search/index.ts`, `proxy.ts`, `stream-fn.ts` | search, proxy, `setDefaultStreamFn` |

**This corrects the earlier framing.** The choice is not "Pi harness vs pi-agent-core
runtime". `pi-agent-core` contains BOTH:

- a **thin** option: `Agent` + `AgentOptions` (or the raw `runAgentLoop`), where the
  framework supplies `streamFn`, tools, transcript, and context policy; and
- a **fat** option: `AgentHarness`, which brings Pi's opinions about sessions, skills,
  tools, system prompt, compaction, and telemetry along with it.

Adopting `AgentHarness` is much closer to "keep the Pi harness" than to "own a thin loop".
The sharp question for the design is therefore: **thin `Agent` or fat `AgentHarness`?**

## 5. Two incidental but relevant capabilities

- `AgentToolResult.addedToolNames` - "Names of tools introduced by this result and
  available from this transcript point onward." Tool sets can grow mid-transcript, which
  is the mechanism progressive tool disclosure needs.
- `harness/compaction/utils` truncates tool results to `TOOL_RESULT_MAX_CHARS = 2000`
  **only when serializing for a summary prompt**. It is not a general tool-result
  admission bound, which is consistent with the 2.8 MB admission incident recorded in
  `09-06-dove-workspace-modes-context-isolation`.

## Caveats / Not Found

- Read from `.d.ts` files, not from prose documentation. Signatures and doc comments are
  authoritative; runtime behavior was not executed here beyond the earlier probe
  (`08-27-dove-interop-layer/research/probe-pi-agent-core.mjs`), which already recorded
  tool execution going 1 -> 0 with the gate on.
- The local version is 0.84.3. npm publishes 0.87.1, so the published surface may differ.
  A direct dependency would need a version pin and a re-read of these definitions.
- `AgentHarness` internals were not read in depth; only its export presence is recorded.
