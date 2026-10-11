# Personal Agent Usage Process

## 1. What this page is, and what it is not

**This page is the design of the whole usage process**: every stage a person walks through, from installing Dove Pi
to maintaining it. **It is a design, not a record.** What the product does today is recorded, step by step with its
marks, in [`personal-agent-product.md`](./personal-agent-product.md) §3; this page does not tell that story a second
time. It says, for each stage, **what the person does, what the product decides for them, the specific failure the
stage prevents, and where the stage stands** — a reading, or a gap with an owner.

**The rule this page is judged by.** No practitioner source measures harness-level variables in a controlled way, so
"the harness makes agents better" is unevidenced and this page may not say it
(`.trellis/tasks/archive/2026-09/09-26-dove-agent-harness-capabilities/research/community-wave-what-it-changes.md`).
**Every stage must name the specific failure it prevents.** A stage whose failure column cannot be written does not
get written around: it is stated as a gap, which is what Stage 5 partially is.

**Marks** (the same three as the product page): **[demonstrated]** a reading or a test points at it;
**[not yet demonstrated]** a reading exists that shows it has not been shown; **[unverified]** no instrument exists.

**Two things this page cannot check mechanically**, and says so rather than implying otherwise: whether a "failure
this prevents" row names a real failure (it is prose, and the only check is a reader tracing its anchor), and whether
the stages still stand as written. The doors below hold this page's shape and its paths, not its truth.

## 2. The four surfaces a design may use

The loop and the tools belong to Pi: the extension registers handlers and owns no loop body
([`personal-agent-use-time-architecture.md`](./personal-agent-use-time-architecture.md) §1). So a usage step can
only be designed through four surfaces. Anything outside them is not designable here, and this page says so instead
of designing around it.

| Surface | What a design may do with it | Owner |
|---|---|---|
| **What Dove loads** | context compilation, goal continuation, project memory; `/dove-mode auto\|chat\|work` decides how much project context a request carries | Dove |
| **What Dove refuses or asks** | the declared work mode's `permissions.yaml`, enforced at the `tool_call` boundary: `never_allow`, `ask_before`, and the stance for actions the mode does not list | Dove |
| **What Dove reports** | the terminal object (`origin`, `code`, retryability, next step), `/status full`, `doctor`, `diagnostics/status` | Dove |
| **What Dove writes** | `.dove/state.json`, `.dove/tasks/<id>/`, the execution ledger | Dove |
| **Not designable: the loop and the tools** | 18 `pi.on(...)` mount points and no loop body; Dove observes and refuses, it does not dispatch | **Pi** |
| **Not designable: host-side behaviour** | whether the host offers the harness's edit tools, and how it handles a slash command passed with `-p` before the extension sees it | **the host** |

**The filesystem is the API on both sides.** The artifacts these four surfaces write are also what the harness's own
improvement round reads and edits, which is the product's second thread - the operator's seat, in
[`personal-agent-improvement-run.md`](./personal-agent-improvement-run.md).

## 3. Stage 0 - Getting it installed

| | |
|---|---|
| **What the person does** | Installs from source (`python .\dove_pi.py install`) or runs the Release one-liner; reopens the terminal; checks `dove-pi --version` and `dove-pi doctor` - `README.md:30-47`, `README.md:55-93` |
| **What the product decides for them** | Where it lives (`%LOCALAPPDATA%\DovePi`), which Pi version ships inside it, which PATH entry is written, which extension profile is installed (`max` by default), and whether a Nerd Font is installed - falling back to ASCII icons if it is not - `README.md:36-40`, `README.md:424-426`, `dove_pi.py:64`, `dove_pi.py:346` |
| **The failure this prevents** | "It is installed and I cannot tell whether it works": `doctor` prints a human-readable summary, names the effective shell and its source, says when the install is not managed, and names the tools that are missing; and "a failed update destroys a working environment": the update prints the old and new Pi version and keeps the previous version when it fails - commit `364c66e`, `README.md:294-297` |
| **Where it stands** | [demonstrated] for the summary and for version reporting. The three first-contact complaints it answers (a raw JSON wall, `installed: false` left unexplained, missing tools unnamed) were closed in one change - `.trellis/tasks/10-03-first-contact-scenario/findings.md` round 5 |

## 4. Stage 1 - The first time in a project

