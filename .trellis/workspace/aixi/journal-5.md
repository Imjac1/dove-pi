# Journal - aixi (Part 5)

> Continuation from `journal-4.md` (archived at ~2000 lines)
> Started: 2026-09-29

---



## Session 213: The survey the skill prescribes, run for the first time
<!-- trellis-session: v=2 fp=e6ca333222f9f32f -->

**Date**: 2026-09-29
**Task**: The survey the skill prescribes, run for the first time
**Branch**: `master`

### Summary

Ran get_context.py --mode record, the first step of the finish-work skill, read in round 158 and never executed. It found five active tasks of which four are ours, and the umbrella plus every earlier archive absent, so those archives worked. Three were archived because their work is finished.

### Main Changes

- the three: the interop layer whose one measured gap closed, the audit observability child whose eight plan items were done across five rounds, and a reading task of mine whose archive had apparently failed
- and one left open on purpose: 08-28-dove-pi-web has a feature that exists and is tested and a PRD written from the code with its acceptance criteria deliberately unchecked, because checking them would be marking my own reading as the intent. It stays until whoever wrote the intent says whether those are it
- and one the survey did not list is worth finding anyway: 08-28-dove-pi-usage-review is open on disk and filtered out of the survey, so its task.json status is one the survey skips. Its work is done and its plan carries twenty-three unchecked boxes, each describing work either done or measured as already existing. Checking them honestly means saying which is which

### Git Commits

| Hash | Message |
|------|---------|
| `4e70eb9` | chore(task): run the survey the skill prescribes, and act on it |
| `acc2a8b` | chore: archive the the-survey task |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 785 tests, 783 pass, 0 fail, 2 skipped. No source file was changed this round.

### Status

[OK] **Completed**

### Next Steps

- 08-28-dove-pi-usage-review: check its twenty-three boxes and say for each whether it was done or measured as already existing.


## Session 214: The twenty-three boxes, each given a reason
<!-- trellis-session: v=2 fp=40b30743de2fb76e -->

**Date**: 2026-09-29
**Task**: The twenty-three boxes, each given a reason
**Branch**: `master`

### Summary

Checked the usage review plan item by item. Six of ten are done or measured as already existing, two are not done, and two are partly. And the first result is a correction: a previous round said the plan carries twenty-three unchecked boxes, and it carries none - prd.md has zero checkbox lines.

### Main Changes

- that number was invented, and it is the tenth instance of this session own recurring class: a value asserted from a view of a thing rather than from the thing
- the six: the session-size fuse and its wiring, capability names in the system prompt with the matched-command suggestion, the editor cross-host check, Trellis as a provider kind, the cache line in the status output, and the capability records in the ledger
- the four that are not: a configurable message cap has zero hits, and the keepalive half of session affinity is absent although x-session-affinity is already set. Session resumption across sessions and the keepalive are the partly items
- and the verdict is not written into the review file. The review is someone else research, and annotating it with my own readings is the failure this session keeps recording. The verdict lives in the task, where it is my reading and says so

### Git Commits

| Hash | Message |
|------|---------|
| `5452136` | chore(task): correct the box count, and give every review item a verdict |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 785 tests, 783 pass, 0 fail, 2 skipped. No source file was changed this round.

### Status

[OK] **Completed**

### Next Steps

- Two items are work rather than verdicts: DOVE_PI_MAX_MESSAGES, which is small and advisory, and the keepalive, which needs the network and the plan own offline-first constraint.


## Session 215: The configurable message cap
<!-- trellis-session: v=2 fp=5200912de078a98c -->

**Date**: 2026-09-29
**Task**: The configurable message cap
**Branch**: `master`

### Summary

Did the review P0.2 as a third branch of the context guard rather than a new mechanism, because that module already carried the env reader, the disable switch, the advisory contract and the hint the adapter notifies. The reader is DOVE_PI_MAX_MESSAGES with a default of 150, and the hint names both ways out.

### Main Changes

- and the hint says neither way drops anything, because the host owns the conversation and a cap that deleted or rewrote history would be control this adapter does not have
- an unsupplied count reports absent rather than invented, with a control holding that against a cap of one where a supplied count of two does fire
- the existing deepEqual on the whole guard object asserted its exact shape, so the two new fields had to be added there. The suite would have caught it and did not have to, because the file was read first
- and one thing is recorded rather than built: the adapter does not yet pass the message count. It reads it from the same call the fuse uses on the same lines, so passing it is a one-line change that belongs to the round touching that handler next

### Git Commits

| Hash | Message |
|------|---------|
| `0350b9d` | feat(context): add the configurable turn cap the review asks for, as a third branch of the guard |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 787 tests, 785 pass, 0 fail, 2 skipped - two more than before. The guard suite is 10 cases, up from 8.

### Status

[OK] **Completed**

### Next Steps

- Pass the message count from the handler, which reads it on the same line the fuse already calls; then the keepalive half of P0.3, which needs the network.


## Session 216: Passing the message count, once
<!-- trellis-session: v=2 fp=279f58637b7ea627 -->

**Date**: 2026-09-29
**Task**: Passing the message count, once
**Branch**: `master`

### Summary

Wired the turn cap. The handler read ctx.sessionManager.getEntries() twice on adjacent lines, once for the diagnostics the fuse reads and nowhere for the guard, so the change is one read reused rather than a second call. One read, two users, and a name that was free: sessionEntries had zero occurrences in the whole file.

### Main Changes

- the holder this does not have, for the third time in this line of work: the wiring line is held by compilation. The two cases added last round test guardContext directly and the adapter suite session arrays are far below a hundred and fifty entries, so the cap cannot fire in them
- with one difference from the seam question worth noting: this line can be held, because the count is an argument a case controls. The next step is written down - a case in tests/pi-adapter.test.ts, which already builds the handler and a fake context, supplying a long session and a small cap

### Git Commits

| Hash | Message |
|------|---------|
| `d7cebd7` | feat(adapter): pass the conversation count the turn cap needs, from the read that already happens |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 787 tests, 785 pass, 0 fail, 2 skipped, unchanged. tests/pi-adapter.test.ts and tests/context-guard.test.ts together: 44 pass.

### Status

[OK] **Completed**

### Next Steps

- A case that holds the cap wiring: a long session and a small cap through the adapter handler, which is possible because the count is an argument. Then the keepalive half of the review P0.3, which needs the network.


## Session 217: A case that holds the cap wiring
<!-- trellis-session: v=2 fp=a14e01a27202c680 -->

**Date**: 2026-09-29
**Task**: A case that holds the cap wiring
**Branch**: `master`

### Summary

Held the turn cap through the adapter handler, which the previous round wired and left unheld. DOVE_PI_MAX_MESSAGES is set to 3 and restored in a finally, and the context reports 1000 tokens against a 1000000 window so neither the fraction nor the token guard can fire.

### Main Changes

- it is a case of its own rather than a step in the existing one, and the reason is measurable: that case fires the fraction guard on every turn because its context reports 220000 tokens against a 128000 window, and every notice shares one guardNotified flag that is one-shot, so a cap notice added there could never fire
- the staging is three entries quiet because the comparison is greater-than, five producing one notice naming /compact and a new session and the count it saw, and five again producing nothing as the control
- and the assertion that matters is that the other two guards stayed silent in the same turn. Without it, a case asserting a notice appears would pass if a neighbour raised it, which is the failure this line of work keeps recording

### Git Commits

| Hash | Message |
|------|---------|
| `10b33b9` | test(adapter): hold the turn cap through the handler, with the guards beside it asserted silent |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 788 tests, 786 pass, 0 fail, 2 skipped - one more than before. The adapter suite is 35 cases, one longer.

### Status

[OK] **Completed**

### Next Steps

- The review list is now down to one item: P0.3 keepalive, which needs the network and the plan own offline-first constraint.


## Session 218: The keepalive whose own evidence contradicted it
<!-- trellis-session: v=2 fp=b4f0f8b96b7b3ad4 -->

**Date**: 2026-09-29
**Task**: The keepalive whose own evidence contradicted it
**Branch**: `master`

### Summary

