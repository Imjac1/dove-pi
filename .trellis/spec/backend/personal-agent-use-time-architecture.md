# Personal Agent Use-Time Architecture

**This page answers one question**: while a person actually uses this harness, **who is called when**. It is the entry point from the user's seat - how the source is layered belongs to [`directory-structure.md`](./directory-structure.md), the ownership contracts to [`personal-agent-framework-core.md`](./personal-agent-framework-core.md), and how one turn runs to [`../guides/harness-loop-turn.md`](../guides/harness-loop-turn.md).

**Discipline**: every claim below describes **behaviour that exists today** and carries a `file:line` anchor. The square axi will change is marked **not implemented** in §7 - this page does not claim a capability that is not there.

## 1. Who owns the loop

| Role | Who | Evidence |
|---|---|---|
| **Owner of the loop** | **the Pi host**: it runs "call the model, run the tools, repeat", and owns the session, the TUI and the provider channel | the extension attaches handlers and nothing else: **18 `pi.on(...)` calls, no loop body** (`src/pi-adapter/extension.ts:2111`-`:3388`) |
| **Contract** of the loop | `src/core/loop.ts` (263 lines, **all `interface` / `type`**: `ActionGate`, `GateInvocation`, `GateDecision`, `AgentLoop`) | `src/core/loop.ts:167`, `:173`, `:261`, `:262` |
| **Reference implementation** (nothing reaches it today) | `src/core/loop-runner.ts` | registered in `tests/harness-reachability.test.ts` with the reason *"nothing reaches this module"* |

**Why this comes first**: the whole safety story of a self-improving harness rests on the sentence "every action passes the gate". **Today that sentence is kept by the host calling our hook** (§3), not by a dispatch path we own.

## 2. The eighteen mount points

Five groups: assembly, request boundaries, the tool boundary, evidence, session boundaries.

| Event | Line | What it does at that moment |
|---|---|---|
| `session_start` | `:2148` | **assemble a session**: arm the keepalive timer (`SessionKeepaliveTimer`, `:29`), open the ledger (`:898`, `new ExecutionLedger(join(stateDir, "execution.jsonl"))`), resolve the mode and the authority document (`loadWorkModeFromDirectory`, `preflightAuthority`, `:66`-`:67`), and **compose the action policy** with `createActionPolicy` (`:2265`; cleared at the session boundary, `:2262`) |
| `input` | `:2111` | the user's text enters the request lifecycle first (`requestLifecycle.acceptSubmission`), which decides whether it is accepted |
| `before_agent_start` | `:3151` | open a request lease (`requestLifecycle.beginRequest`) and fix this round's request plan |
| `agent_start` | `:2325` | start one **attempt** (`startAttempt`) with its trigger: initial, retry, or retry after compaction |
| `turn_start` | `:2612` | open a tool batch (`progressGuard.beginToolBatch()`) |
| `tool_call` | `:2616` | **the gate** - see §3 |
| `tool_result` | `:2864` | record that the effect actually happened (`pendingEffects` into the effect boundary) |
| `message_end` | `:2949` | assistant messages only: stop reason and usage |
| `before_provider_headers` | `:3028` | session affinity (`DOVE_PI_DISABLE_SESSION_AFFINITY=1` turns it off) |
| `before_provider_request` | `:3040` | keepalive observation (every provider call counts), provider budgeting against the model window (`model-gateway`), and the request plan when one is due |
| `after_provider_response` | `:3142` | record the HTTP status; at 400 and above classify the failure (`classifyProviderFailure`) |
| `thinking_level_select` | `:3009` | **only when the policy is `off`** (fully manual) is the user's choice written back to the default baseline |
| `context` | `:3388` | transform context before every provider request: drop stale guidance and legacy entries, keep real snapshots and their order |
| `session_before_compact` | `:2546` | **the one replay still refused**: compaction replaces the surrounding context with a summary, so the model's record that the tool already ran is weaker |
| `session_compact` | `:2560` | if the compaction will retry, mark the trigger `compaction-retry` |
| `agent_end` | `:2344` | close the progress guard (`progressGuard.end()`), project cancellation into the request state, take the last assistant message |
| `agent_settled` | `:2511` | **state snapshot only, never the callback's ctx** - `agent_end` may abort and reload the session, and reading ctx there raises Pi's "stale ctx" and masks the real terminal record |
| `session_shutdown` | `:2564` | disarm the keepalive timer (a **caller obligation**: a timer that outlives its session reports into the next one, which is worse than a cold cache) |

## 3. Where the gate is enforced (today)

**Site**: inside the `pi.on("tool_call")` handler, `src/pi-adapter/extension.ts:2616`.

