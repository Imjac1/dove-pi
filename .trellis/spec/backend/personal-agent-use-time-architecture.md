# Personal Agent Use-Time Architecture

**This page answers one question**: while a person actually uses this harness, **who is called when**. It is the entry point from the user's seat - how the source is layered belongs to [`directory-structure.md`](./directory-structure.md), the ownership contracts to [`personal-agent-framework-core.md`](./personal-agent-framework-core.md), and how one turn runs to [`../guides/harness-loop-turn.md`](../guides/harness-loop-turn.md).

**Discipline**: every claim below describes **behaviour that exists today** and carries a `file:line` anchor. 鎼? states where the square axi changes stands, by part: what is implemented and measured, and what is not there yet - this page does not claim a capability that is not there.

## 1. Who owns the loop

| Role | Who | Evidence |
|---|---|---|
| **Owner of the loop** | **the Pi host**: it runs "call the model, run the tools, repeat", and owns the session, the TUI and the provider channel | the extension attaches handlers and nothing else: **18 `pi.on(...)` calls, no loop body** (`src/pi-adapter/extension.ts:2275`-`:3672`) |
| **Contract** of the loop | `src/core/loop.ts`: the contract's `interface` / `type` declarations - `GateInvocation`, `GateDecision`, `ActionGate`, `AgentLoop` - and **two functions**: `normalizeGateDecision`, the guard every loop applies, and `gateLabelOf`, which reads the refusal class a decision carries | `src/core/loop.ts:81`, `:117`, `:135`, `:175`, `:190`, `:284` |
| **Reference implementation** (reachable, and not the loop the Pi host runs) | `src/core/loop-runner.ts` | reached by `src/commands/axi-turn.ts`, which `src/cli.ts` dispatches; the allow-list entry was removed when that wiring landed |

**Why this comes first**: the whole safety story of a self-improving harness rests on the sentence "every action passes the gate". **Today that sentence is kept by the host calling our hook** (鎼?), not by a dispatch path we own.

## 2. The eighteen mount points

Five groups: assembly, request boundaries, the tool boundary, evidence, session boundaries.

| Event | Line | What it does at that moment |
|---|---|---|
| `session_start` | `:2312` | **assemble a session**: arm the keepalive timer (`SessionKeepaliveTimer`, `:29`), open the ledger (`:916`, `new ExecutionLedger(join(stateDir, "execution.jsonl"))`), resolve the mode and the authority document (`loadWorkModeFromDirectory`, `preflightAuthority`, `:67`-`:68`), and **compose the action policy** with `createActionPolicy` (`:2360`; cleared at the session boundary, `:2357`) |
| `input` | `:2275` | the user's text enters the request lifecycle first (`requestLifecycle.acceptSubmission`), which decides whether it is accepted |
| `before_agent_start` | `:3401` | open a request lease (`requestLifecycle.beginRequest`) and fix this round's request plan |
| `agent_start` | `:2514` | start one **attempt** (`startAttempt`) with its trigger: initial, retry, or retry after compaction |
| `turn_start` | `:2801` | open a tool batch (`progressGuard.beginToolBatch()`) |
| `tool_call` | `:2805` | **the gate** - see 鎼? |
| `tool_result` | `:3108` | record that the effect actually happened (`pendingEffects` into the effect boundary) |
| `message_end` | `:3193` | assistant messages only: stop reason and usage |
| `before_provider_headers` | `:3278` | session affinity (`DOVE_PI_DISABLE_SESSION_AFFINITY=1` turns it off) |
| `before_provider_request` | `:3290` | keepalive observation (every provider call counts), provider budgeting against the model window (`model-gateway`), and the request plan when one is due |
| `after_provider_response` | `:3392` | record the HTTP status; at 400 and above classify the failure (`classifyProviderFailure`) |
| `thinking_level_select` | `:3259` | **only when the policy is `off`** (fully manual) is the user's choice written back to the default baseline |
| `context` | `:3672` | transform context before every provider request: drop stale guidance and legacy entries, keep real snapshots and their order |
| `session_before_compact` | `:2735` | **the one replay still refused**: compaction replaces the surrounding context with a summary, so the model's record that the tool already ran is weaker |
| `session_compact` | `:2749` | if the compaction will retry, mark the trigger `compaction-retry` |
| `agent_end` | `:2533` | close the progress guard (`progressGuard.end()`), project cancellation into the request state, take the last assistant message |
| `agent_settled` | `:2700` | **state snapshot only, never the callback's ctx** - `agent_end` may abort and reload the session, and reading ctx there raises Pi's "stale ctx" and masks the real terminal record |
| `session_shutdown` | `:2753` | disarm the keepalive timer (a **caller obligation**: a timer that outlives its session reports into the next one, which is worse than a cold cache) |