| | |
|---|---|
| **What the person does** | `cd` into their own project and run `dove-pi`; on first use, `/login` to choose a provider and `/model` to choose a model - `README.md:99-104`, `README.md:106-113` |
| **What the product decides for them** | The launch directory *is* the project, and the user's code never moves into the install directory; credentials, models, sessions and settings stay in the Pi user directory rather than in the project - `README.md:104`, `README.md:112-113` |
| **The failure this prevents** | Credentials and model settings landing in a repository where they can be committed; and a first request that fails deep inside the provider layer because nothing was configured |
| **Where it stands** | [demonstrated] for where the state and the credentials land. **[unverified]** what the very first message does when no provider has been configured: no reading exists for that path, and this design does not claim it is handled - gap owned by **a task that does not exist yet** (§10) |

## 5. Stage 2 - The first real work

| | |
|---|---|
| **What the person does** | Describes the need in the words of the task - `README.md:136-146` |
| **What the product decides for them** | That ordinary and small work runs without ceremony, while a planning, architecture, cross-module or multi-file request creates a formal task in the background; and how much context and budget the request gets, which `/mode` and `/dove-mode` can override but do not have to - `README.md:199-204`, `README.md:148-176`, `README.md:322-326` |
| **The failure this prevents** | Two opposite ones: ceremony imposed on small work, which is how a person stops using the thing; and large work treated as small work, which leaves no frozen acceptance and therefore nobody who can say when it is done |
| **Where it stands** | **[demonstrated] that the loop runs in one go**: one run walked every step on a bound project - the acceptance record frozen, the criterion started, the library edited, the project's own suite read `116 passed` against a baseline of `1 failed, 115 passed` with the judging test byte-identical, the formal task archived, and all four scenario steps settled - `.trellis/tasks/archive/2026-10/10-05-whole-flow-end-to-end/readings.md`. **The reading carries its own limit and it is not a footnote**: that run set the operator's `DOVE_PI_MAX_REQUEST_ATTEMPTS` to ten and used four attempts where the default allows three, so it shows the flow completes rather than that it completes under the shipped budget - [`personal-agent-field-run.md`](./personal-agent-field-run.md). **And the next run discharged that limit**: with the variable unset, so the default of three applied, the same flow reached the same end and used all three attempts the default allows - same file, the eighteenth reading. The `hashlineEditTools=absent` this row used to report was the field runner's **carried copy** missing the agent directory's package store, not the host: the same file's fourth and thirteenth readings measure both, and the runs that finished the work called `replace` and `insert` with the status line reading `present` |

## 6. Stage 3 - When it refuses or asks

| | |
|---|---|
| **What the person does** | Hits a refusal, or is asked once before an action the mode lists in `ask_before` - `README.md:515-518` |
| **What the product decides for them** | That the declared work mode is the only source of tool permission: `never_allow` is refused, `ask_before` runs only on consent, `always_allow` needs no asking, and **an action the mode does not list is not the mode's business**; a host with no dialog refuses rather than runs unasked - `README.md:249`, `README.md:240-249` |
| **The failure this prevents** | A refusal the person cannot act on, which is the same as no refusal because the next attempt is a guess; a silent allow, which turns a safety declaration into decoration; and a refusal that abandons the task instead of carrying a deterministic remedy |
| **Where it stands** | [demonstrated] that the reason now reaches a terminal with no UI at all (commit `31f5cae`), and that the boundary cases are held by cases in `tests/host-work-mode.test.ts`. **Closed as not-a-gap, by the owner's decision of 2026-10-05**: a mode's machine tools are **not** prerequisites - nothing gates a mode on their absence, and no load-time check was wanted for them. What a mode owes instead is stated where the model reads it: run the tool the work needs and keep what it printed, and write a script the next call reuses (`modes/pentest/MODE.md`, `modes/code-development/MODE.md`, `modes/code-audit/MODE.md`, held by `tests/mode-tool-use.test.ts`). The refusal itself remains design behaviour, and the reason reaching a terminal is the reading above - `.trellis/tasks/10-03-first-contact-scenario/findings.md` P1 and P13. **Not designable here**: a slash command passed with `-p` is handled by the host before the extension sees it, and the guard written for it was withdrawn by its own probe - same file, round 5 item C |

## 7. Stage 4 - A formal task, closed

| | |
|---|---|
| **What the person does** | Freezes the acceptance criteria before implementation, reads the evidence the task produced, and decides whether to finish or archive it - `README.md:289` |
| **What the product decides for them** | That acceptance is frozen before the work rather than after it, that `task verify` checks artifacts and never claims the work passed, and that finishing the current task selects the only remaining active one instead of guessing among several - `README.md:289`, `README.md:291` |
| **The failure this prevents** | Acceptance written after the fact, so the work defines its own success; criteria rewritten mid-flight; and goal drift when several tasks are active and none of them is clearly current |
| **Where it stands** | The mechanism exists (`src/core/task-convergence.ts`, and the `agent_task_convergence` tool). **No formal task has ever completed a recorded round in this repository**, because this repository has no `.dove/` - [`personal-agent-use-time-architecture.md`](./personal-agent-use-time-architecture.md) §7 - gap owned by **a task that does not exist yet** (§10) |

