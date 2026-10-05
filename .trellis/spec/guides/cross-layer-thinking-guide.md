# Cross-Layer Thinking Guide

> **Purpose**: Think through data flow across layers before implementing.

---

## The Problem

**Most bugs happen at layer boundaries**, not within layers.

Common cross-layer bugs:

- API returns format A, frontend expects format B
- Database stores X, service transforms to Y, but loses data
- Multiple layers implement the same logic differently

---

## Before Implementing Cross-Layer Features

### Step 1: Map the Data Flow

Draw out how data moves:

```
Source → Transform → Store → Retrieve → Transform → Display
```

For each arrow, ask:

- What format is the data in?
- What could go wrong?
- Who is responsible for validation?

### Step 2: Identify Boundaries

| Boundary              | Common Issues                     |
| --------------------- | --------------------------------- |
| API ↔ Service         | Type mismatches, missing fields   |
| Service ↔ Database    | Format conversions, null handling |
| Backend ↔ Frontend    | Serialization, date formats       |
| Component ↔ Component | Props shape changes               |

### Step 3: Define Contracts

For each boundary:

- What is the exact input format?
- What is the exact output format?
- What errors can occur?

---

## Common Cross-Layer Mistakes

### Mistake 1: Implicit Format Assumptions

**Bad**: Assuming date format without checking

**Good**: Explicit format conversion at boundaries

### Mistake 2: Scattered Validation

**Bad**: Validating the same thing in multiple layers

**Good**: Validate once at the entry point

### Mistake 3: Leaky Abstractions

**Bad**: Component knows about database schema

**Good**: Each layer only knows its neighbors

### Mistake 4: Every Consumer Parses The Same Payload

**Bad**: A command reads JSONL events and casts fields inline:

```typescript
const thread = (ev as { thread?: string }).thread;
const labels = (ev as { labels?: string[] }).labels;
```

This looks local, but it means every consumer owns a private version of the
event contract. The next field change will update one command and miss another.

**Good**: Decode once at the event boundary, then export typed projections:

```typescript
if (!isThreadEvent(ev)) return false;
return ev.thread === filter.thread;
```

**Rule**: For append-only logs, JSON streams, RPC payloads, or config files,
create one owner for:

- event / payload type definitions
- type guards and normalization from `unknown`
- metadata projections used by UI commands
- reducers that replay state from the source of truth

Rendering code may format fields, but it must not redefine the payload contract.

---

## Checklist for Cross-Layer Features

Before implementation:

- [ ] Mapped the complete data flow
- [ ] Identified all layer boundaries
- [ ] Defined format at each boundary
- [ ] Decided where validation happens

After implementation:

- [ ] Tested with edge cases (null, empty, invalid)
- [ ] Verified error handling at each boundary
- [ ] Checked data survives round-trip
- [ ] Checked that consumers import shared decoders / projections instead of
      casting payload fields locally
- [ ] Checked that derived state points back to the source event identifier
      (`seq`, `id`, `version`) instead of inventing a second cursor

---

## Cross-Platform and Cross-Protocol Boundaries

### Windows Launcher and Native Package Boundaries

Windows installers have two independent encoding/process boundaries that must
be tested separately:

- A `.cmd` launcher should contain ASCII-only text and resolve a sibling
  PowerShell launcher with `%~dp0`; embedding an absolute Unicode path in the
  batch file makes success depend on the active code page.
- The PowerShell launcher should be UTF-8 with a BOM so Windows PowerShell 5.1
  and PowerShell 7 decode non-ASCII paths consistently.
- Native npm helpers must be repaired inside their managed package root only.
  Remove both the platform package and its JS wrapper before reification, then
  install the native package and wrapper in separate steps so a failed
  postinstall cannot reuse a half-created binary destination.
- Avoid Node's `shell: true` for `npm.cmd` on current Node releases. Spawn
  `cmd.exe /d /s /c npm.cmd ...` with shell mode disabled to avoid DEP0190 and
  Windows `EINVAL` failures.

