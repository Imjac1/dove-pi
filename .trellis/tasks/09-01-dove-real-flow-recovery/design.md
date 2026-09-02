# Design

## Boundary

The user-facing unit of work is a logical goal spanning one or more turns. Core
owns bounded goal continuity and request planning. The Pi adapter owns
provider-schema stability while Pi remains the sole tool authority. Diagnostics
observe both boundaries without becoming an authority source.

## 1. One-Shot Goal Continuation

Keep only one bounded pending plan. It is created when an Execution request
settles after a structured question and before any non-question tool call. The
next short affirmative reply may inherit that plan once. Any unrelated input,
real tool progress, failure, cancellation, or session replacement clears it.
Completed requests never become continuation authority.

An explicit `继续任务 <selector>` binds the request to the uniquely resolved
task. Without a selector, the active session binding wins, then the provider's
current task, then a single resumable candidate; ambiguity is reported once.
Continuation is an execution request: the projection supplies the next step
and the normal Pi tool set remains available so the model can perform that
step immediately. `查看当前任务` remains the read-only status operation.

This intentionally avoids a second large workflow state machine. Raw prompts
and model prose are not persisted as executable state; correlation uses the
source request ID and immutable request plan.

Lifecycle verbs are parsed only when they are actionable. Explanations and
negated requests such as `不要创建任务，只说明含义` must never allocate or
upgrade formal task metadata.

## 2. Stable Tools, Native Pi Authority

Auto mode does not select tools. At session start Dove records Pi's active tool
schema for diagnostics, then leaves tool activation to Pi and its extensions.
Chat/Lookup/Project Work/Execution classification cannot call
`setActiveTools`, remove a third-party tool, or add a tool based on prompt
keywords. Explicit legacy `core`/`full` profile commands remain user-owned
compatibility changes and may alter the prefix.

Request intent controls only context selection, budgets, workflow guidance, and
goal accounting. It carries no capability allow-list or approval tier. A
Pi-hosted Dove tool invocation is accepted as Pi's execution decision; Dove
retains argument validation, transaction recording, recovery, and explicit
read-only mode, but does not ask the user to approve the same action again.

## 3. Extension Conflict Handling

Treat Pi's final outgoing payload as evidence of the provider-visible tool set.
Doctor compares it with the observed session baseline and reports schema churn;
it never restores that baseline automatically. The ask-user extension remains
usable, while the progress guard limits repeated questions by logical goal.

## 4. Progress Budgets

Replace semantic confirmation similarity as the primary bound with counters per
logical goal:

- structured questions before progress: maximum 1
- repeated question after positive answer: maximum 0
- task mutation native confirmation: maximum 1, owned by workflow tool
- provider/tool budgets: intent/mode specific

Question text similarity remains diagnostic evidence only. A read/tool result is
progress for exploration budgets, but does not reset the per-goal question
budget. A new explicit goal does.

## 5. Metrics

Add a goal-level summary derived from provider and terminal ledger events:

- `firstProviderCacheRead` and `coldFirstCall`
- uncached/cache-read/output totals
- provider/tool/question counts
- provider and user-wait durations where distinguishable
- completion/blocked/cancelled outcome
- stable system/tool prefix flags

The primary efficiency measure is uncached input per completed goal. Cumulative
cache share remains secondary because repeated loops can inflate it.

## 6. Restart-Safe Context Snapshot

The v2 context message is already persisted by Pi as part of the active session
branch. The adapter must treat that message as the source of truth when a
runtime starts or a session is replaced: clear old in-memory snapshot state,
scan the active branch for the newest valid v2 message, and restore only its
bounded epoch/revision/segment metadata and content digest. If the current
project revision matches, the next request must not append a duplicate derived
message. If the revision differs, a new snapshot is an intentional context
change and must remain observable as such.

This is a cache-continuation repair, not a second permission or workflow gate.
It does not alter Pi's active tools, system policy, provider payload semantics,
or the persisted user history. The experiment and attribution rules live in
`research/cache-continuation-investigation.md`.

Short-lived request guidance is a separate case: when Pi builds the provider
context, retain only the latest guidance-only v2 message and all real snapshot
messages. This keeps current-turn continuation guidance available without
accumulating one transient guidance entry per user turn.

## Compatibility And Rollout

- Preserve existing JSONL readers by adding optional fields/events.
- Preserve explicit `core`/`full` profile behavior and existing mutation
  approval contracts.
- Rollback selects the retained previous managed release; it does not preserve
  the request-exact selector as a second live authority path.
- Release validation must use the managed launcher and assert release ID/digest,
  preventing source-only success from being reported as shipped behavior.

## Risks

- Pi's selected schema may be larger than Dove's old intent-filtered subset.
  The A/B gate therefore measures completed-goal cost and task success, not an
  abstract minimum-tool count or a lower tool count achieved by hiding model
  capabilities.
- Host hooks may change order across Pi versions. Runtime probes and final
  payload evidence diagnose those changes without making Dove another tool
  authority.

## Rollback

Retain the prior release as managed install `previous` and never migrate user
project data for this change.