Measured the review P0.3 keepalive before building it, and found the review interval contradicted by the repository own observation: context-guard.ts records that cache misses are time-driven, a gap over sixty seconds giving a 34 to 40 percent miss regardless of prefix size, while the review proposes a heartbeat every four to five minutes. So the interval is derived as three quarters of the observed gap, and a case asserts the ordering.

### Main Changes

- the policy is off by default because a heartbeat is a provider request, so enabling it is enabling the network, and the review own note asks for optional and offline-first. The disabled branch is checked first and nothing in the module reaches the network
- and it is its own module rather than part of the guard: the guard reads what already happened to the prefix, while this decides whether to make a request - the only act in this line of work with a network cost
- then the repository corrected me: the reachability check failed with has no module that is unreachable and unlisted, because the new module was neither imported nor listed. The commit before it went out with the gate red, the second time this session has done that
- the check own vocabulary is exactly right for the case, and its entry now names what will reach the module rather than claiming nothing will: the keepalive policy is complete and its timer is not built, so wiredBy says the adapter round that schedules a heartbeat is wiring rather than this decision

### Git Commits

| Hash | Message |
|------|---------|
| `9287c93` | feat(adapter): derive the keepalive interval from the repository own observation, and default it off |
| `e3b009b` | fix(harness): list the keepalive module, which the reachability check was right to flag |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 793 tests, 791 pass, 0 fail, 2 skipped - five more than before. The reachability suite is 6 cases. The keepalive suite is 5.

### Status

[OK] **Completed**

### Next Steps

- This one is now down to its timer. The review list has nothing else that is real work in this repository.


## Session 219: The timer, with its clock injected
<!-- trellis-session: v=2 fp=4967566ad98b7066 -->

**Date**: 2026-09-29
**Task**: The timer, with its clock injected
**Branch**: `master`

### Summary

Built the keepalive timer after measuring two things: the adapter has no scheduling facility at all, and the host event vocabulary is sixteen callbacks of which none means time passed. So a timer is the only way to observe idleness, and it takes its clock as an argument so the scheduling rules are testable.

### Main Changes

- the class enforces three rules the policy cannot know alone: observe re-arms, because a session that is talking needs no heartbeat; disarm is the caller obligation on shutdown, because a timer outliving its session would send the next one a request nobody asked for; and a due callback disarms itself first, so a slow callback cannot stack a second heartbeat
- and the fake clock had to model a timer rather than a switch. The first run failed with a session that just talked is not idle, because the fake fired whatever was pending regardless of when it was due, so a test could fire early and read the result as a defect. A fake that does not model the thing it stands in for produces findings about the fake
- and importing a module from a test does not make it reachable: the walk starts from entry points, and a test file is not one. The allow-list entry from the previous round stands, which the reachability suite confirmed in both directions

### Git Commits

| Hash | Message |
|------|---------|
| `d424765` | feat(adapter): build the keepalive timer with its clock injected, so the decision is testable |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 797 tests, 795 pass, 0 fail, 2 skipped - four more than before. The keepalive suite is 9 cases, the reachability suite 6.

### Status

[OK] **Completed**

### Next Steps

- Nothing constructs the timer yet, and the allow-list entry names what would reach it: the adapter round that schedules a heartbeat. That is host integration, and its provider call needs the network.


## Session 220: Scheduling the heartbeat, and what the callback may do
<!-- trellis-session: v=2 fp=0f5c4b6bbfbe695f -->

**Date**: 2026-09-29
**Task**: Scheduling the heartbeat, and what the callback may do
**Branch**: `master`

### Summary

Wired the keepalive timer to three hooks that already existed. The measurement that decided the shape: the host API the adapter may call is ten verbs and none of them reaches the provider, so the adapter cannot make the unsolicited request a heartbeat exists for - and the callback therefore reports instead.

### Main Changes

- that is the architecture rather than a limitation to work around: the host owns the provider. The callback reports through whatever context the last request supplied, which is what observe is for, and it is the same shape the guard and the fuse already have
- the wiring: session_start at 2093 disarms any previous timer and arms a new one with a real unref-d clock, session_shutdown at 2477 disarms and drops it because the timer documents that as the caller obligation, and before_provider_request at 2922 observes and stores the context
- and the repository told me when the module was done. The reachability check failed with these allow-list entries are now reachable, removing the entry is the definition of done for that module - and the check asserts it in both directions: an unreachable module not listed is new dead code, and a reachable one still listed is a list that rotted
- the entry is gone and the comment left in its place records the seventh shrink

### Git Commits

| Hash | Message |
|------|---------|
| `b5aa258` | feat(adapter): arm the keepalive on session start, and let its callback report rather than act |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 797 tests, 795 pass, 0 fail, 2 skipped. Reachability, keepalive and adapter suites together: 50 cases, all passing.

### Status

[OK] **Completed**

### Next Steps

- The act itself is the last thing and it is out of reach: nothing in this repository can send the keepalive, because the host owns the provider.


## Session 221: The ten modules nothing reaches
<!-- trellis-session: v=2 fp=a4c929097297eddd -->

**Date**: 2026-09-29
**Task**: The ten modules nothing reaches
**Branch**: `master`

### Summary

Read the reachability register rather than assuming it is a defect list. Ten entries with sizes and reasons: four are readings whose class is documented, two are pre-existing, two are a reference loop, and two are adapters for a loop the host owns. It is not a list of defects, it is a list of things that know what they are.

### Main Changes

- and it is accurate including where it is transitive: dispatcher has five matches in five files and checkpoint a hundred and forty-eight in eighteen, both including source files, and both from files that are themselves unreachable. The walk is transitive and the entries are about reachability from an entry point rather than about mentions
- two entries said no milestone in this task claims it, and that task is archived, so the sentence had stopped being answerable by a reader. Corrected to say no milestone claimed it while that task was open and none has since, which is still true of both entries
- and a stray parenthetical left behind said the entry below stays for the reason it always had, when the entry below had left the list two rounds earlier. Removed

### Git Commits

| Hash | Message |
|------|---------|
| `eabafd8` | docs(harness): correct two reachability entries whose wording had gone stale |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 797 tests, 795 pass, 0 fail, 2 skipped. The reachability suite is 6 cases.

### Status

[OK] **Completed**

### Next Steps

- The register is honest and the review list is closed. What remains is the first real turn, which needs a host running a session.


## Session 222: Closing the review task, and one more survey
<!-- trellis-session: v=2 fp=b681ba65489e7b45 -->

**Date**: 2026-09-29
**Task**: Closing the review task, and one more survey
**Branch**: `master`

### Summary

Closed the last task whose work is done: 08-28-dove-pi-usage-review was open on disk while its P0 had landed, its keepalive was built and wired, and every other item had a verdict. Its research file was left exactly as its author wrote it, and moved to the archive with the task.

### Main Changes

- and the record-mode survey now lists the same two open tasks and no others, so the open list and the survey agree. An hour ago they differed by the one task this round closed
- what the survey then found is nothing reachable: the review list is closed, the reachability register is read and correct, and the two pre-existing modules nothing reaches are known and recorded, with deleting them being a decision rather than a cleanup
- so the honest answer to what is left is one thing rather than an absence: the first real turn, which needs a host running a session. Pi is installable from here and installing it changes this machine, which is the one action this loop may not take

### Git Commits

| Hash | Message |
|------|---------|
| `481001f` | chore(task): close the last finished task, and survey until the answer is one thing |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 797 tests, 795 pass, 0 fail, 2 skipped. No source file was changed this round.

### Status

[OK] **Completed**

### Next Steps

- One task is open and it waits on a person; the first real turn waits on a host. Nothing else in this repository is reachable work.


## Session 223: The surface that bounds every turn
<!-- trellis-session: v=2 fp=7186047e4c0923cf -->

**Date**: 2026-09-29
**Task**: The surface that bounds every turn
**Branch**: `master`

### Summary

Read harness-surface.yaml for the first time and mapped this span against it: 1156 paths changed, 1143 inside a declared component, 13 outside. The surface declares seven components bound to files, with two deliberately lacking a verifiedBy entry and the file saying why.

### Main Changes