## 3. Where the gate is enforced (today)

**Site**: inside the `pi.on("tool_call")` handler, `src/pi-adapter/extension.ts:2805`.

1. **The mode check comes first, ahead of the lease check** - a mode that failed to load must stop the action even when the request bookkeeping is not set up (`:2810`-`:2812`).
2. **The name-only half runs first**: `resolveActionIdentity(event.toolName, event.input)` then `activeActionPolicy.denyDecision(identity.action)` (`:2816`-`:2817`). It reads the name on purpose: the permission list is name-based, so this decision **cannot be invalidated by an argument mutation later in the handler**.
3. On `block` it records the refusal - `ledger.appendGateRefused({ taskId, stepId: "gate:<toolCallId>", mode, tool, action, ... })` - and then **`return { block: true, reason: "[Dove mode ...] ...\nDo this instead: ..." }`** (from `:2836`). The call is really blocked, and the refusal **carries a deterministic remedy**.
4. **The half that reads arguments runs after the input is final** (`:2840`).

**The honest boundary**: this path is the **host** calling us at each tool call. "Every action passes the gate" is kept by the host's calling behaviour; the contract at `src/core/loop.ts:183` (that `ActionGate.evaluate` is invoked for **every** proposed action, including ones that will be blocked) is held up today by **tests and the host** together.

## 4. Process boundaries

| Who | Where | Evidence |
|---|---|---|
| the Pi host and the extension | **the main process** | the extension is a registration inside the host |
| tools (shell, PowerShell, files) | **child processes**, started by the host | the host boundary is exactly the `tool_call` / `tool_result` pair of events |
| subagents | **real child processes** (`spawn`) | `src/pi-adapter/subagent-provider.ts:1` (`import { spawn } from "node:child_process"`), `resolvePiChildCommand` (`:58`, defined at `:37`) |
| workspace changes | **a transaction in the main process**: snapshot, patch, restore | `src/windows-runtime/workspace.ts` (`createWorkspaceSnapshot`, `applyWorkspacePatch`, `restoreWorkspaceSnapshot`, `verifyWorkspaceSnapshot`) |
| cross-process mutation mutex | the project mutation lock, `withProjectMutationLock` | `src/project-provider/lock.ts` (50 lines over node built-ins). **Note**: this is the repository's only **upward** import (see `directory-structure.md`, "Layering and the allowed direction") |

## 5. The trust ladder

| Party | Trusted? | Why |
|---|---|---|
| the external model | **no** | prompt injection; a fabricated tool call is a measured failure mode |
| the agent's turn script and tool arguments | **no** | name-level evasion was measured at 98% of attempts / 88% succeeding - and it is a side effect of trying to finish the task |
| **enforcement at the tool layer** (today) | **half** | the policy source is inside the session (the mode is session-level, so the agent cannot rewrite it) but **the enforcement site is a host hook** (鎼?) |
| the person | **authority** | supplies the mode, the authority document, and the approval on privilege-boundary changes |
| **Plane B** (axi) | **authority, and it must sit where the agent cannot reach** | **the mechanism is measured, and a runtime path now composes it**: `src/commands/axi-turn.ts` establishes the invariants, verifies the token and starts the child under it before a turn runs, when a caller supplies a boundary - so as an authority in a running session it is there for the turn that asks for it - `src/jailer/acl.ts:85`, `tests/jailer.test.ts:50`; 鎼? |

## 6. Where the evidence lands

