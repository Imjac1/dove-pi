<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->

<!-- Everything in this section is outside the Trellis-managed block above, which a test checks: content inside the block may be
     overwritten by a `trellis update`, and content outside it is preserved. -->

## Rules, and what enforces each one

Every rule this repository has learned the hard way, paired with the thing that fails when it is broken. **`doc` is not an
enforcer**: a rule whose only guardian is this file is a rule nobody keeps, so such a row is either given a mechanism or
deleted. The `Enforcer` column is a closed grammar - `test:<file>#<case>`, `suite:<file>`, `type:<file>#<Symbol>`,
`gate:<file>#<step>`, `verifiedBy:<component>` - and `tests/document-drift.test.ts` fails when a row names a file, a case,
a symbol or a component that does not exist, when a level is outside the set, when the level and the enforcer disagree, or
when the table is empty.

**The `Level` column is the level that actually holds the rule** (`architecture` for a door that notices, `type` for the
typechecker, `test` for a case, `gate` for a step in CI), which is why a row may be fixed by subtracting something and
still be held by a test. That distribution is a fact about this repository worth reading: most of these are held by cases,
and the two doors are the ones that catch what no case is looking for.

| Rule | Level | Enforcer | Fails how |
|---|---|---|---|
| A mode's `MODE.md` body reaches the model as one labelled block, and the prompt does not deny its own contents | test | `test:tests/host-work-mode.test.ts#carries the loaded mode's own instructions into the assembled system prompt` | the block stops being appended, or the clause saying the mode arrives only at request time returns |
| A body past the ceiling is cut, and the cut is stated inside the block | test | `test:tests/mode-body-prompt.test.ts#cuts a body past the ceiling, states the cut in the block, and reports both numbers` | a body is truncated in silence, or the reading stops matching the text sent |
| Every sandbox value a mode may declare carries a stance, and anything unclassified is refused | test | `test:tests/work-mode.test.ts#classifies every sandbox value a mode may declare, and classifies nothing else` | a value is added to an axis with no stance, which is how `filesystem: ephemeral` was ignored |
| A sandbox claim this runtime cannot keep stops the mode from starting | test | `test:tests/host-work-mode.test.ts#refuses the filesystem claim this runtime cannot keep, which used to load and be ignored` | a claim that reads as isolation is loaded and dropped again |
| The read-only budget is one number, and it is the threshold that fires | test | `test:tests/pi-adapter.test.ts#warns but allows varied read-only exploration beyond the historical request budget` | a second number is added to the budget rows and projected as a ceiling nothing compares |
| Which host tools reach the network is one declaration, read through a derived view | test | `test:tests/invocation-disposition.test.ts#names every host tool that reaches the network, and nothing that does not` | a networked tool is added to one list and not the other, so `network: none` covers whatever the reader happened to open |
| A mode file states requirements, not dated accounts of what the framework does not do yet | test | `test:tests/trading-mode.test.ts#states the requirement instead of an account of what the framework does not do yet` | our own progress is written into a body the model reads as a rule |
| A mode file may not deny a control the host already runs | test | `test:tests/pentest-mode.test.ts#does not deny the preflight the host runs, because the host runs it` | a live control is described as an operator's duty, so a reader thinks it may be skipped |
| A name a mode declares must be an action that can occur | test | `test:tests/code-audit-mode.test.ts#declares no gate, states its approval stance, and names only actions that can occur` | a permission or capability name is added that nothing produces |
| The mount-point table cites the line each registration is on | test | `test:tests/spec-anchors.test.ts#cites the declaration each mount-point row names, as that page says it does` | an edit above a registration leaves a citation pointing at the wrong line |
| Every path the surface map names resolves, and the map agrees with the record vocabulary | test | `test:tests/harness-surface.test.ts#declares every component the record vocabulary has, and nothing else` | a component or path is declared that is not real, which is how a map stops describing the tree |
| Every task-artifact check has a fixture that must trip it, and the manifest is held equal in both directions | test | `test:tests/task-artifact-lint.test.ts#holds --list-checks and the manifest equal in both directions, and names which way it broke` | a check is added that passes forever on nothing |
| The task-artifact corpus is asserted where it is stable | gate | `gate:.github/workflows/compatibility.yml#Lint task artifacts in the repository corpus` | the corpus step leaves CI, so the fixture suite is the only thing left checking |
| A record kind in the closed set has a writer | test | `test:tests/harness-reachability.test.ts#reaches every record kind from a writer, so a kind nothing produces cannot stay in the set` | a kind is declared that nothing produces, so a reader sees a mechanism where there is none |
| A module nothing reaches is declared with a reason, or deleted | architecture | `suite:tests/harness-reachability.test.ts` | an unreachable module is added without a reason, or an allow-list entry goes stale after the module is wired |
| An errand a gate implies is said only while the gate would refuse it, and never in the block that is constant for the session | test | `test:tests/pi-adapter.test.ts#says a formal task's acceptance record is unfrozen only while it is, and keeps the errand out of the stable prompt` | the errand is written into the session-constant system prompt, or the sentence stays after the acceptance record is frozen, so it reads as noise a model learns to skip |
| A provider stream that ends before its response is transient, whichever of the host's words spells it | test | `test:tests/pi-adapter.test.ts#reads the host's failed-stream token, which the aborted spelling never reached` | the classification keys on a spelling the call sites cannot deliver, which is how the first version read as a control while nothing reached it |
| A refusal names the argument that failed, and what to pass instead | test | `test:tests/pi-adapter.test.ts#names the argument when a convergence call's task selector resolves to nothing` | a parameter carries no description so its bare name invites the wrong value, and one refusal sentence covers two different causes, so the caller cannot tell which argument it got wrong |
| The read-only shell grammar admits a project's own test runner, in every language it serves | test | `test:tests/invocation-disposition.test.ts#lets a project's own test command run before the freeze, in more than one language` | the grammar admits one ecosystem's test command and refuses another's, so the gate refuses a measurement as a product mutation |
| A refusal says what kind of value an argument takes, not how the value failed | test | `test:tests/pi-adapter.test.ts#says what a criterion id is, for the argument the model filled with the task's own id` | the parameter carries no description, so a bare name invites any id the task has, and the refusal that answers it describes a length limit instead of the value's kind - so the caller shortens the wrong kind of id, one round at a time |
| A shell command the adapter does not recognise is still bounded, and the ledger says which of the two rules answered | test | `test:tests/pi-adapter.test.ts#bounds every shell command, tightly for aggregate verification and at a ceiling for the rest` | a command outside the aggregate rule has no timeout at all, so one whole-filesystem `find` outlives the run it was part of and the record says `timeoutApplied: false` while the run is lost |
| A host event whose shape changed under the adapter is read structurally, so the pinned host and the latest channel both work | test | `test:tests/pi-adapter.test.ts#reads the prompt from either shape the host gives it, including the one that carries no prompt field` | the handler reads a field only one variant of the host's union carries, so the latest channel fails to typecheck and a custom-shaped event throws before any of Dove's own work starts |
| A reading is reported where something measured it; a channel with no recorder is absent rather than empty | test | `test:tests/real-dove-blackbox.test.ts#preserves provider preflight evidence without exposing the prompt` | the summary reports `[]` for a channel nothing writes on that path - which reads as *we looked and found nothing* - and a size a ternary produced is reported beside real numbers, so a constant reads as a measurement |
| A message names the cause its own code can check, not the one that reads well | test | `test:tests/pi-adapter.test.ts#names the declaration that has nothing behind it, instead of blaming the host` | a warning attributes a missing tool family to the host, which the code never checked - measured false, since the host provides them and the declaration had arrived without its package store - so the reader is sent to fix something that is not broken |
| A sentence about what a mode permits is answered by the matcher the runtime uses, not by the names the sentence looks for | test | `test:tests/work-mode.test.ts#answers the two ways this runtime refuses a shell, not the two names it used to look for` | the expression reads `never_allow` for two exact names, so a wildcard deny or a fence that refuses the shell both leave a line claiming the mode still permits one while the runtime blocks every shell - and the fence shape contradicts the fence clause in its own notification |
| A store the runtime cannot enumerate is reported as what was searched, never as an absence | test | `test:tests/pi-adapter.test.ts#does not call a package missing while the project store has it` | the check searches one store while the host resolves from several - and its resolver is private - so a package sitting in the project or legacy global store is called missing, which is the same wrong-cause failure the check was written to remove |
| A case that needs a state in flight holds it, and never sleeps into it | test | `test:tests/suite-timing.test.ts#holds a state instead of sleeping into it, so no case waits on a duration` | a fixed duration stands where a state should be, so the case fails on a slower machine for a reason unrelated to the change - measured as `0 !== 2` in 2807 ms on a commit that only changed a task status - or passes while proving nothing, because its assertion is about order and a late second launch still satisfies it. **What the door holds is narrower than the rule**: one line of one spelling at any depth, so a fence written across two lines, with an aliased `setTimeout`, or with a variable delay is not caught - stated here rather than implied, because a row that reads stronger than its mechanism is the defect this table exists to prevent |
| A release archive carries no build artefact the manifest cannot see, and a cache is the case that shipped | test | `test:tests/release-readiness.test.ts#refuses an archive that carries a cache, naming the entry` | a build artefact carries what no commit has and the manifest deliberately skips - measured on the published v0.2.4, where seventeen `.pyc` files embedded the CI builder's absolute path (`D:\a\dove-pi\...`) in every download, because the runner executed Python inside the copied roots before the archive step and `sourceDigest` skips `__pycache__` - so the manifest covered a smaller scope than the archive delivered, and the person downloading it was the one who found out. **What the door holds is narrower than the sentence above, and a verifier measured where**: it refuses four cache directory names plus any `.pyc`, and 201 of the 344 shipped tree files are outside `RELEASE_SOURCE_ROOTS` (mostly deliberately - `tests`, `.trellis`, the licence files), so a stray file under a name nobody listed still passes. The next reader should look there |