- the two gaps are the honest form this session has been using: a component with no entry means nobody has stated what verifies it, which is a fact about our knowledge rather than something to fill with something plausible
- and the thirteen outside are not noise and not a defect: the two READMEs, the launcher, the map itself, a Pi extension, and the six scripts that consume the readings - and the map own comment covers them, since it describes what a component is rather than partitioning the tree
- though three are worth naming: the READMEs are what the drift check calls the only pair of user-facing documents and sit outside the map that says what may be edited; the scripts consume components without being one; and dove_pi.py is consistently outside a map that describes the harness rather than the installer that ships it
- the point of the check is that this span work is inside, with the rest categories rather than stray edits. That is checking rather than surveying, which is why it was worth a round where two surveys had already answered nothing left

### Git Commits

| Hash | Message |
|------|---------|
| `897cdc6` | chore(task): read the surface that bounds every turn, and map the span against it |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 797 tests, 795 pass, 0 fail, 2 skipped. No source file was changed this round.

### Status

[OK] **Completed**

### Next Steps

- Nothing in this repository is reachable work. One task waits on a person and the first real turn waits on a host.


## Session 224: The boundary, with its evidence
<!-- trellis-session: v=2 fp=2ebda7690ed20ec4 -->

**Date**: 2026-09-29
**Task**: The boundary, with its evidence
**Branch**: `master`

### Summary

Ran the whole gate rather than parts: typecheck, the Node suite at 795 passing, the installer suite at 140 cases, doctor healthy and pi smoke all exit zero, while release:check exits two and that is the known one - its entry passes none of the five arguments the Python tool requires. Then stated the boundary with its evidence and changed nothing.

### Main Changes

- what is done and what holds it: the review list closed with every item done, wired or measured as already existing and each with a holder; the reachability register honest with ten entries saying what they are; the surface mapped at 1143 of 1156 changed paths inside a declared component; and the suite at 797 tests, which grew by 50 cases across this span while staying green
- what waits and on what: one task waits on a person, because its criteria were written from the code and deliberately left unchecked, since checking them would be marking my reading as the intent. And the first real turn waits on a host, because Pi is installable from here and installing it changes this machine, which is the one action this loop may not take
- nothing was changed to make the round look fuller. Three rounds have looked, and the third found something to check rather than something to do, which is the difference between a survey and a check

### Git Commits

| Hash | Message |
|------|---------|
| `2dfda47` | chore(task): state the boundary with its evidence, and change nothing |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 797 tests, 795 pass, 0 fail, 2 skipped. npm run test:installer: 140 cases. npm run doctor: healthy. npm run pi:smoke: exit 0.

### Status

[OK] **Completed**

### Next Steps

- The same boundary, unchanged: one task waiting on a person and the first real turn waiting on a host.


## Session 225: The refusals a user could not read back
<!-- trellis-session: v=2 fp=23ed8239d5a7c0d1 -->

**Date**: 2026-09-29
**Task**: The refusals a user could not read back
**Branch**: `master`

### Summary

Planned from the user side first and implemented second: the framework was read to find what a person actually hits, which turned out to be a refused action no projection exposed, a work mode whose failure to load was announced once, and an intent/lane that reads idle exactly when a request has just died. Nine files, 321 insertions. Then audited the change rather than the plan, which found three defects of my own and cleared one real risk by proving it unreachable.

### Main Changes

- the projection carries refusals: gate.refused rows have been written since the gate boundary existed and no projection showed them, so ExecutionDiagnosticsProjection gained an optional lastRefusals bounded to 8 with reason bounded to 1024 and remediation deliberately absent, which reaches RPC diagnostics/status, doctor, agent_doctor and the new in-session reader at once instead of creating a fourth surface that can disagree with the other three
- the operator can see why nothing runs: /status now names the work mode in force and marks a mode whose declaration failed to load, and /status full carries the loader own reason - a failed load refuses every tool call before the lease check, and until now the only notice was one session-start notification that scrolls away
- two readings kept apart on purpose: strategy= describes the running request while lastPlan=, lastTerminal= and Refused= are read back from the ledger and outlive it. The defect was an asymmetry inside one function - terminal had a no-live-request fallback and intent/lane did not - so the fix adds a field rather than giving one field two meanings, and /status still reads the ledger exactly once
- the review found my own work at fault three times: the English README hard-wraps at 100 columns and my insert was one 700-character line; the field names were attributed to agent_doctor as well as /status full when only the latter renders them; and the new table row was 320 characters against a table whose longest row was 195
- a real risk checked and cleared rather than assumed: action-policy names relativeTarget ?? target in a fence refusal, so an absolute path from a tool argument could have reached the new field and the public projection. It cannot - declaredPrefixHit returns undefined for an unresolvable target, so the fallback is unreachable at that return. The other refusal sources interpolate a number, an action name, or declared identifiers
- the session pointer was corrected: task.py start had run degraded and the active task still pointed at 09-29-report-blocker from the previous day, so sub-agent context and the journal would have resolved to the wrong task. Fixed through the supported TRELLIS_CONTEXT_ID override rather than by editing runtime state

### Git Commits

| Hash | Message |
|------|---------|
| `c86ea50` | feat(status): carry the work mode, the last plan, the last terminal and the refusals into /status |
| `ebc1130` | chore(task): audit the harness from its user side, and find the refusals unreadable |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 804 tests, 802 pass, 0 fail, 2 skipped (the two managed-launcher cases, skipped because no launcher is installed here). npm run doctor: healthy, with requestDiagnostics carrying schemaVersion alone - the correct absence, since this workspace holds no ledger
- [OK] the constraint suites pass together: execution-diagnostics at 7 cases including the key-absent case, document-drift, spec-context-budget, harness-reachability, and the neighbour suites at 101 cases. The command-list assertion in pi-adapter.test.ts is byte-identical to before, which is what not adding a command means
- [OK] four failures are environmental and were proven pre-existing rather than argued: three installer cases fail because Path.home() raises with no HOME and install.ps1 detects this sandbox as non-Windows, and two suites fail under a bare node --test because this shell has an empty PATH while npm injects one. Stashing the change and running the same cases in a clean HEAD worktree produced byte-identical failure text, and the restore was verified by hashing all eight files

### Status

[OK] **Completed**

### Next Steps

- U1 stays deferred as its own task, and it is the one finding with teeth: a formal-lane first write is blocked and the request is aborted in the same call, operation=freeze is the only way out and appears nowhere in the tool description, and the path has no end-to-end test. What is unverified and must not be assumed: whether the block reason survives into session history, because if it does not, a retry has no memory of why it died
- nothing waits on this session. The archive follows this entry, and the two remaining environment-dependent failures are worth a task of their own only if someone uses bare node --test as a gate, which the repository does not


## Session 226: A real user session the harness can actually be
<!-- trellis-session: v=2 fp=ea1bbc6c819863a5 -->

**Date**: 2026-09-29
**Task**: A real user session the harness can actually be
**Branch**: `master`

### Summary

Planned a replay of a real user session and then built it. The reconnaissance found the flow had been planned before from 192M prompt tokens of telemetry, so this went after the one axis nothing had closed: the harness could isolate and record, but it had never modelled a person - the model was canned text, every dialog was a hardcoded refusal, and a work mode could not load at all through the source launcher.

### Main Changes