## 8. Stage 5 - The second day

| | |
|---|---|
| **What the person does** | Comes back to the same project and says "继续当前项目任务" - `README.md:230-234` - or continues the session itself, which is what the reading for this stage used: `dove-pi --session <file\|id> -p "..."`, and the host's own `--continue` / `--resume` are the documented forms of the same thing - `.trellis/tasks/archive/2026-10/10-03-day-two-walk/readings.md` (third round) |
| **What the product decides for them** | **Nothing yet.** This is the stage with a design and no design: what exists is only what persisted - `.dove/state.json`, the native task artifacts, the session journal, and the execution ledger - `README.md:199-228` |
| **The failure this prevents** | Named, and not yet answered: work that was finished yesterday and never committed, so a second day can lose it or overwrite it; and a handover that has to be explained again because nothing carried it - both are the walking task's own words - `.trellis/tasks/archive/2026-10/10-03-day-two-walk/prd.md` |
| **Where it stands** | [demonstrated] that continuation carries the conversation, measured three ways on 2026-10-05: a **fresh session** and a **shared session root** both answered "不确定，我不猜" (correct, and with no trace of the earlier run), while **continuing the session** answered with the real function, the real test count and the real commit id in 15 seconds - `.trellis/tasks/archive/2026-10/10-03-day-two-walk/readings.md` (third round). **What carries it is the host's session, not the `.dove/` records** - and the repository's own blackbox flag `--reuse-session` shares the session **root** without carrying the conversation: the sentence that said otherwise was narrowed on 2026-10-05, and the flag's behaviour is recorded in [`defect-ledger.md`](./../guides/defect-ledger.md) §8 rather than owned by a task |

## 9. Stage 6 - Maintenance

| | |
|---|---|
| **What the person does** | `dove-pi update`, `repair`, `rollback`, or `uninstall --yes` - `README.md:414-422` |
| **What the product decides for them** | That Pi is a locked component of the Dove release rather than something that updates itself; that a failed update keeps the previous version; and that uninstall removes the managed directory and the exact PATH entry and nothing else - `README.md:424-427`, `README.md:478-484` |
| **The failure this prevents** | An update that leaves an environment broken enough to need a reinstall; an uninstall that takes the person's credentials and project state with it; and an optional extension that failed being reported as health instead of as `degraded` - `README.md:461-462` |
| **Where it stands** | [demonstrated] - `README.md:414-430`. The release manifest covers `modes/` as product content, because `modes/<id>/MODE.md` is what the runtime loads - `scripts/release-roots.mts:3-19` |

## 10. The gaps, and who owns each

Every gap named above, with its owner. **A gap with no owner is written as needing one**, because that is the only
way a person reading this page can tell "not designed yet" from "somebody is on it".

| Stage | Gap | Owner |
|---|---|---|
| 1 | The first message when no provider is configured has no reading | needs a task |
| 3 | A slash command passed with `-p` never reaches the extension | the host (reported upstream; not ours to fix) |
| 4 | No formal task has completed a recorded round in this repository | needs a task |
| 5 | The design for a person's second day is still the host's, not Dove's: nothing in the product states the sequence or what to do when the session is gone | needs a task |

**One gap left this table on 2026-10-11**, and it was two rows that turned out to be one cause and no gap at all. The loop
has now run in one go, and the `hashlineEditTools=absent` both rows rested on was measured as the field runner's carried
copy shipping the declaration without the agent directory's package store - not the host, which has the tools installed.
The cause, the fix and the reading that shows `present` are in `.trellis/tasks/10-05-missing-hashline-edit-tool`, whose
own remaining question - whether the missing tool family should be a reading field - is answered by the status line that
now reports `hashlineEditTools=absent/present`.

## How to check this page

- **Two doors hold its shape.** `tests/spec-context-budget.test.ts` holds the router's link table against the routed
  set, holds this page inside its 24 KiB budget, and holds its `##` inventory to the list in that test.
  `tests/document-drift.test.ts` holds every specification index equal to its directory and every path named here.
- **What the doors do not check**: whether a "failure this prevents" row names a real failure, and whether the
  stages still stand. Both are a reader's check, and the anchors are what a reader checks them against.
- **When a gap closes, this page changes twice**: the stage's "where it stands" moves from a gap to a reading, and the
  gap leaves §10. A row left in §10 after its owner closed is a stale claim, which is the defect this project keeps
  finding in its own declarations.