## Where this harness is documented

The coding specifications live under `.trellis/spec/`, indexed in [`.trellis/spec/backend/index.md`](./.trellis/spec/backend/index.md) -
and that index lists **every** specification in that directory, which a test checks, because it was missing three of them.

One correction to a tracked document: `.trellis/workflow.md` names the script at .trellis/scripts/inject-workflow-state.py, which
in this install is `.codex/hooks/inject-workflow-state.py`. This note also named a .claude path as a second location, which was true when it was written and is not any more: that platform is not installed here, and its 52 files are still in the tool own hash list. The removed path is written without code marks for the same reason the one below it is. The path that is wrong is
written here without code marks on purpose: the documentation checks read code spans, and a note describing a wrong path would
otherwise read as one. The workflow-state mechanism itself works - that document carries thirty of its
blocks - and the file may be replaced by a tool update, so the correction lives here, where a test holds its position.

A second correction, measured rather than assumed: **archiving a task breaks the curated context entries that pointed inside it.**
.trellis/scripts/task.py moves a task directory to `.trellis/tasks/archive/<month>/<name>/` and rewrites nothing, so every entry in
`implement.jsonl` or `check.jsonl` whose path began with the task own directory stops resolving - 58 of 66 broken pointers in one
measurement, and the entries read fine, which is why nobody noticed. **The script is in `.trellis/.template-hashes.json`, so the fix is not
this repository to make**: a `trellis update` may replace it, and an edit here would be lost. What is ours is to repoint the entries after an
archive, and to know that a fresh archive has just done it again.
**Re-measured later, so the numbers above are not read as current**: at that point there were **394 of 396** archived curated entries
pointing into `.trellis` that still resolved, the two broken ones being the two files that are genuinely gone. The 58 of 66 was the state
before they were repointed, and every archive since has exercised the same breakage on its own task - which is why the entries are worth
re-pointing after an archive and why the warning is not historical.
**Measured again on 2026-10-05, by archiving five tasks of one session.** The tax came due exactly as described: five entries broke, all of
them the archived task naming its own prd, design, implement and findings files, and a scan for every unresolved `{"file": ...}` entry then
found **three** broken pointers in the whole corpus - two were the same tax left unpaid by an earlier archive (that task own entries still
naming its pre-archive directory, repointed in the same commit) and one points at tests/module-graph.test.ts, a test that is genuinely gone
and cannot be repaired by repointing. So the standing numbers are: the archive tax is **5 per archive, paid by hand**, and the corpus holds
**one broken pointer that no repointing fixes**. The scan is worth keeping for the same reason the note is: it reads a directory the reader
of a task file never opens.

