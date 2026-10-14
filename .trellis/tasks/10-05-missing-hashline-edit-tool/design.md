# Design: what to do when a declared package is not in the store

## The gap, restated from the corrected premise

The task's original sentence - the host does not provide the hashline edit tool - was wrong, and the correction is in the
PRD: the host has it, the *field runner's carrier* shipped the declaration without the agent directory's package store,
and that is fixed. What the correction leaves standing is the general case it was hiding:

> a session starts, `settings.json` declares packages, and one or more of them is not in the store the runtime resolves
> from - so the declared tool surface is not the tool surface the agent gets, and nothing at start says so.

That is a real shape for a customer too, not only for the runner: an agent directory can lose its store, or gain a
declaration for a package that failed to install. The measured consequence, from this task's own record: the session
looks from the outside exactly like one that had the tools.

## The two halves of the question, and only one is still open

- **Is the missing family visible as a reading?** **Already answered, and by a field that exists**:
  `extension.ts:1280` emits `hashlineEditTools=present|absent` from `hasHashlineEditTools(pi.getAllTools())`
  (`extension.ts:1256`). So the first of the PRD's two open items is satisfied by the status line, and this design does
  not add a second field for the same fact - the front door's own rule about one declaration read through a derived view
  applies to readings too.
- **Should a session be refused?** This is the open one, and it is the operator's call. The design lays out both
  branches and recommends the second, because the measurement supports it:

| branch | what it does | the evidence for and against |
|---|---|---|
| **(i) refuse the session** | a declared-but-absent package stops the run, as an unenforceable mode claim does | **against**: the corrected measurement says the agent was *not* without editing tools - it used the host's `edit` three times in the same turn - so refusing would take a working session away for a missing *optional* family. It would also make the runner's carrier a hard dependency of every session rather than of the run |
| **(ii) load and record** | the session runs, and the reading says what the surface is missing | **for**: the fact is already in the status line, and the PRD's own worry - that the session looks the same from outside - is exactly what a reading answers. **Cost, stated**: a reader who never opens `/status` still does not know |

**Recommendation: (ii), with the record placed where a reader meets it rather than where they have to look** - the same
mechanism the sibling task uses for a mode's unkept claims: the start line a person already reads, plus the status field
that already exists. If the operator chooses (i), the design changes shape: the refusal belongs beside the unenforceable
mode claims (`extension.ts:2420`), it must say **which** package and **which** store it looked in, and it must not fire
for the runner's own carrier, which is a run's configuration rather than a person's.

## Files this changes, and why each is necessary

| file | why |
|---|---|
| `src/pi-adapter/extension.ts` | the declared-versus-present comparison, and the sentence on the start line; under (i), the refusal beside `:2420` |
| `tests/host-work-mode.test.ts` or `tests/pi-adapter.test.ts` | the case: a declaration with no package behind it is **reported**, and a declaration that is satisfied is silent |
| `.trellis/spec/backend/personal-agent-field-run.md` | the carrier's list already travels here; the sentence that says what a run reports when a declared package is absent belongs with it |

## What this is not

- **Not a package manager.** Nothing installs, repairs or removes a package; the design reports a disagreement.
- **Not a second reading field.** `hashlineEditTools=` already carries this fact for the family it names; the new
  sentence names the *declaration*, which is a different subject and is why it is not the same field twice.
- **Not a change to which tools the host provides.** That is Pi's, and the correction in the PRD is what settled it.

## How the change is shown not to alter behaviour

Two cases in one file: a satisfied declaration produces the line it produces today (the control), and an unsatisfied one
produces a line that names the package. Under (ii) no session is refused, so every existing mode and tool-surface case
must stay green unchanged - which is the strongest available statement that only the reading moved.