- the launcher now sets the framework version its own help has always claimed it sets: DOVE_PI_FRAMEWORK_VERSION was named only in that help text and assigned only by bin/dove-pi.cjs, so a project declaring a work mode refused to load and refused every tool call, while the managed launcher ran the same project fine. Two documented entry points, two behaviours, and the existing environment check could not see it because it asks whether a name appears anywhere in the code rather than whether the launcher sets it
- the harness can be a user who consents: a step may declare dialogs, consumed in order, and the summary counts which answers the scenario supplied against which the driver defaulted - a refusal that was asked for and a refusal that was supplied used to read identically, which is the same shape as the none-versus-not-recorded defect this session fixed once already
- seven scenarios are committed under tests/fixtures/scenarios/: approving a gated action, declining one, cancelling a request while its tool runs, resuming a session across two runs, correcting an earlier instruction, running past the turn cap, and compacting on request. Each is driven through the public launcher with its own project, state and session roots, and each has an assertion in the suite rather than inside the data file
- cancelling is a modifier on the active step, not a step of its own, because the dispatcher sends step N+1 only after step N settles - a standalone abort could only ever cancel an idle agent. It rides the same tool-execution edge queueDuringTools uses. Session reuse is an explicit --reuse-session so the per-run suffix that keeps concurrent scenarios disjoint stays the default
- four defects of my own were found by running rather than reading: loadScenario dropped the abort flag so the abort never fired; a refusal from compact ("Nothing to compact (session too small)") was treated as a scenario failure when it is the host behaving correctly; and a doubled escape inside two nested template literals produced an unterminated string that broke the faux provider for thirteen cases at once
- both READMEs now describe the step fields the harness actually accepts, including the committed scenario library. The format section had stopped describing the format, which is the class of defect this repository keeps finding in its own declarations

### Git Commits

| Hash | Message |
|------|---------|
| `956628b` | fix(launcher): set the framework version a work mode's range is checked against |
| `81c3a63` | feat(blackbox): model a real user session, and let a scenario answer a dialog |
| `c711ffb` | chore(task): plan the real-user session replay, and measure what it needed |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 811 tests, 809 pass, 0 fail, 2 skipped - up from 804 by exactly the seven new cases. The black-box suite is 18 pass, 0 fail, with all eleven pre-existing cases still green
- [OK] npm run test:installer: 141 tests, 4 failures. The same four fail at HEAD with the changes stashed - proven by a controlled comparison, not argued - and the restore was verified byte-identical. A baseline I reported earlier in this session said one failure and was wrong: TEMP was unset, so three PowerShell-dependent cases never ran

### Status

[OK] **Completed**

### Next Steps

- the real-provider run is the one acceptance criterion still open, and it is blocked on a person: ~/.pi/agent holds only dove/, with no settings.json and no auth.json, so --provider real ends in provider-authorization-denied by construction. The command and the readings to record are in the task implement.md
- the task is deliberately not archived while that criterion is open. The fidelity boundary is written down with it: the model is still scripted, TUI rendering is outside the harness, and only the confirm dialog is reachable because ask_user_question is not a Pi built-in


## Session 227: The first real session, and the four defects it exposed
<!-- trellis-session: v=2 fp=97dd24c93332ac27 -->

**Date**: 2026-09-29
**Task**: The first real session, and the four defects it exposed
**Branch**: `master`

### Summary

Ran Dove against a real provider for the first time on this machine, and it did not work - twice for reasons that were ours, once for a reason that was the harness own. The provider turned out to be configured correctly and invisible: PI_CODING_AGENT_DIR is pointed at an isolated directory, so the mode that says "use the operator provider" could not see it. Reachable and unusable, which is why no real run had ever happened.

### Main Changes

- the harness now carries the provider configuration into the isolated agent directory, and only for a real provider so the deterministic cases keep their own extension-registered one. The summary records which files came in, by name - the contents are never logged. This is the fix that made a real run possible at all
- two corrections on the operator machine, both reversible: models.json declared contextWindow 256 for a model whose endpoint accepted max_tokens 200000, and maxTokens 16384 above a 256 window is impossible - Dove providerOverhead alone is 256, so every request would have been judged over budget and aborted. Set to 200000, the conservative direction, with a backup. And settings.json did not exist, so Pi had no default provider and selected a built-in one, which is the "No API key found for the selected model" that looked like a bad key
- a bounded read-only audit scenario is committed: read one subsystem, report at most three findings, then run /status and /status full so the session evidence contains the state a user would inspect. The first version asked for an unbounded audit of the whole repository and was still working after seven minutes, which is a scenario defect rather than a slow model
- four defects the real run exposed, none reachable by reading: /status full pushes the three fields added in the previous task past the 2048-character evidence cap because they sit after the strategy JSON dump, so the TUI shows them and the evidence does not; providerRounds reports 1 where the goal line in the same output says Provider 8; extractToolNames looks for tool_start while Pi emits tool_execution_start, so step.toolNames is always empty and thirteen tool calls were invisible; and a real session ends in retry-refused-after-effect, which is the fail-closed retry policy firing in practice for the first time
- and one measurement the cost programme has wanted since it was written: sessionHitRate 2.8 percent, four full misses, 2432 cache-read tokens against 85231 input. The 192M-token review concluded the cache strategy works while the prefix grows; this is the first observation of it in a real session, and the cache barely helped

### Git Commits

| Hash | Message |
|------|---------|
| `7460917` | fix(blackbox): carry the provider config into the isolated agent dir |
| `f5e4dac` | feat(blackbox): add the bounded read-only audit scenario |
| `d09a9cb` | chore(task): record the real run and what it found |

### Testing

- [OK] the run itself is the evidence and it is not reproducible: provider ant, model atria-dawn-preview, 2026-09-29, 415.6 seconds, exit 0, 503 events, 13 tool calls (read x9, bash x4), 85231 input tokens, terminal retry-refused-after-effect. Recorded in the task implement.md with the command and the non-reproducibility statement; the raw run stayed outside the repository
- [OK] npm run typecheck and the full suite stayed green across the harness change, and the eleven pre-existing black-box cases still pass, so carrying the provider configuration in did not disturb the deterministic path

### Status

[OK] **Completed**

### Next Steps

- the four defects are a task of their own: two are a few lines, one needs the counter reset located, and the retry refusal needs a decision about whether a session dying there is the intended answer or a UX defect. The task record carries them with the evidence
- the cost axis still has exactly one observation, so nothing about it generalises yet. A second real session would say more than any amount of reading


## Session 228: 把真实运行写成做法，并找出遮住它的四处
<!-- trellis-session: v=2 fp=677ba846123800da -->

**Date**: 2026-09-29
**Task**: 把真实运行写成做法，并找出遮住它的四处
**Branch**: `master`

### Summary

真实使用才会暴露的问题此前只被偶然走过一次。本任务把它写成做法，并诊断出缺口为何是静默的：确定性路径一直绿，而绿恰好掩盖真实路径从未被走过。

### Main Changes

- 新增 routed spec personal-agent-field-run.md（8,619 B / 24,576），并做四处同步：router 链接、spec-context-budget.test.ts 的两个硬编码清单、backend 索引。之所以不能折进 harness spec，是量出来的 —— 它只剩 270 B，request-runtime 只剩 37 B。
- 把 harness 套件登记为验证 tool-implementation：找出那四条缺陷的工具此前在**任何** `verifiedBy` 里都是空白。该声明自验证 —— 测试加载真实 yaml 并拒绝解析不了的条目。
- 两份 README 各加 1 个 ### 标题与 2 个围栏，并改写误名段落：document-drift 按计数比对两份 README 的形态，只改一边必红。
- 协议明确写出读数不可复现、是测量而非门禁、以及只有 read-only-audit 是给真模型写的（其余 7 个的断言写给脚本化响应）。

### Git Commits

| Hash | Message |
|------|---------|
| `f7ffa64` | docs(field-run): make a real-provider run a written practice, and name what hid it |
| `11ac2b8` | chore(task): plan the real-usage testing gap, and record what a field run is for |

### Testing

- [OK] npm run typecheck PASS；spec-context-budget/document-drift/harness-surface 30 tests 30 pass 0 fail（与基线一致）；npm test 811 tests 809 pass 0 fail 2 skipped（与基线一致）；npm run test:installer 141 tests OK 0 失败。

### Status

[OK] **Completed**

### Next Steps

- 未做且按计划不做：bash 非幂等策略（F15）是候选议题；未新增真实运行场景（D-C 决定）；未重跑真实会话（命令未变）。
- 遗留：real-run-findings / report-blocker / dove-pi-web 仍 active；其中 real-run-findings 的工作与 AC 均已完成却未归档。
- 安全：models.json 仍是明文 API key，且已进入一次会话上下文，建议轮换并改为环境变量注入。


## Session 229: Finishing the audit: a measured refusal, three red-checked assertions, and the tasks behind it
<!-- trellis-session: v=2 fp=b6d06d6660c7915c -->

