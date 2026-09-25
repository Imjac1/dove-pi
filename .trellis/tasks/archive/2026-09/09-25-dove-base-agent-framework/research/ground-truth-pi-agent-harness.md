# Ground truth: `AgentHarness` - the fat option, measured

- Query: If a base framework adopts `AgentHarness` instead of the thin `Agent`,
  what does it actually get, and what does it give up?
- Scope: local package type definitions, read directly by the main session
- Date: 2026-09-25
- Source: `node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-agent-core/dist/harness/agent-harness.d.ts`
  (461 lines of declarations)

## 1. Construction surface (`AgentHarnessOptions`)

```typescript
export interface AgentHarnessOptions {
    session: Session;
    models: Models;
    model: Model<Api>;
    thinkingLevel?: ThinkingLevel;
    activeToolNames?: string[];
    tools?: HarnessTool[];
    toolContext?: object | (() => object | Promise<object>);
    systemPrompt?: string | (() => string | Promise<string>);
    resources?: Resources;                    // AgentHarnessResources<Skill, PromptTemplate>
    streamOptions?: StreamOptions;
    retry?: RetryPolicy;
    compaction?: CompactionSettings;
    steeringMode?: QueueMode;
    followUpMode?: QueueMode;
    toolExecution?: "sequential" | "parallel";
    drive?: "automatic" | "manual";
    toProviderMessages?: (messages: AgentMessage[]) => Message[] | Promise<Message[]>;
    entryProjectors?: Record<string, EntryProjector>;
    context?: TelemetryContext;
}
```

Note what is NOT here: no `beforeToolCall`. The fat path replaces the thin loop's
callback options with a **named hook registry**.

## 2. Twelve named hooks

```typescript
export type HookName =
    | "before_run" | "before_resume" | "before_run_end"
    | "transform_context"
    | "before_request" | "before_payload" | "after_response"
    | "before_tool" | "after_tool"
    | "before_compaction" | "before_navigation";
```

`hooks.on(name, handler, options?): () => void` returns an unsubscribe function.

This is a richer extension seam than the thin loop's four callbacks, and it is the
seam a domain vertical would plug into. But note the hook handler type is
`(event: unknown) => unknown` - the event payload is untyped at the registry
boundary, so a vertical cannot rely on the compiler for hook contracts.

## 3. Features that map directly onto the PRD's acceptance criteria

| PRD requirement | `AgentHarness` facility |
|---|---|
| Long-running work resumes from a checkpoint after interruption | `resume()`, `SuspendedOperation` with `reason: "crash" \| "deferred"`, `ResumeOutcome`, `NothingToResume` error, `reduceLaneState`/`validateRecordLog` lane recovery |
| Do not re-execute completed side effects | `export type HarnessTool = AgentTool & { replay?: "never" \| "safe" }` - tools declare replay safety |
| Bounded context instead of unbounded growth | `compaction?: CompactionSettings`, `compact()`, `CompactionOutcome`, `CompactionEntry`, `before_compaction` hook |
| Gate an action before it runs | `drive: "automatic" \| "manual"` + `peekAction()` / `executeAction()`, plus the `before_tool` hook |
| Host-neutral front-end | `watch()` / `watchSession()` return `WatchHandle<LaneSnapshot>` / `WatchHandle<SessionSnapshot>` - a UI is a snapshot consumer |
| Parallel sub-agents | multi-lane: `createLane()`, `lanes()`, `lane(name)`, per-lane `AgentLane` |
| Vertical = prompt/skill packaging | `resources?: Resources` where `Resources = AgentHarnessResources<Skill, PromptTemplate>`, plus `skill(name)` and `promptFromTemplate(name, args)` |

## 4. The step-wise driving mode is the most interesting part

```typescript
peekAction(): Promise<ActionInfo | undefined>;
executeAction(): Promise<ActionInfo | undefined>;
runToCompletion(): Promise<void>;
```

`ActionInfo` is a closed union of 15 action kinds, including
`{ kind: "execute_tool"; toolCallId; toolName }`, `{ kind: "stream_assistant"; ... }`,
`{ kind: "hook"; name: HookName }`, `{ kind: "sleep"; delayMs }`, and
`{ kind: "move_lane"; to: string | null }`.

With `drive: "manual"` an external governor can inspect the next planned action and
decide whether to run it. That is a stronger governance position than a
`beforeToolCall` callback, because the whole action stream is inspectable, not just
tool calls.

## 5. Session model

- `session: Session` is required at construction; `session: SessionTree` is exposed.
- Entry types include `CompactionEntry`, `BranchSummaryEntry`, `ProvisionedEntry`.
- `navigateTree(targetId, options)` moves the conversation leaf, with optional
  summarization (`NavigateOptions { summarize?, customInstructions?, label? }`).
- Three queues per lane: `steer`, `followUp`, `nextRun`.
- `RunOutcome` is `completed | aborted | failed | suspended`; `suspended` carries a
  `DeferredHandle`, so a provider-side deferral is a first-class outcome.

## 6. Error taxonomy (13 typed rejection classes)

`LaneBusy`, `MissingIdentities`, `NoActiveRun`, `NoActiveOperation`,
`NothingToResume`, `InvalidMessage`, `UnknownSkill`, `UnknownTemplate`,
`UnknownTarget`, `UnknownQueueItem`, `LaneExists`, `InvalidLane`,
`NothingToCompact`, `Closed`, plus `HarnessFault`, `HarnessClosed`,
`HarnessNotImplemented`.

Results use a `ResultValue<T, E>` tagged-result type rather than exceptions for
expected rejections.

## 7. What this means for the base-framework decision

