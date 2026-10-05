# Personal Agent Product Definition

**This page answers one question**: what a person installs, runs, and is promised when they use Dove Pi. **It is the
authority on the product face**: where `README.md` and this page disagree, the README is corrected, because the page is
the side the doors hold.

**The runtime contracts are elsewhere.** Who is called when, from the user's seat, is
[`personal-agent-use-time-architecture.md`](./personal-agent-use-time-architecture.md); how the source is layered is
[`directory-structure.md`](./directory-structure.md); every runtime subject is routed by
[`personal-agent-runtime.md`](./personal-agent-runtime.md).

**Every claim here carries an anchor and one of three marks.** **[demonstrated]** - a reading or a test points at it.
**[not yet demonstrated]** - a reading exists that shows it has *not* been shown. **[unverified]** - no instrument
exists. A sentence with no anchor does not belong on this page. **The truth of these sentences is not what the doors
check**: `spec-context-budget` holds the shape of the router and of this page, `document-drift` holds every path named
here, and nothing holds the prose. The anchors are what a reader checks.

## 1. The product and the person it is for

Dove Pi is a personal coding agent for Windows: a person runs `dove-pi` in their own project directory and describes
what they want, the way they would to a colleague - [demonstrated] `README.md:5-9`. It is built on
[Pi](https://github.com/badlogic/pi-mono) and keeps Pi's model and extension openness, adding goal continuity, light
project memory, loop control, diagnostics, and recoverable updates - [demonstrated] `README.md:5-7`.

| Fact | Stated at | Mark |
|---|---|---|
| The floor is Windows 10/11, PowerShell 5.1+, Python 3.10+, Node.js 22.19+, Git | `README.md:22-28` | [demonstrated] |
| The user's code never moves into the install directory: the launch directory *is* the project | `README.md:104` | [demonstrated] |
| A managed install lands under `$env:LOCALAPPDATA\DovePi`, with versions, cache, state, and logs | `README.md:466-476` | [demonstrated] |
| Credentials, models, sessions, settings, and user extensions stay in the Pi user directory | `README.md:112-113`, `README.md:478-484` | [demonstrated] |
| An install, update, rollback, or uninstall does not delete `.dove/`, an existing `.trellis/`, or uncommitted work | `README.md:478-486` | [demonstrated] |
| It is for people who want their own model, provider, and Pi extensions; long projects; and an update that can be repaired or rolled back | `README.md:11-16` | [demonstrated] |

## 2. The design direction, as rules that can fail

Five constraints decide the shape of everything below. Each is stated with the mechanism or the number that makes it
concrete, plus what a violation would look like. The promises they produce are §6; what they rule out is §9.

**D1 · One authority per concern.**
Loop and tools are **Pi's**: Dove's extension registers handlers and owns **no loop body** — 18 `pi.on(...)` calls in
five groups (assembly, request boundaries, the tool boundary, evidence, session boundaries) —
[demonstrated] [`personal-agent-use-time-architecture.md`](./personal-agent-use-time-architecture.md) §1-§2. Tool
permission is **the declared work mode's** `permissions.yaml` and nothing else: not `/mode`, not `/dove-mode`, not
`/dove-tools` — [demonstrated] `README.md:322-326`. Context, goals, loop control, diagnostics, and records are
**Dove's** — [demonstrated] `README.md:240-249`. *A violation looks like* a second loop, a second permission source,
or a strength preset that changes which tools are active.

**D2 · The boundary decides, and it decides by name first.**
The gate lives inside the host's `tool_call` handler, and the **name-only half runs before the half that reads
arguments**, so a mutation later in the same call cannot invalidate the decision; the mode check runs **ahead of the
request lease**, so a mode that cannot be read stops every tool call —
[demonstrated] [`personal-agent-use-time-architecture.md`](./personal-agent-use-time-architecture.md) §3. A refusal
carries a reason and a way out, and a host with no dialog refuses rather than runs unasked — [demonstrated]
`README.md:249` and `tests/host-work-mode.test.ts`. *A violation looks like* enforcement kept in a prompt, in a
document, or in an instruction the model may ignore.

**D3 · A declaration is a contract, and an unkeepable one refuses to load.**
Every sandbox value a mode may declare carries a stance and anything unclassified is refused
(`tests/work-mode.test.ts`); a filesystem claim this runtime cannot keep stops the mode from starting
(`tests/host-work-mode.test.ts`); a declared name must be an action that can occur (`tests/code-audit-mode.test.ts`).
**The whole permission surface of the four shipped modes, counted**: `code-development` 0 ask / 1 deny (`web.*`);
`pentest` 1 ask (`exploit.run`) / 3 deny; `trading` 1 ask (`order.submit`) / 2 deny; `code-audit` 2 ask (`write`,
`edit`) / 3 deny (`bash`, `powershell`, `network.*`); all four state `unlisted: allow` rather than defaulting it —
[demonstrated] counted in the four `permissions.yaml` under `modes/`. *A violation looks like* a declaration whose
only guardian is prose, which is the rule `AGENTS.md` states and the reason every row there names something that
fails.

**D4 · Diagnosis is a deliverable, and one snapshot serves both seats.**
`/status full`, `agent_doctor`, and `diagnostics/status` over RPC report the same fields — `strategy`, `lastPlan`,
`lastTerminal`, `lastRefusals` — and the last three outlive the request that produced them — [demonstrated]
`README.md:326`. A terminal object carries an origin, a code, a summary, retryability, and the next step —
[demonstrated] `README.md:333-348`. *A violation looks like* a failure that leaves only `Operation aborted`.

**D5 · No guessed numbers, and one number per row.**
The read-only budget is exactly one threshold per strength × intent — `fast` 4/6/12, `standard` 6/10/20, `ultra`
12/16/32, 1 for a task inventory, and none for chat — [demonstrated] `src/pi-adapter/extension.ts:3500-3521`. The
pair that used to sit beside it was carried all the way to `/status` and compared by nothing, which is why the row
holds one number — same lines, and `README.md:326`. The shell watchdog is **240 s**, names the aggregate commands it
covers, yields to an explicit `timeout`, and falls back to 240 on a malformed value — [demonstrated]
`README.md:357-366`. Context is never a per-strength total and never a fixed percentage of the window; an unknown
window prints `unknown` — [demonstrated] `README.md:328-331`. *A violation looks like* a number projected as a
ceiling that nothing compares.

## 3. The user-visible loop

The steps below are what a person does and sees. A step is `[demonstrated]` when a test or a reading fixes it; the
loop **as one run** is §7.

| # | What the person does | What they see | Mark and anchor |
|---|---|---|---|
| 1 | Installs, from source or the Release one-liner | the launcher path; then `dove-pi --version` and `dove-pi doctor` | [demonstrated] `README.md:30-47`, `README.md:55-93` |
| 2 | Opens a terminal in their own project and runs `dove-pi` | the Pi terminal UI, in that directory | [demonstrated] `README.md:99-104` |
| 3 | On first use, runs `/login` and `/model` | a provider is chosen and the credential is written outside the project | [demonstrated] `README.md:106-113` |
| 4 | Describes the need in the words of the task | the agent works in the project; small work runs without ceremony, and a planning/architecture/cross-module request creates a formal task in the background | [demonstrated] `README.md:136-146`, `README.md:199-204` |
| 5 | Chooses an execution strength, a context mode, or a workspace mode as needed | the choice is reflected in the status line and in `/status full` | [demonstrated] `README.md:148-176`, `README.md:301-316` |
| 6 | Hits a refusal, when the declared mode forbids the action | the call is blocked with a reason and a way out | [demonstrated] `README.md:249`; `tests/host-work-mode.test.ts` carries the boundary cases |
| 7 | Reads what a formal task produced | `.dove/state.json` and `.dove/tasks/<task-id>/` hold the PRD, design, implementation, and acceptance artifacts | [demonstrated] `README.md:199-228` |
| 8 | Returns the next day and says "继续当前项目任务" | **not yet read**: whether continuation works across a real day | [not yet demonstrated] `.trellis/tasks/10-03-day-two-walk/prd.md` |
| 9 | Maintains: `dove-pi update`, `repair`, `rollback`, `uninstall --yes` | the old and new Pi version; a failed update keeps the previous version | [demonstrated] `README.md:294-297`, `README.md:414-430` |
| 10 | Deletes nothing by hand: uninstall keeps user and project data | the managed directory and the exact PATH entry go; the rest stays | [demonstrated] `README.md:421-427`, `README.md:478-484` |

## 4. The surfaces a person can reach

| Surface | What is on it | Mark and anchor |
|---|---|---|
| **CLI** | 15 subcommands: `doctor`, `project`, `task`, `session`, `extensions`, `workspace`, `shell`, `capability`, `rpc`, `mcp`, `skills`, `web`, `token`, `cache`, and `axi-turn` | [demonstrated] counted in `src/cli.ts`; the user-facing subset is `README.md:206-224`, `README.md:414-422`, `README.md:492-498` |
| **Slash commands inside Pi** | 17 registered by the extension: `mode`, `dove-mode`, `dove-workspace`, `status`, `subagent`, `sysprompt`, `reasoning-voice`, `dove-thinking`, `dove-tools`, `设置`, `settings-zh`, `capabilities`, `web`, `skills`, `project`, `task`, `memory` | [demonstrated] asserted as a list in `tests/pi-adapter.test.ts` |
| **Agent tools** | 12 `agent_*` tools: `run_capability`, `list_capabilities`, `doctor`, `project_status`, `project_task`, `task_convergence`, `project_context`, `workspace_snapshot`, `workspace_verify`, `workspace_restore`, `workspace_patch`, `subagent` | [demonstrated] asserted in `tests/pi-adapter.test.ts` |
| **Protocols** | the same reviewed capabilities over MCP stdio and over JSON-RPC, with the Pi adapter as a third face of one execution path | [demonstrated] `README.md:490-513`, `README.md:577-587` |
| **Internal entries, not promised** | `axi-turn` and the `harness-*` scripts under `scripts/`. `axi-turn` is reachable from the CLI because the harness's own staged work needs it; it is not part of what a user is promised, and it is not listed in the README. | [demonstrated] `src/cli.ts`; absence from `README.md:206-224` |

## 5. The axes, and which one owns what

Four settings are easy to confuse, and they are independent - [demonstrated] `README.md:170-176`, `README.md:320-326`.

| Axis | Reached by | What it changes | What it does not own |
|---|---|---|---|
| **Execution strength** | `/mode fast`, `/mode standard`, `/mode ultra` | task strength: how much effort a request is given | tool permissions, project context, workspace mode |
| **Context mode** | `/dove-mode auto`, `chat`, `work`, `status` | how much project context and goal continuation is loaded | tool permissions, strength |
| **Workspace mode** | `/dove-workspace development`, `pentest` | the pentest posture, applied on the *next* start (the Pi-lens state) | tool permissions, strength, context |
| **Work mode** | a declaration resolved from `modes/<id>/` - the project's own root first, the extension's root as the fallback | **tool permissions**, read from `permissions.yaml`: `never_allow` is refused, `ask_before` runs only on consent, `always_allow` needs no asking, and **an action the mode does not list is not the mode's business** | nothing else; and it is the only axis that can refuse a call |

The modes that ship are directories under `modes/`: `code-audit`, `code-development`, `pentest`, `trading` -
[demonstrated] measured in `modes/`, each with `MODE.md` and `permissions.yaml` beside `governance.yaml`. They are
product content: the release digest covers them, because `modes/<id>/MODE.md` is what the runtime loads -
[demonstrated] `scripts/release-roots.mts:3-19`.

## 6. What the product promises, and what enforces it

Each row is a promise a user can rely on, and the thing that fails when it breaks.

| Promise | Stated at | Held by |
|---|---|---|
| A mode's `never_allow` is refused at the tool boundary, and an unlisted tool is left alone | `README.md:249` | `tests/host-work-mode.test.ts`: *enforces the loaded mode's never_allow against the action, and leaves an unlisted tool alone* |
| An action needing consent runs only on consent; a host with no dialog refuses it rather than running it unasked | `README.md:249`, `README.md:515-518` | `tests/host-work-mode.test.ts`: *refuses an action needing consent when the host has no dialog, instead of running it unasked* |
| Silence is never read as consent | - | `tests/action-policy.test.ts`: *answers an unlisted action with the mode's declared stance, so silence is never read as consent* |
| A declared mode that cannot be read stops every tool call, and `/status` says which mode and why | `README.md:326` | `tests/host-work-mode.test.ts`: *blocks every tool call when a declared mode cannot be read, instead of running without it*; *shows the failed mode and its reason in /status, where the operator already looks* |
| A sandbox claim this runtime cannot keep stops the mode from starting | `AGENTS.md` | `tests/host-work-mode.test.ts`: *refuses the filesystem claim this runtime cannot keep, which used to load and be ignored* |
| Every sandbox value a mode may declare has a stance, and anything unclassified is refused | `AGENTS.md` | `tests/work-mode.test.ts`: *classifies every sandbox value a mode may declare, and classifies nothing else* |
| The read-only budget is one number, and reaching it does not by itself end a request that is still learning something | `README.md:326`, `README.md:347-348` | `tests/pi-adapter.test.ts`: *warns but allows varied read-only exploration beyond the historical request budget* |
| Which host tools reach the network is one declaration, read through a derived view | `README.md:322-326` | `tests/invocation-disposition.test.ts`: *names every host tool that reaches the network, and nothing that does not* |
| A name a mode declares must be an action that can occur | `AGENTS.md` | `tests/code-audit-mode.test.ts`: *declares no gate, states its approval stance, and names only actions that can occur* |
| A mode may not describe a control the host already runs as the operator's duty | `AGENTS.md` | `tests/pentest-mode.test.ts`: *does not deny the preflight the host runs, because the host runs it* |
| A mode states requirements, not dated accounts of what the framework does not do yet | `AGENTS.md` | `tests/trading-mode.test.ts`: *states the requirement instead of an account of what the framework does not do yet* |

## 7. What the product has not yet demonstrated

These are not defects of the reading; they are the readings. Stating them is what keeps §3 and §6 from becoming
advertising.

| Not yet demonstrated | The reading that says so |
|---|---|
| **The whole loop in one run.** Steps 1-9 have never been walked end to end inside a single session: the last attempt ran only `/status`, and the attempt before it spent its 15-minute timeout at step 1 and was cancelled | `.trellis/tasks/10-05-whole-flow-end-to-end/readings.md` |
| **The host's editing tools present.** The extension's own status line reports `hashlineEditTools=absent`, so the agent that ran had no harness edit tools; the reading is about the host, not about the model being careless | `.trellis/tasks/10-05-whole-flow-end-to-end/readings.md` |
| **The second day.** Returning to the same project and continuing is written down, not read: the walking task says so itself | `.trellis/tasks/10-03-day-two-walk/prd.md` |
| **A refusal a user can read without a UI.** The first-contact walk found the gate's reason not reaching the person, and that a model's own retelling is the only explanation available in a non-interactive run | `.trellis/tasks/10-03-first-contact-scenario/findings.md` |
| **A formal task that completed a recorded round in this repository.** This repository has no `.dove/`, so "the record reports, the person decides" is untested in place rather than proven | [`personal-agent-use-time-architecture.md`](./personal-agent-use-time-architecture.md) §7 |
| **That the product is good.** No success criterion is claimed. A real-provider field run is a *measurement*, not a gate: it needs the person's own credentials, its raw output stays outside this repository, and the same command on another day is another experiment | `README.md:284-287`; [`personal-agent-field-run.md`](./personal-agent-field-run.md) |

> **These anchors point into task directories, and a task directory moves when it is archived.** A path here that no
> longer resolves is a task that moved, not a fact that changed: repoint the anchor. What an archive breaks, and why
> nobody notices, is recorded in `AGENTS.md`.

## 8. axi, as an internal program

`axi` is the name of the internal program that works on this harness's own bounded self-improvement: which parts of the
harness may be edited, what evidence a change is judged by, and where the judging authority sits. **It is an
implementation route, not a product promise.** A person using Dove Pi is promised what §6 lists, and nothing in this
section.

Its staged plan is a task artifact, and it is deliberately referred to **by name**: a path into a task directory breaks
when that task is archived, and a specification that names a broken path is the defect `document-drift` exists to catch.
What a reader needs from the program is already stated where it landed - the self-improvement contract is
[`personal-agent-harness-loop.md`](./personal-agent-harness-loop.md), the gate and authority contracts are
[`personal-agent-framework-core.md`](./personal-agent-framework-core.md) - and the two blanks it is meant to close are
named in [`personal-agent-use-time-architecture.md`](./personal-agent-use-time-architecture.md) §7.

## 9. The non-goals

**This list is not complete, and its completeness has no instrument.** Every line is anchored; an omission here is not
a claim that something is allowed. A dash under *held by* means no test was found that would fail if the product started
doing it, which is a fact about what is checked rather than a licence.

| Not done | Stated at | Held by |
|---|---|---|
| Execution strength is not a context budget: it does not fix a context total, and it does not cut a fixed percentage of the model window | `README.md:328-331` | - |
| The installer does not run an untargeted `pi update --extensions`, so a user's own Pi extensions are not upgraded on the way | `README.md:461-462` | - |
| Pi's own `bg_*` tools are not presented as subagents that Core has taken over | `README.md:195-197` | - |
| In Auto mode, `/mode`, `/dove-mode`, `/dove-thinking`, and `/dove-tools` do not change tool permissions; the work mode's `permissions.yaml` does | `README.md:322-326` | `tests/action-policy.test.ts` carries the boundary cases |
| A reviewed capability is not re-implemented per adapter: the execution path is one, exposed through Pi, MCP, and CLI/RPC | `README.md:577-587` | - |

## How to check this page

- **Two doors hold its shape.** `tests/spec-context-budget.test.ts` holds the router's link table against the routed
  set, holds this page inside its 24 KiB budget, and holds its `##` inventory to the list in that test.
  `tests/document-drift.test.ts` holds every specification index equal to its directory and every path named here.
- **What the doors do not check**: whether these sentences are still true. A specification may cite a real file for
  behaviour it no longer has, and no path check can tell. That part is a reader's.
- **When a fact changes, change this page** rather than adding a footnote - the rule
  [`personal-agent-use-time-architecture.md`](./personal-agent-use-time-architecture.md) closes with. When a
  `[not yet demonstrated]` row in §7 becomes demonstrated, it moves into §6 with the reading that did it.