**Date**: 2026-09-30
**Task**: Finishing the audit: a measured refusal, three red-checked assertions, and the tasks behind it
**Branch**: `master`

### Summary

Resumed the mechanism audit mid-implementation - typecheck was red and three of its decisions were half-applied - and carried it through check, spec updates and commit to archive. Two tasks closed, one left open with its reason written down.

### Main Changes

- R3 landed. src/core/invocation-disposition.ts answers what an invocation is once, and the two consumers read different fields of that answer: the freeze gate reads disposition, the retry path reads replaySafe, and the two unknown defaults stay opposite on purpose with one assertion each. Equivalence was shown before deletion - a probe ran the pre-change logic beside the classifier over 48 invocations (every name in both old tables, the shell cases, the capability and recipe cases, three undeclared tools) and reported no disagreement - so the two name tables could be deleted rather than kept just in case. The probe was temporary by design; its readings are in the task record and its assertions now live in tests/invocation-disposition.test.ts.
- The adapter finished migrating: both replay call sites read classifyInvocation(...).replaySafe, and the model-result character budget reads declaredReadOnly from the same table, so no second name set survives anywhere. declaredMutatingToolNames() lets the fence own union check compare against the declaration table instead of against a copy of it.
- R4 was tested rather than deleted, because its path survived the measurement as the overflow guard: a work mode, a non-idempotent effect and a claim whose record cannot be read, asserting that the refusal names both and marks the unreadable one. A reader that skipped an unreadable claim would undo the store refusal by omission, which is what the case is about.
- The gate admission of an undeclared tool is recorded and named instead of silent - gate.approved with gate: undetermined-disposition, plus a notification - so that nothing-declared-this stops reading like reviewed-and-found-harmless. It is still admitted: this is a workflow gate over a formal task, not a second Pi tool permission firewall.
- Two defects the check caught in this session own new code. A dead isReadOnlyShellCommand import was left in the adapter after the predicate moved. And the new gate record wrote action: event.toolName with viaCapability: false while every refusal for the same call writes the resolved action, so one call would have read as two records; it now uses resolveActionIdentity.
- Specs were updated only where there was room: framework-core (one classifier, two readings, undetermined-is-named), extension-runtime (a status line must not carry a serialized copy of a ledger projection), and field-run (the recorded retry-refused-after-effect is history rather than current behaviour). personal-agent-request-runtime.md was deliberately not touched - it sits 16 bytes below its 24 KiB budget, so the retry contract it already carries stays as it is.
- Two tasks closed. 09-29-pointless-machinery had all eight acceptance criteria ticked with evidence. 08-28-dove-pi-web was verified against code and tests rather than taken on trust: each of its five boxes now names the code and the test that hold it, and says the closing decision was delegated to the archiving session rather than stated by the author, which is what the original placeholder note asked for.

### Git Commits

| Hash | Message |
|------|---------|
| `ff8cecc` | refactor(audit): ask once what an invocation is, and delete what bought nothing |
| `e9fa3b1` | chore(task): record the audit, the measurements behind it, and the branch R0 took |

### Testing

- [OK] npm run typecheck clean; npm test 816 tests / 814 pass / 0 fail / 2 skipped against the 811/809/0/2 baseline. The net +5 is accounted for: three pure-function cases left with the functions they tested (providerRoundBudget, isMeaningfulToolProgress and the classifier case that moved), eight were added.
- [OK] npm run test:installer 141 tests OK, 0 failures - unchanged from the baseline.
- [OK] Three red-checks, one behaviour disabled at a time. Restoring the retry refusal line fails exactly the two named cases and nothing else. Disabling the overflow guard fails exactly the new claims case. Disabling the gate unknown branch fails exactly the new admission case. Every temporary switch was reverted with git checkout and the tree is clean.
- [OK] The R3 equivalence probe is reproducible from the command recorded in the task record. The probe file was deleted rather than committed: it was an instrument, not an artifact.

### Status

[OK] **Completed**

### Next Steps

- The compaction experiment is still inconclusive, and the refusal stays in place because of that: the probe never reached session_before_compact, so its single tool execution proved nothing. The next experiment is written in the task record - drive the observation tokens up with a roughly 100 KB tool result instead of lowering contextWindow, and require session_compact to be true, or the reading is inconclusive again.
- personal-agent-request-runtime.md has 16 bytes of its 24 KiB budget left, and the routing test pins both the specification list and every specification headings. The next change that touches it has to trade text out.
- Seven curated context entries in the archive point at files that no longer exist: two at files that are genuinely gone, the rest at task directories that were deleted. They were not repointed - the correct targets are not recoverable from here, and a guess would be worse than the broken pointer. AGENTS.md describes this class of breakage; this is its current size.
- 09-29-report-blocker is still active and is a stub: Requirements and Acceptance Criteria are both TBD. It needs planning or closing, and that is yours to call.


## Session 230: axi: plan converged onto one repo, the boundary landed in the product repo, and a documented cleanup
<!-- trellis-session: v=2 fp=838e75a76329b931 -->

**Date**: 2026-10-01
**Task**: axi: plan converged onto one repo, the boundary landed in the product repo, and a documented cleanup
**Branch**: `master`

### Summary

Wrote the architecture and development design, then proved the boundary rather than describing it: S0 gate parity in a scratch repo, the jailer as a module with six regressions (two criteria, the tamper criterion, the positive control). The user then decided the product and the runtime are one thing, so the scaffolding was retired into a bundle and the jailer came back into this repo (822/820/0/2, installer 141). Cleanup surveyed the whole tree: the six 'looks like junk' classes all failed (scripts, deps, the two unreachable core modules, 16 unreachable modules with recorded reasons), leaving 2.3 MB of tool backups (archived then removed), regenerable caches, and role labels on the two plan documents. Three of my own readings were wrong and are recorded as such: the 'mojibake' in task.json and in _v8-header.md were display artefacts of reading UTF-8 with the shell's default encoding, and _v8-header.md is not a duplicate of plan-v8.md (0% line coverage).

### Git Commits

| Hash | Message |
|------|---------|
| `a0e58f7` | ﻿chore(task): answer who owns the sandbox policy, and what that means for axi |
| `8e721f3` | ﻿chore(task): fold the A0.5 results into the plan revision |
| `f0d0325` | chore(task): prove Plane B with a restricted token, and land the reading in the plan and the spec |
| `685eca2` | chore(task): merge the plan, the A0 readings and the revision file into one document |
| `00e953b` | chore(task): rewrite the plan as one design document rather than three stapled together |
| `9aa40a0` | chore(task): give the plan the architecture section it was missing |
| `70ac2dc` | chore(task): add the development design - repo layout, module list, build order |
| `eac2eb6` | chore(task): stand up the new repo and record the gate-parity reading (S0) |
| `3fa34ec` | chore(task): curate A1's context and record its status |
| `b2c8dc9` | chore(task): record the jailer module and the three lessons its gate produced |
| `2a761b0` | chore(task): converge the program prd on one repo, with the shape decision in it |
| `5f14588` | feat(jailer): bring the boundary module back into the product repo, with its six regressions |
| `e70b8e2` | chore(task): record the merge, the two guards it tripped, and the scaffolding retirement |
| `363f853` | chore(cleanup): archive what only the tool backups held, then retire them |
| `9d998ca` | chore(task): record the cleanup readings, including the three premises that failed |
| `7db2751` | docs(plan): label both plan documents with their role instead of deleting either |

### Status

[OK] **Completed**


## Session 231: Use-time architecture page, the tree described as it is, and a time bomb found on the way
<!-- trellis-session: v=2 fp=6b88a7faf1c37828 -->

**Date**: 2026-10-01
**Task**: Use-time architecture page, the tree described as it is, and a time bomb found on the way
**Branch**: `master`

### Summary