The earlier framing in `08-27-dove-interop-layer/research/base-selection-2026-09-25.md`
- "switching base costs only 4 files" - answers the wrong question. Migration cost is
small either way. The real question is **build vs adopt**, and the adopt side is far
larger than that document assumed:

- The thin `Agent` owns a transcript and a loop. It has **no session persistence, no
  compaction, no lanes, no resume, no telemetry**. A framework on the thin path
  re-implements all of that.
- `AgentHarness` already provides sessions, crash-resume, compaction, multi-lane,
  skills/templates as resources, telemetry, replay-safety annotation, and a 12-hook
  extension seam - i.e. most of the PRD's hard acceptance criteria.

So the honest options are:

- **(a) Thin `Agent`, own everything.** Maximum control and zero inherited opinions;
  cost is re-implementing session, resume, compaction, lanes, telemetry.
- **(b) `AgentHarness`, extend via hooks.** Fastest path to a working long-running
  governed runtime; cost is inheriting Pi's session format, skill model, system prompt
  construction, and telemetry schema, and the hook payloads are untyped (`unknown`).
- **(c) Hybrid.** Own the governance layer (policy, approval, ledger, evidence, context
  admission) and let `AgentHarness` own mechanics (session, compaction, lanes, resume),
  with `drive: "manual"` + `before_tool` as the enforcement points.

Option (c) is the only one that matches both the user's stated intent ("做一个基本框架")
and the PRD's gate/resume/evidence requirements without either re-implementing a
session engine or handing over the governance layer.

## Caveats / Not Found

## VERIFIED (follow-up): `AgentHarness` is a stub in 0.84.3

Read `dist/harness/agent-harness.js` (252 lines / 7,883 bytes) in full. It is a
**type-only facade**. Every substantive method rejects:

```javascript
unavailable(operation) {
    return Promise.reject(this.closed ? new HarnessClosed() : new HarnessNotImplemented(operation));
}
```

Methods that reject with `HarnessNotImplemented`:
`prompt`, `skill`, `promptFromTemplate`, `compact`, `navigateTree`, `resume`,
`abort`, `steer`, `followUp`, `nextRun`, `cancelQueued`, `recordUsage`,
`waitForIdle`, `runWhenIdle`, `peekAction`, `executeAction`, `runToCompletion`,
`watch`, `lane`, `createLane`, `lanes`, `watchSession`.

Additionally:

- `hooks` and `events` are `UnavailableRegistry` instances, so
  `harness.hooks.on(name, handler)` **throws** `HarnessNotImplemented("hooks.on")`.
  The 12 named hooks are therefore unreachable, not merely untyped.
- `static create()` throws `HarnessNotImplemented("create.restore")` when the session
  already holds a record, so even construction from an existing session fails.
- Only trivial state accessors work: `getLeafId`, `getModel`/`setModel`,
  `getThinkingLevel`/`setThinkingLevel`, `getActiveTools`/`setActiveTools`,
  `getTools`/`setTools`, `getResources`/`setResources`,
  `getStreamOptions`/`setStreamOptions`, `getRetryPolicy`/`setRetryPolicy`,
  `getCompactionSettings`/`setCompactionSettings`,
  `getSteeringMode`/`setSteeringMode`, `getFollowUpMode`/`setFollowUpMode`, `close`.

**Consequence: options (b) "adopt AgentHarness" and (c) "hybrid on AgentHarness" are
not available in the installed version.** The 461-line declaration file describes an
intended design, not shipped behavior. Any plan that depends on `AgentHarness` must
first check whether a newer published version implements it.

### But the thin path IS fully implemented

`dist/agent.js` (16,099 bytes) contains only genuine guard-rail errors
("Agent is already processing...", "No messages to continue from",
"Cannot continue from message role: assistant"). No stubs.

`dist/agent-loop.js` (22,296 bytes) genuinely wires the callbacks:

```javascript
// line 138
const nextTurnSnapshot = await config.prepareNextTurn?.(nextTurnContext);
// line 151
if (await config.shouldStopAfterTurn?.({ ... }))
// lines 181-182
if (config.transformContext) {
    messages = await config.transformContext(messages, signal);
}
// lines 405-406
if (config.beforeToolCall) {
    const beforeResult = await config.beforeToolCall({ ... });
// lines 419-420
    if (beforeResult?.block) {
        const result = createErrorToolResult(beforeResult.reason || "Tool execution was blocked");
```

So the enforcement claim is verified at the source level: **the loop calls
`beforeToolCall`, and `{ block: true }` short-circuits into an error tool result
carrying `reason`.**

### Supporting harness libraries that are real (not stubs)

Sizes under `dist/harness/`: `reducer.js` 19,500 B, `telemetry.js` 19,165 B,
`skills.js` 13,165 B, `prompt-templates.js` 8,409 B, `messages.js` 3,411 B,
`types.js` 2,507 B, `events.js` 2,531 B, `system-prompt.js` 1,266 B,
`result.js` 1,049 B - against `agent-harness.js` at 7,883 B for a 50-method class.

`reducer.js`, `skills.js`, and `prompt-templates.js` are usable libraries even though
the class that would orchestrate them is not wired. Their contracts were not read here.

## Caveats / Not Found

- `drive: "manual"`, multi-lane, resume, and the 12 hooks are unreachable in 0.84.3
  because of the stubs above. This was verified by reading the compiled JavaScript,
  not by executing it.
- npm publishes 0.87.1. Whether the published version implements `AgentHarness` is
  **unverified** and is now the single highest-value follow-up check, because it decides
  whether the "adopt a governed runtime" path exists at all.
- `AgentHarnessResources<Skill, PromptTemplate>` and `harness/skills.ts` internals were
  not read; the skill contract is unverified.
- Local version 0.84.3; npm publishes 0.87.1.
