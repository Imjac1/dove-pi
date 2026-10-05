# Concurrent read-only subagent dispatch

## Goal

Let an orchestrating main agent run several read-only investigations at the same time instead of one blocking
child at a time, so more than one line of work can advance per turn.

## Background

### The host already parallelizes; the agreed plan assumed it did not

- **Pi runs the tool calls of one assistant message in parallel by default.** `pi-agent-core/dist/agent.js:145`
  sets `this.toolExecution = runtimeOptions.toolExecution ?? "parallel"`, and `agent-loop.js:366-373` dispatches
  that default to `executeToolCallsParallel`, a `Promise.all` over the batch (`agent-loop.js:453`, results kept
  in emission order). Pi states it as a rule for extension authors: *"Tool calls from one assistant message can
  run in parallel"* (`pi-coding-agent/docs/extensions.md:123`).
- **One `executionMode: "sequential"` tool call serializes the whole batch** (`agent-loop.js:368-370`), and Pi
  names when that is required: *"Use sequential execution when tools share mutable in-memory state"*
  (`extensions.md:142`).
- **No Dove tool declares `executionMode`.** `src` matches the string only in `strategy-snapshot.ts:75`, where
  it names Dove's own `fast|standard|ultra` axis - a different concept sharing the word.

**Consequence**: turning `agent_subagent`'s `{name, prompt}` into a `tasks: [...]` array - the plan agreed
before this inspection - **is not needed to obtain parallelism**. A main agent that issues several
`agent_subagent` calls in one assistant message already has them run concurrently.

### What is actually broken

`agent_subagent` shares mutable in-memory state across calls, the exact condition Pi names:

- `subagentLastState` (`src/pi-adapter/extension.ts:714`) is a single module-level binding, written by every
  dispatch (`:1602`, `:1609`, `:1615`, `:1617`) and read by `/subagent` (`:1243`) and `agent_doctor`
  (`:1945-1952`). Two concurrent dispatches overwrite each other, so the projection describes one run while
  several are in flight.
- **The provider layer is already safe**: `runs` is a `Map` keyed by `runId` (`src/pi-adapter/subagent-provider.ts:76`)
  and `dispatchId` embeds the unique tool call id (`extension.ts:1613`). The defect is in the adapter's
  *reporting* state, not in dispatch.
- **The projection is undocumented and untested.** `personal-agent-extension-runtime.md:61` promises only four
  `subagent` fields; `tests/pi-adapter.test.ts:395` types the projection without naming `activeRun` or
  `lastTerminal`; no suite mentions either. The archived measurement at
  `.trellis/tasks/archive/2026-09/09-28-doctor-fields/implement.md:15` recorded the field as **`activeRuns`**
  (plural), so the singular in the implementation is itself an unrecorded drift.

## Requirements

- **R1** - With N `agent_subagent` calls in flight, the state the adapter publishes must describe real runs
  rather than whichever call wrote last.
- **R2** - A reader of `agent_doctor` must be able to tell how many children are in flight. **The answer is an
  `activeRuns` array in place of the single `activeRun` slot**: one slot cannot be true when a batch runs in
  parallel, and a partial reading that does not say it is partial is worse than no reading. The name is the one
  the archived measurement already used.
- **R3** - The main agent must be able to discover that concurrent dispatch is possible; the tool description
  and `promptGuidelines` (`extension.ts:1590-1594`) currently describe one investigation and say nothing about
  batching.
- **R4** - Read-only, one-shot, and un-governed-by-work-mode stay unchanged: no write capability, no session, no
  extension loading in the child.

## Key Decisions

| # | Decision | Why |
|---|---|---|
| **D1** | Parallelism is triggered by **the host's native batch behaviour**, not by a new `tasks` array parameter | Pi already runs a batch in parallel (`agent-loop.js:411-453`); changing the tool's documented parameters would break `promptSnippet`, the README, and existing tests to obtain what the host already does |
| **D2** | The projection carries **`activeRuns` (array)** instead of `activeRun` (single) | R2; and the name is what `09-28-doctor-fields/implement.md:15` already recorded |
| **D3** | The state is made **safe**, not **sequential** | `executionMode: "sequential"` is Pi's answer for tools that cannot be made safe (`extensions.md:142`). Serializing the batch would remove the parallelism this task exists to enable |

## Acceptance Criteria

- [x] **AC-1** Two `agent_subagent` calls dispatched concurrently both complete, each returning its own answer
      and its own `runId`. (True today; kept as a regression guard.) *Settled*: both asserted in the new case.
- [x] **AC-2** While two children are in flight, `agent_doctor` reports **both** via `activeRuns`. *Settled*: the
      case reads the projection 600 ms into a batch whose children live 2.5 s, and gets two entries.
- [x] **AC-3** After a concurrent batch settles, `lastTerminal` belongs to a run that actually completed and its
      state matches that run. *Settled*: a second projection read after both dispatches resolve - `activeRuns`
      empty, `lastTerminal.state` `succeeded`, its `runId` one of the two. The case as first written asserted only
      the in-flight half, which passes for a map that is never emptied.
- [x] **AC-4** The tool description or `promptGuidelines` states that several calls in one message run
      concurrently. *Settled*: one clause in each.
- [x] **AC-5** A test drives two dispatches through the real `execute()` path concurrently and **fails against
      the unmodified implementation**; it is written and observed red before the fix lands. *Settled*: with only
      `src/pi-adapter/extension.ts` stashed, the case fails on `activeRuns` (`actual: undefined, expected: 2`).
- [x] **AC-6** `npm run typecheck` and the full suite pass, including `tests/spec-anchors.test.ts`. *Settled*:
      typecheck 0; 946 tests, 944 passing, 0 failing, 2 skipped.

## Out of Scope

- **Writable subagents.** `validateRequest` keeps refusing anything outside `read|grep|find|ls`
  (`subagent-provider.ts:66-72`).
- **Multi-turn or sessioned children.** `--no-session` stays (`subagent-provider.ts:93-97`).
- **Structured return values.** The answer stays the child's stdout. Requiring JSON needs its own decision about
  non-compliance, and mixing it in would leave both unverified.
- **A `tasks` array parameter.** Not required (Background); whether it is *better* is deferred, not rejected.
- **Durable subagent records.** Children are not written to the execution ledger today, so `lastSubagentTerminal`
  is in-memory and dies with the process. Making it durable is a larger question about what a subagent run *is*.

## Deferred

- **Concurrency ceiling.** Under D1 the batch size is whatever the model emits, and each child's output is
  already bounded (`subagent-provider.ts:7`). A ceiling becomes meaningful only if a `tasks` array later lets a
  single call fan out on its own.