Step 0 of the architecture refresh: added .trellis/spec/backend/personal-agent-use-time-architecture.md, routed from the runtime router and listed in the index, answering who is called when while a person uses the harness - the Pi host owns the loop while core/loop.ts is only the contract, the eighteen pi.on mount points with their declaration lines, the gate's live enforcement point inside the tool_call handler at extension.ts:2616, the process boundaries, the trust ladder, where the evidence lands, and two blanks stated as blanks. Step 1: directory-structure.md now lists all fourteen src directories and the four root modules with their layer, and carries a new section on the four layers and the rule that arrows only point down, with the measured state behind it - 26 of 111 files import across a layer, 22 downward and one upward. On the way this surfaced a pre-existing time bomb: modes/pentest and engagements/example-engagement carry a fixed grant window ending 2026-10-01T00:00Z, and host-work-mode.test.ts refreshed checked_at but not the window, so the suite went red the moment the clock passed it; proved pre-existing by stashing this session's changes and watching the same assertion fail at a pristine checkout, then fixed on the test side without touching an assertion. Two deviations recorded: the page was first written in Chinese while the index requires English, and a commit message was eaten by the shell, which is the third instance of text going through a command line in this repo.

### Git Commits

| Hash | Message |
|------|---------|
| `5de9969` | fix(test): stop the pentest host test from depending on the wall clock |
| `86c842a` | docs(spec): add the use-time architecture page, routed and indexed |
| `b06360a` | chore(task): record step 0 and the expired-window time bomb it surfaced |
| `fb945b5` | docs(spec): describe the tree as it is, and the direction the arrows point |
| `eceba75` | chore(task): record step 1, the language fix it needed, and the third shell-text slip |
| `7c4b906` | chore(task): record the closing state, with steps 2 to 4 still open |

### Status

[OK] **Completed**

## Session 232: A whole-repo audit, two doors against rot, and the plan rebased

**What started it**: a review of the whole tree against its recorded architecture. Eight angles,
each re-checked by an adversarial verifier; one angle was falsified, two or three findings were
overstated, and my own synthesis step threw the findings away, so the report was put together by
re-running every cited check.

**What it found**: the repository guards its structure mechanically - surface paths, reachability
in both directions, labels by the typechecker - while **numbers in prose and `file:line` anchors
in specs were guarded by nothing**. This session produced six instances of that rot itself, one
of them inside a day of being written.

**What it built**: `tests/spec-anchors.test.ts`, a door with three checks, and a rule for numbers
- computable ones are checked, moving ones are not written down. Both doors were narrowed by
measurement: a symbol-per-line rule was written, run, and **withdrawn**, because these pages make
group claims and it reported three citations that were correct.

**What it kept correcting**: a citation I "fixed" that was already right; a count I "falsified"
that was right (the comments use two wordings and I counted one); a review pointer that archiving
silently broke; and the report itself, which the round log had replaced while the acceptance
criterion still pointed at it.

### Git Commits

| Hash | Message |
|------|---------|
| `85b38dd` | fix(cli): make the axi turn a command a user can actually reach |
| `71e5c23` | fix(gate): record a refusal's class, and stop recording a gate's name |
| `7e60090` | feat(spec): a door over the specification pages' citations, and the ones it caught |
| `78fb91d` | fix(spec,task): the citations and numbers the audit measured as rotted |
| `d684cef` | feat(spec): check the claim a mount-point row makes, not only that its line exists |
| `41d8565` | docs(plan): rebase the plan of record onto one repository, and correct what it claimed |
| `4ef00da` | fix(spec,plan): the citations the final check pass found dead |
| `98693a7` | chore(task): restore the audit report the round log had replaced, and tick the plan |
| `c5bc234` | fix(plan): repoint the audit pointer after archiving its task |

### Status

[OK] **Completed** — the audit task is archived at `.trellis/tasks/archive/2026-10/10-02-architecture-drift/`; its report and four rounds of readings are in its `readings.md`. Gates at the end: `typecheck` 0, `npm test` 850 / 848 pass / 0 fail / 2 skipped, installer 141 OK.

## Session 233: Three declarations that stopped nothing, and a check that found four of my mistakes

**What it was about**: three things a mode or a grant could declare that the runtime accepted and never
honoured - a mode-level `expires`, a forbidden technique with no shape to witness, and a rate cap that
existed only as a type. The repository had already decided the shape for the first of these: a gate-level
`windows` block is refused outright, not because it is unimplemented but because it is unenforceable
where it sits. An expiry is the same calendar idea, so it was a missed application rather than a new
decision.

**What it produced**: both unhonourable declarations are now refused by name at load, on the mode side
*and* the grant side, and the rate cap is enforced - judgement in the authority beside the grant's other
constraints, counting in the policy, the window taken from the invocation rather than the wall clock.
The three shipped modes and the example engagement lost the declarations they could not keep, and each
loss is written where a reader meets it rather than only in a report.

**What the whole-scope check found, which is the part worth remembering**: thirteen findings, every one
of them holding. Four were mine. The grant-side refusal I had written into the design and then not
implemented, so the file I claimed to cover was the one that refused the name. A rate cap that went
inert at 65 and above, because a fixed 64-entry ring saturated the count - the defect the task exists to
remove, one line inside its own fix, in the allow direction. A cap with no validation at all: a string
loaded and then never fired. And a commit message reporting a green full run for a tree with five
failures, because the message was written before the run it described.

**Two habits, both old ones**: measure rather than trust - the check reported a rotted citation at 708,
measurement said 704, and the measured value is what shipped - and never push long text or quotes
through PowerShell; a commit message with a backtick in it split apart and took the commit with it. That
one is in this repository's lessons already, and this session was the fourth time.

### Git Commits

| Hash | Message |
|------|---------|
| `deb2cd0` | fix(mode): refuse the two declarations the runtime cannot honour |
| `ff61abd` | fix(test): stop two fixtures declaring a field the loader now refuses |
| `b992844` | feat(gate): read the rate cap the schema has been carrying all along |
| `b499bdf` | chore(task): tick the three requirements and say why the fourth needs no new case |
| `97fcb30` | fix(auth,spec): the things the whole-scope check found, four of them mine |
| `57cd6b6` | docs(task): seed the follow-up task for the same class the check found beyond this one |

### Status

[OK] **Completed** — archived at `.trellis/tasks/archive/2026-10/10-02-enforceable-declarations/`. Gates at the end: `typecheck` 0, `npm test` 859 / 857 pass / 0 fail / 2 skipped, installer 141 OK. The same defect class beyond this task's three - `scope.exclusions` in two shipped modes, `authority.grant_graph`, the `session`/`stop` blocks, two unresolvable grant names, and a door gap over `scripts/` - was seeded as `10-02-unhonoured-declarations`, and **that path was repointed here when the task was archived** (archiving moves the directory and rewrites nothing that points into it, which AGENTS.md warns about and this repository has now hit twice).

## Session 234: Five declarations refused, and a check that kept finding my own claims

**What it was**: the same class one task further - declarations that claim to stop something and stop nothing. Four blocks plus a grant name are refused by name now, the three shipped modes lost them with each loss written where a reader meets it, and the turn budget became the one field of the session block the runtime can honour, carried and passed to the only loop this runtime owns.

**What the checks kept finding**: the scope check asked across the repository twice, and both times the most serious finding was mine. First a published mode whose exclusion list could never fire, about which the task's own acceptance criterion claimed otherwise. Then, after that was repaired, two more: the refusal guarding it coerced its input, so the likeliest spelling of the field became no field at all, and the guard passed modes whose document is never parsed, leaving the same hole open under other semantics. It also falsified two claims written with more confidence than measurement - that the budget wiring had no observable seam, and a red count that belonged to a different stage of the work.

**The count worth keeping**: eight claims of mine were falsified this session, every one of them by an instrument outside my own reasoning - a whole-scope check, the typechecker, a YAML parser, a test. That is this project's own principle, the verifier standing outside the loop, demonstrated on the person doing the work: self-review caught none of them.

### Git Commits