1. **The mode check comes first, ahead of the lease check** - a mode that failed to load must stop the action even when the request bookkeeping is not set up (`:2617`-`:2620`).
2. **The name-only half runs first**: `resolveActionIdentity(event.toolName, event.input)` then `activeActionPolicy.denyDecision(identity.action)` (`:2624`-`:2628`). It reads the name on purpose: the permission list is name-based, so this decision **cannot be invalidated by an argument mutation later in the handler**.
3. On `block` it records the refusal - `ledger.appendGateRefused({ taskId, stepId: "gate:<toolCallId>", mode, tool, action, ... })` - and then **`return { block: true, reason: "[Dove mode ...] ...\nDo this instead: ..." }`** (from `:2632`). The call is really blocked, and the refusal **carries a deterministic remedy**.
4. **The half that reads arguments runs after the input is final** (`:2626`-`:2628`).

**The honest boundary**: this path is the **host** calling us at each tool call. "Every action passes the gate" is kept by the host's calling behaviour; the contract at `src/core/loop.ts:160` (that `ActionGate.evaluate` is invoked for **every** proposed action, including ones that will be blocked) is held up today by **tests and the host** together.

## 4. Process boundaries

| Who | Where | Evidence |
|---|---|---|
| the Pi host and the extension | **the main process** | the extension is a registration inside the host |
| tools (shell, PowerShell, files) | **child processes**, started by the host | the host boundary is exactly the `tool_call` / `tool_result` pair of events |
| subagents | **real child processes** (`spawn`) | `src/pi-adapter/subagent-provider.ts:1` (`import { spawn } from "node:child_process"`), `resolvePiChildCommand` (`:60`) |
| workspace changes | **a transaction in the main process**: snapshot, patch, restore | `src/windows-runtime/workspace.ts` (`createWorkspaceSnapshot`, `applyWorkspacePatch`, `restoreWorkspaceSnapshot`, `verifyWorkspaceSnapshot`) |
| cross-process mutation mutex | the project mutation lock, `withProjectMutationLock` | `src/project-provider/lock.ts` (50 lines over node built-ins). **Note**: this is the repository's only **upward** import (see `directory-structure.md`, "Layering and the allowed direction") |

## 5. The trust ladder

| Party | Trusted? | Why |
|---|---|---|
| the external model | **no** | prompt injection; a fabricated tool call is a measured failure mode |
| the agent's turn script and tool arguments | **no** | name-level evasion was measured at 98% of attempts / 88% succeeding - and it is a side effect of trying to finish the task |
| **enforcement at the tool layer** (today) | **half** | the policy source is inside the session (the mode is session-level, so the agent cannot rewrite it) but **the enforcement site is a host hook** (§3) |
| the person | **authority** | supplies the mode, the authority document, and the approval on privilege-boundary changes |
| **Plane B** (axi) | **authority, and it must sit where the agent cannot reach** | **not implemented** - see §7 |

## 6. Where the evidence lands

| What is recorded | Where | Anchor |
|---|---|---|
| the execution ledger (append-only) | `<stateDir>/execution.jsonl` | `src/pi-adapter/extension.ts:898`; the state directory resolves through `resolveDoveStateDir` (`:42`) |
| effects / exactly-once | the effect store and its unresolved claims | `extension.ts:65` (`createFileEffectStore`, `listUnresolvedClaims`) |
| session-level context snapshots | the latest snapshot, restorable | `extension.ts:44` (`restoreLatestContextSnapshot`) |
| a formal task's convergence record | `<projectRoot>/.dove/tasks/<id>/convergence.json` | `src/project-provider/native-artifacts.ts:46` |
| who reads all of it | `scripts/harness-*.mts` and their tests | how one turn runs: `../guides/harness-loop-turn.md` |

## 7. The two blanks, and the one square axi changes

1. **This repository has no `.dove/`** - so **no formal task has ever completed a recorded round here**. The line "the record reports, the person decides" is therefore **untested in place**, not proven; `../guides/harness-loop-turn.md:11` states the same precondition.
2. **The DSH-side tool-layer policy is session-scoped** (the policy source is inside the session) - **half** trusted, not an authority.

**The square axi changes (not implemented; the plan for it is the axi program)**: let the **loop be owned** rather than hosted (the gate sits on the dispatch path instead of on a host hook), and make **Plane B** an authority the agent cannot reach - enforced with ACLs and a restricted token, where **the constrained child is started by the jailer and never by the improver itself**. None of that exists today, so this page does not claim it.

## How to check this page

- Every runtime claim carries a `file:line` anchor; in §2 the line is the `pi.on(...)` declaration.
- Two existing checks hold the structure around it: [`spec-context-budget`](../../../tests/spec-context-budget.test.ts) (route existence, budgets, routing-only router) and [`document-drift`](../../../tests/document-drift.test.ts) (the index lists every specification in its directory, and every path named here exists).
- This page describes the present. **When a square moves from "not implemented" to implemented, change this page rather than adding a footnote.**