**Measured a fourth time, 2026-10-05, by archiving two more tasks of one session - and the sentence above is corrected by it.** The tax was
**zero** this time: neither archived task had curated an entry naming its own files, so the repointing helper reported *entries repointed: 0*,
the first archive in this note's history that cost nothing. What the same scan then reported is the correction: the corpus holds **three**
pointers no repointing can fix, not one - the module-graph test named above, plus **two** entries of the archived 09-03 task that both name
convergence-evidence.md, a file the archived copy of that task does not have at all. Repointing those two in an earlier session fixed their
prefix and not their existence, which is why they came back. So the standing number is a count of **genuinely absent content**, and it is
three; the tax is not a constant either, because it is per archive and it is zero when the task curated nothing inside itself.

**Measured a fifth time, 2026-10-05, on the next archive - and this one turns the tax into a rule.** That task curated its own research file in
both manifests, and the helper repointed exactly **two** entries: the count is not a mystery, it is the number of entries pointing inside the
task's own directory at the moment it is archived. So the predictor is checkable before archiving rather than discovered after it, and the
previous zero and this two are the same sentence with different inputs. Nothing new entered the list of pointers no repointing can fix: still
**three**, and the two doors that read every citation in `.trellis/spec/` stayed green across the move, because no specification names a path
inside a task directory that this session archived.

**Measured a sixth time, 2026-10-05, and this one found a second payer the note did not know about.** Archiving two tasks turned **two
citation doors red**: a specification page and the front door had cited files *inside* an archived task by path, and the archive moved them -
**seven citations** across two specification pages, the front door and one task document, none of which the repointing helper could see,
because it rewrites curated entries only. The repair is the same in kind - name the file where it now is, under
`.trellis/tasks/archive/<month>/<name>/` - and the doors then hold the new name. So the tax has **two payers**: the curated entries, and any
page that cites a task's own files. The second payer is checkable **before** the archive, by searching for the task's path; the doors are what
tells you afterwards.

The harness own subjects: [`personal-agent-harness-loop.md`](./.trellis/spec/backend/personal-agent-harness-loop.md) for what it
measures and what was decided about its boundaries, [`harness-loop-turn.md`](./.trellis/spec/guides/harness-loop-turn.md) for how a
turn runs, and [`.trellis/harness-surface.yaml`](./.trellis/harness-surface.yaml) for the editable surface those turns are bounded by.