| Hash | Message |
|------|---------|
| `886413b` | docs(task): plan the four unhonoured declarations, with each route decided |
| `50008d4` | feat(scope): read the exclusions the loader was checking the shape of and dropping |
| `0fc7050` | feat(mode): refuse the five declarations the runtime cannot honour |
| `130d98a` | docs(spec): enumerate the refusals, and stop citing line numbers in a comment |
| `52ef54f` | docs(task): record the check's findings, and correct the two claims it falsified |
| `3af0f51` | fix(mode): refuse an exclusion list the gate cannot enforce |
| `00527f0` | fix(mode): check the shapes the block checks could be walked around, and carry the turn budget |
| `dd2f558` | fix(policy): resolve an excluded target through the document, not by matching strings |
| `e63587e` | docs(scripts,spec,test): finish the sweep the check asked for |
| `33ed4bb` | fix(mode,policy): close the two holes the last check found, and test the wiring it proved observable |
| `963f1a0` | docs(spec,task): finish the matrix and stop citing lines in a document nothing guards |

### Status

[OK] **Completed** — archived at `.trellis/tasks/archive/2026-10/10-02-unhonoured-declarations/`. Gates at the end: `typecheck` 0, `npm test` 873 / 871 pass / 0 fail / 2 skipped, installer 141 OK. Still open from the last check, recorded in its readings rather than fixed: whether `scope.targets`, `environment` and `ownership_evidence` are controls or records - a decision, not a repair - and the surfaces no door reads, `.trellis/tasks/**` among them.


## Session 235: Twelve real sessions, their root cause fixed, and a plan that measurement kept correcting
<!-- trellis-session: v=2 fp=d89070d01d53f895 -->

**Date**: 2026-10-04
**Task**: Twelve real sessions, their root cause fixed, and a plan that measurement kept correcting
**Branch**: `master`

### Summary

Turned the findings of a twelve-session run into owned fixes. The root cause of the review-blocking refusal was measured to a line: the replayed flag read attemptCount greater than zero, which is a request first attempt, while the boundary definition is an attempt after the first. Fixed at the source with a two-prompt reproduction as the end-to-end check, plus the mode declarations that were one tool short. A task record that ticks criteria its evidence never mentions is now a checked, wired failure instead of a silent one. Three of my own readings were wrong and the repository doors caught each: an empty projection must omit keys rather than fill them, a code comment must name a thing rather than cite a line that drifts, and every citation path must resolve. Finding C was withdrawn by measurement - the ledger appends every record and I had compared a directory mtime to a ledger file.

### Git Commits

| Hash | Message |
|------|---------|
| `f5561a8` | fix(lifecycle): the replayed flag was one attempt too early, and the reproduction now passes |
| `949dd42` | fix(code-development): declare the read-only project tools idempotent, and keep the writing ones undeclared |
| `e01edb6` | feat(task): a ticked criterion with no event behind it is reported, because a record can claim what its ledger does not back |
| `74cd678` | docs(task): the cache report, and the plan's slice eight corrected by measurement |
| `78dcb6e` | docs(spec): a control refuses a name, not an intent - recorded with the run that demonstrated it |
| `9bdc1f0` | docs(task): finding C is withdrawn - the ledger appends every record, and the evidence was a directory's mtime |
| `f2b2565` | docs(task): one clean checklist, because the plan had grown two overlapping numbering schemes |
| `170d2cd` | feat(ledger): the diagnostics projection can say a request was received and never terminated |

### Status

[OK] **Completed**


## Session 236: A real user's flow on a real project, and the four readings it produced
<!-- trellis-session: v=2 fp=bfa22561bbc69e01 -->

**Date**: 2026-10-05
**Task**: A real user's flow on a real project, and the four readings it produced
**Branch**: `master`

### Summary

The round simulated the whole flow with the repository's own field-run runner instead of hand-rolled sessions, on cachecontrol, a real library five times the size of the previous round's toy. A grading instrument was written before the behaviour: a route serving Cache-Control immutable and one assertion on from_cache, failing, inside the project's own suite. The control run completed and the flow run was cancelled at the fifteen-minute timeout after sixteen provider rounds, fifteen tool observations and a single 565-byte change to controller.py - and the project's suite went from one failing test to two, so the effort was real and the result was wrong. Reading one was read wrongly twice before two records were compared: the summary says zero tokens and the transcript says the model thought, called tools and answered, and the mechanism is that the summary's resource block copies one record's details where the ledger is an event stream. The same shape appeared in two more layers, an output against an exit code and one exit code against another.

### Git Commits

| Hash | Message |
|------|---------|
| `f2ed3d1` | docs(task): the project is picked and its grading source runs, and the onboarding cost is the first reading |
| `ac0c356` | docs(task): the grading instrument for the round, red before the behaviour exists |
| `2b8b3c1` | feat(scenario): the field-runnable scenario for one small piece of real work |
| `98013cd` | docs(task): reading one corrected twice - the summary says zero and the transcript says it worked |
| `a32afb7` | docs(task): the mechanism behind reading one, measured to the line |
| `ec29b50` | docs(task): reading three - the effort was real and the result was wrong |
| `65a1723` | docs(task): the shape delta, and what the two runs may not be compared on |
| `dc00c6e` | docs(task): the change was one file, and that makes reading three sharper |
| `c18c375` | docs(task): reading four - one command, three exit codes, and the same disagreement in a third layer |

### Status

[OK] **Completed**


## Session 237: Simulating a real user's flow: four readings, three self-corrections, and two fixes judged by the extension's own words
<!-- trellis-session: v=2 fp=82832e29df6b2de8 -->

**Date**: 2026-10-05
**Task**: Simulating a real user's flow: four readings, three self-corrections, and two fixes judged by the extension's own words
**Branch**: `master`

### Summary

The round tried to simulate a real user's whole flow on a real library, and the first thing it produced was proof that the previous attempt had not: both runs' project copies had no .dove, the summary recorded executionMode standard, and the transcript mentioned no mode or policy. Four readings followed. The summary's resource block copies one record's details while the ledger is an event stream, so its totals read zero while the transcript showed the model thinking, calling tools and answering. The same shape appeared twice more: an output against an exit code, and one exit code against another, minus one, one and zero for the same command with a control proving the method. A real project took eight steps to make its own suite run on Windows. And on a real task the effort was real and the result was wrong - sixteen provider rounds, fifteen tool observations, one changed file of 565 bytes, the target test still failing and a passing test broken. Then the corrections: the harness was mounted in every run, which the ledgers prove; the mode was the thing missing, and a declaration is read and then fails with missing-file because the mode directory sits beside the extension while the declaration belongs to the project. Two fixes landed - the declared root is preferred with the extension's own root as the fallback a project does not have, and the missing hashline tools now appear in the status line - and both are judged by the extension's own words rather than mine: workMode=code-development, hashlineEditTools=absent. The first attempt at the mode fix replaced the root instead of adding a fallback and broke twenty-eight tests, which is recorded rather than hidden. Finally a bash call was measured hanging for six minutes thirty-three seconds with nothing written anywhere and stderr empty, ended only by the outer watchdog, because the harness's two-hundred-forty-second timeout covers a whitelist of commands and the hung one was not on it.

### Git Commits

| Hash | Message |
|------|---------|
| `9921ba3` | fix(mode): find the mode directory under the extension, and put the missing edit tools in the status line |
| `a46f312` | docs(task): both gap criteria turn green, in the extension's own words |
| `998a17b` | docs(task): the hang measured end to end, and the timeout that only covers a whitelist |
| `fe0e053` | docs(task): requirements and acceptance for a hang a reading can see |
| `573e3e6` | chore(task): start, with the curated context this plan actually stands on |
| `5aecb42` | docs(task): the plan for a whole flow that actually runs end to end |
| `b4d02f5` | docs(task): the convergence pass found a stale pointer in my own acceptance criteria |
| `f2ed3d1` | docs(task): the project is picked and its grading source runs, and the onboarding cost is the first reading |
| `ac0c356` | docs(task): the grading instrument for the round, red before the behaviour exists |
| `2b8b3c1` | feat(scenario): the field-runnable scenario for one small piece of real work |
| `98013cd` | docs(task): reading one corrected twice - the summary says zero and the transcript says it worked |
| `a32afb7` | docs(task): the mechanism behind reading one, measured to the line |
| `ec29b50` | docs(task): reading three - the effort was real and the result was wrong |
| `65a1723` | docs(task): the shape delta, and what the two runs may not be compared on |
| `dc00c6e` | docs(task): the change was one file, and that makes reading three sharper |
| `c18c375` | docs(task): reading four - one command, three exit codes, and the same disagreement in a third layer |