| What is recorded | Where | Anchor |
|---|---|---|
| the execution ledger (append-only) | `<stateDir>/execution.jsonl` | `src/pi-adapter/extension.ts:916`; the state directory resolves through `resolveDoveStateDir` (`:42`) |
| effects / exactly-once | the effect store and its unresolved claims | `src/pi-adapter/extension.ts:66` (`createFileEffectStore`, `listUnresolvedClaims`) |
| session-level context snapshots | the latest snapshot, restorable | `src/pi-adapter/extension.ts:44` (`restoreLatestContextSnapshot`) |
| a formal task's convergence record | `<projectRoot>/.dove/tasks/<id>/convergence.json` | `src/project-provider/native-artifacts.ts:58` |
| who reads all of it | `scripts/harness-*.mts` and their tests | how one turn runs: `../guides/harness-loop-turn.md` |

## 7. The two blanks, and the one square axi changes

1. **This repository has no `.dove/`** - so **no formal task has ever completed a recorded round here**. The line "the record reports, the person decides" is therefore **untested in place**, not proven; `.trellis/spec/guides/harness-loop-turn.md:11` states the same precondition.
2. **The DSH-side tool-layer policy is session-scoped** (the policy source is inside the session) - **half** trusted, not an authority.

**The square axi changes, in the two states its two parts are actually in.**

**Plane B: the boundary mechanism is measured, and a runtime path composes it.** `src/jailer/` (with its mechanism half in `src/windows-runtime`, `jailer-host.ps1`) sets the ACL, launches the child under a restricted token, and reads both back rather than assuming them: `ensureBoundary` (`src/jailer/acl.ts:85`) sets and then re-reads, `invariantViolations` (`src/jailer/acl.ts:56`) decides, `probeToken` (`src/jailer/token.ts:46`) verifies the restricting SID list instead of trusting `CreateRestrictedToken`'s return, and `launchJailed` (`src/jailer/launch.ts:32`) is the only way to start a child - so the improver is started by the jailer and never by itself. The cases in `tests/jailer.test.ts:50` are the readings. **The invariants, stated:**

1. **A held-out path carries no grant for the work SID** - `Everyone` (`S-1-1-0`, `src/jailer/types.ts:23`), which is the tier a restricted token leaves usable here (`.trellis/tasks/09-30-axi-a0-base/readings.md`). **And the invariant is about the tree the entry names, not the entry alone**: an explicit ACE on a child survives the root's `/inheritance:r` - measured, a child carrying `Everyone:(OI)(CI)M` was reachable by the constrained process while the boundary reported no violation - so the grant is removed tree-wide (`icacls /remove:g ... /T`).
2. **A writable path carries an explicit grant for that SID.** Without it the constrained process cannot do anything at all, and that failure looks exactly like a working boundary unless it is checked separately - which is why it is the second invariant rather than a remark.
3. **A constrained process cannot lift the restriction.** The `icacls` grant it runs is refused *and* the ACL read back afterwards is the one it was (criterion 2), and the positive control keeps "it blocked" apart from "the probe was blind".
4. **Strength, as measured rather than as hoped**: the `Everyone` tier - **not an OS sandbox**. What is still open is named rather than implied: the read covers the declared paths, not their contents, so a child that gains an explicit grant *after* the boundary is set is not seen; and **the runtime reaches `src/jailer/` now** - `src/commands/axi-turn.ts` establishes the boundary and starts the child through the helper when a caller supplies one, which is why the six allow-list entries under `tests/harness-reachability.test.ts` are gone. What remains unowned is the other half of the host: a round that *writes* under this boundary.

**Owning the loop** - the gate on a dispatch path we own rather than on a host hook - is **not implemented**: 鎼? and 鎼? describe who owns the loop and where enforcement happens today.

## How to check this page

- Every runtime claim carries a `file:line` anchor; in 鎼? the line is the `pi.on(...)` declaration.
- Two existing checks hold the structure around it: [`spec-context-budget`](../../../tests/spec-context-budget.test.ts) (route existence, budgets, routing-only router) and [`document-drift`](../../../tests/document-drift.test.ts) (the index lists every specification in its directory, and every path named here exists).
- This page describes the present. **When a square moves from "not implemented" to implemented, change this page rather than adding a footnote.**