Regression tests should exercise a simulated Windows branch with non-ASCII
paths and should assert that optional native-package failures remain structured
and do not prevent the rest of an extension profile from installing.

### Provider Tool-Call Protocol Boundaries

When a gateway advertises one API surface but a model emits a provider-specific
text protocol, the host can silently render tool calls as ordinary assistant
text. Before changing the execution loop, inspect the persisted assistant
message and its `stopReason`:

- If the provider response contains structured tool blocks, keep Pi's native
  path authoritative.
- If it contains a complete, recognizable text protocol (for example
  DeepSeek DSML), normalize it once at `message_end` into the host's typed
  tool-call blocks.
- Preserve all non-protocol content and leave incomplete markers untouched;
  never infer a command from a partial string.
- Let the normalized block re-enter the existing `tool_call` approval,
  allowlist, and execution handlers. A compatibility parser must not execute
  tools directly or bypass policy.

Regression tests should cover multiple calls, typed parameters, thinking/text
carriers, malformed input, and the final host event shape—not only the parser
in isolation.

---

## When to Create Flow Documentation

Create detailed flow docs when:

- Feature spans 3+ layers
- Multiple teams are involved
- Data format is complex
- Feature has caused bugs before

---

## Event Log / Projection Boundary

Append-only logs are cross-layer contracts. A single event travels through:

```
CLI input → event writer → events.jsonl → reader → filter → reducer → display
```

### Checklist: After Adding A New Event Kind Or Field

- [ ] Add the event kind to the central event taxonomy
- [ ] Add a typed event variant or type guard at the event layer
- [ ] Add normalization helpers for array/object fields that come from
      user input or JSON
- [ ] Keep `seq` / `id` assignment in the event writer only
- [ ] Make filters and reducers consume the typed event guard, not local casts
- [ ] Make display code consume reducer output or typed events, not raw JSON
- [ ] Add at least one regression that proves history replay and live filtering
      use the same filter model

**Real-world example**: Thread channels added `kind: "thread"`, `description`,
`context`, labels, and `lastSeq`. The first implementation replayed thread
state correctly, but several commands still re-parsed event payload fields with
local casts. The fix was to make the core event layer own `ThreadChannelEvent`
and `isThreadEvent`, make `reduceChannelMetadata` the only channel metadata
projection, and make `reduceThreads` the only thread replay reducer.

## Provider Prompt-Cache Boundary

Pi has two distinct extension boundaries that must not be conflated:

- `before_agent_start` runs once at the beginning of a user request and can
  append a persisted custom message for that run.
- `context` runs before every provider request, including tool-call
  continuations, and must be treated as a pure projection.

Dynamic project guidance that is rebuilt and moved by `context` changes the
message ordering after each tool result. Providers then see a different
prefix and may re-bill the entire history as a cache miss. Keep the stable
system prompt static; emit a versioned, append-only context snapshot from
`before_agent_start` only when its epoch changes (mode, project revision,
workflow hint, or active tool policy). A `context` handler may remove legacy
unversioned entries, but must never reorder or recreate the current snapshot.

Regression checks must cover a user prompt followed by assistant/tool-result
messages and assert that the context transform returns the same ordering. A
large full miss during a short tool chain is evidence of a prefix mutation,
not normal cache expiry.

## Terminal State At Third-Party Tool Boundaries

When a core state machine reaches a terminal or handoff state, its invariant
must also be enforced at the host boundary that invokes third-party tools.
Returning guidance from a prior tool result is advisory; the next
`tool_call` must re-check the typed state before the external tool runs.

Checklist:

- [ ] Identify the core state that means "do not ask again" or "handoff now"
- [ ] Enforce it in the host `tool_call` hook before third-party execution
- [ ] Test ordinary option labels, not only confirmation-shaped labels
- [ ] Run one fresh-process E2E with the real host tool catalog and count calls