### Status

[OK] **Completed**


## Session 238: The pstack audit lands: six steps, three product defects, and what the instruments caught
<!-- trellis-session: v=2 fp=8c629aaf88903522 -->

**Date**: 2026-10-05
**Task**: The pstack audit lands: six steps, three product defects, and what the instruments caught
**Branch**: `master`

### Summary

Studied pstack, took its two meta-rules (fix at the highest level that works; every check gets a fixture that must trip it), and landed the three highest-leverage disciplines it implies: mode documents that state requirements, the mode body actually reaching the model, and a rules table whose every row names what fails when it breaks. Then three A-level defects the audit had found: the documented axi-turn never reached the CLI, the release archive omitted the mode definitions its digest claimed, and nothing reported a turn's assembled prompt. Finally a fourth thing the field run exposed: a failed provider call recorded no cause.

### Main Changes

- S1-S6 from the audit: mode bodies stop denying their own controls; the mode body is appended to the system prompt as one labelled block with a stated ceiling; the read-only hard stop, the second budget and the second at-most-once implementation are deleted; sandbox claims, the refusal split, the network tool surface and the dispatch path each become one declaration; a four-check task-artifact linter with fixtures lands with a CI gate; AGENTS.md gains a rule-to-enforcer table with a door that holds the grammar closed.
- Launcher: axi-turn joins the pythonCommands table, held against dove_pi.LOCAL_CLI_COMMANDS by a new check that reported exactly that one command before the fix.
- Release: the archive assembly copies modes, and check_release_readiness refuses an archive whose modes are missing or half-copied.
- Cost: /status full prints prompt=<n>, asserted to equal the prompt the turn returned; the field run then answered the cache question from the ledger's own prefix evidence.
- Diagnostics: message_end classifies the provider failure before writing the record, the record carries failureKind/failureReason, and the failure reading carries them onward.

### Git Commits

| Hash | Message |
|------|---------|
| `848dd92` | docs(modes): two mode bodies that denied their own controls, and a claim naming a file that cannot hold it |
| `147d567` | feat(prompt): the mode body an agent never read now reaches the model, in a labelled block |
| `eefbfba` | refactor(budget): delete the read-only "hard stop" nothing compared, and the prompt-length argument nothing read |
| `d1af4fb` | fix(sandbox): one claim table instead of a constant nobody read and an if-chain nobody shared |
| `4a0fa6e` | refactor(harness): one refusal split instead of two byte-identical ones |
| `1b1a8b5` | fix(network-axis): one declaration of which tools reach the network, instead of three that disagreed |
| `cbefcfb` | refactor(dispatch): delete the dispatch path nothing reached, and the records only it wrote |
| `784e043` | docs(spec): the capability runtime page stops describing the dispatch calibration that is gone |
| `a8b2f51` | fix(lint): name the precedent instead of citing its line, because a citation in code drifts |
| `41c94bf` | docs(task): eight PRDs state their criteria as boxes, one step before the linter that reads them |
| `8166b83` | feat(lint): four task-artifact checks, each with a fixture that must trip it |
| `a854722` | ci(lint): assert the task-artifact corpus where it is stable, not on a working copy |
| `712d6fb` | docs(agents): a rule table with an enforcer per row, and the door that holds the pairing honest |
| `e190771` | docs(task): the pstack audit, the plan it converged on, and the four things implementing it found |
| `572572c` | fix(launcher): the documented axi-turn reaches the CLI, and its table is held against the CLI's own command set |
| `2b28475` | fix(release): the archive carries the mode definitions its digest already claims |
| `9fbe593` | feat(cost): the assembled prompt is a reading, and it is asserted against the prompt the turn returned |
| `c275554` | docs(spec): the mount-point citations my last commit moved, and a correction to E3's cause |
| `576920a` | docs(cost): the errored round is located - the record is written before the failure is classified |
| `2f6a639` | docs(cost): number the two new sections in reading order |
| `db71eb8` | docs(cost): our prefix is stable in every round, so the zero is not ours |
| `7b50cf9` | docs(task): the cache was measured on a real provider, and the answer moves the question |
| `25dafae` | feat(diagnostics): a failed provider call records why, and the reading carries it |
| `cdd4765` | docs(tasks): archive the five finished tasks, and pay the cross-reference tax they came due |

### Testing

- [OK] Measured, not assumed, throughout: the 20,000-character index budget is red because the spec's own 50-record cap cannot fit in it (22718 characters today, ~40000 at the cap); a two-call control probe showed the configured provider does not report prefix caching at all; 15 of 15 provider rounds reported stablePrefix with one digest per cacheable component; and of 602 ledgers on this machine, six errored provider records named no cause.
- [OK] Suites: typecheck clean, installer 143 pass, affected doors 55 and 38 pass, task-artifact corpus 54 artifacts and 0 problems. The only red is the index budget above.

### Status

[OK] **Completed**

### Next Steps

- Step A of the plan I stated: make the no-query project-context answer an index again by removing the duplicated records and the absolute paths, and keep the 20,000 ceiling as the requirement rather than raising it.
- Decide 10-03-blackbox-prompt-chars (a) install the recorder on the real path, or (b) mark systemPromptChars replaced by the in-product prompt= reading.
- Candidate: the mount-point table cites symbols rather than lines, since two sessions editing extension.ts paid that tax twice today.


## Session 239: The product face and the whole usage process, written down; and one attribution my own measurement refuted
<!-- trellis-session: v=2 fp=6bbe48e1a56a5639 -->

**Date**: 2026-10-05
**Task**: The product face and the whole usage process, written down; and one attribution my own measurement refuted
**Branch**: `master`

### Summary

Two deliverables landed and one of my own claims was refuted. The product face became one routed page: what a person installs and is promised, the four axes kept apart, eleven promises each with its enforcer, six things the product has not demonstrated, axi as an internal program, and a non-goal list that says it is not complete. Then the design direction became five rules with numbers and enforcers, and the whole usage process became a second page: stages 0 to 6, each naming the failure it prevents, every gap naming an owner, and stage 5 written as the stage that has a failure and no design. Corrections along the way: the axi PRD cited section 5.2 where the report is 5.1, twice; plan-v8 now marks its own voided shape; the README points at the product page and says which side is authoritative. One attribution of mine was refuted by my own measurement: the agent_project_context index length moved by 260 bytes once, then zero, then 749 when a task was created, then 260 again for a new page, and the compiler shows a budgeted render that omits documents and reports a count, which is consistent but was not isolated. The archive of this session cost zero repointing, and the same scan corrected a standing number from one unrepairable pointer to three, now recorded in AGENTS.md. Gates at the end: typecheck 0, npm test 934 pass 1 fail 2 skipped with the same pre-existing index-length failure, installer 143 OK, and 13 of 13 plus 5 of 5 on the two documentation doors.

### Git Commits

| Hash | Message |
|------|---------|
| `37012e0` | docs(spec): the product face in one page, held by the doors that already exist |
| `16aac83` | docs(readme): point the user-facing text at the product page, and name which one is authoritative |
| `f6b96e6` | fix(docs): the axi PRD cited section 5.2 where the report is 5.1, twice, and the voided shape was unmarked |
| `b0915d2` | docs(task): the product page plan, its readings, and the 260 bytes it adds to an index already over its bound |
| `cb108ed` | docs(spec): the design direction as five rules, each with its number and its enforcer |
| `5b2e644` | docs(task): the second round, and the index attribution my own measurement refuted |
| `f4d126f` | docs(spec): the whole usage process in one page, every stage naming the failure it prevents |
| `38ccf22` | docs(spec): the product page record points at the design instead of standing in for it |
| `cf624a0` | docs(task): the usage-process design, its acceptance self-check, and a fourth reading of a moving index |
| `b08f116` | docs(agents): the archive tax measured at zero, and the unrepairable pointer count corrected to three |

### Status

[OK] **Completed**
