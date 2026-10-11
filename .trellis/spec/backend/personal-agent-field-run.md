# Personal Agent Field Run

> **Scope:** Running Dove against a real provider on purpose: the invocation, the preconditions a person supplies,
> the reading it records, what that reading may and may not be compared to, and the boundary of what a field run
> proves.
>
> **Canonical router:** [Personal Agent Runtime Contract](./personal-agent-runtime.md)

A field run is a **measurement**, never an assertion. Nothing in this specification fails a build.

**Three things in this repository are called a corpus, and they are not the same thing**, so a reading should name
which it means: the **summary** is what `summarizeCorpus` returns over the ledgers a caller hands it (its notes array is
the field named `corpus`); the **coverage field** is what one reading does *not* contain, in `src/core/failure-reading.ts`
(the sentence a reader would otherwise take as a clean result); and the **external corpus** is a distribution a paper
measured - `2609.30217`'s evasion rates, cited at `src/core/argument-syntax.ts`. The first two share an identifier across
two modules that mean different things by it, and only the second is about an absence.

## Scenario: Real-Provider Field Run

### 1. Scope / Trigger

Trigger: a change whose effect is only visible with a real model behind the adapter — evidence capture, the
resource observation, tool-name extraction, terminal classification — or a release where nobody can say when the
last field run was.

**Why this is its own specification.** The subject is *field evidence*, not the harness's own instruments:
`personal-agent-harness-loop.md` owns the loop that reads evidence the harness wrote, and this owns the one reading
no deterministic run can produce. It is a separate document because that one is at its budget — measured when this
was written, the harness specification had **270 bytes** of its 24 KiB left, so this contract could not be folded
into it. The same budget contract applies here.

### 2. The Invocation

```powershell
node scripts/real-dove-blackbox.mjs --launcher source --provider real `
  --cwd <the project to work in> `
  --scenario tests/fixtures/scenarios/read-only-audit.json `
  --output <a path outside this repository>\run.jsonl --timeout-ms 900000
```

Preconditions, every one of which a **person** supplies:

- **Credentials, and the tool surface that comes with them.** The runner carries `settings.json`, `models.json` and
  `auth.json` from the operator's agent directory into the run's own session directory, and records what came in **by
  name** — never any contents. This is why the mode is usable at all: `PI_CODING_AGENT_DIR` points the run at an
  isolated directory, and before the carrier existed a real provider was reachable but unusable. Credentials are
  configured by hand; nothing here manages them. **The agent directory's package store (`npm/`) travels with them**,
  because `settings.json` declares the Pi packages and Pi resolves them from that store: carrying the declaration
  alone left every one of them unloadable, so a run's tool surface was not the operator's and `hashlineEditTools` read
  `absent` against a host that has those tools installed. Measured 2026-10-05 on a bound clone: with the store present
  the same status line reads `hashlineEditTools=present` and the remaining extensions load with it. It is a copy, so a
  run still cannot touch the original, and it is the one carry that costs real time — deterministic cases are
  `--provider faux` and pay none of it.
- **An output path outside this repository.** A field run's raw evidence is never committed.
- **Room for the retries a long run needs.** `DOVE_PI_MAX_REQUEST_ATTEMPTS` is the operator's own knob - published in
  `dove-pi --help`, read by the extension, and forwarded because the runner passes the parent environment through - so
  a run can be given more attempts without changing a line of this repository. **It is a precondition and not a detail**,
  because it is the binding constraint on any run long enough to finish real work: measured 2026-10-11, the whole-flow
  run that completed used **four** attempts in its first request against a default of three, and the two runs before it
  had died on `provider-attempt-limit` with the work already done. Set it, and record it as the run's setting; what it
  does to the reading is a contract below.
- **A scenario whose `requires` field is satisfied.** See below.

`--scenario` selects what the user does. A field run reads the same scenario files the deterministic cases read,
but **most of them are not field-runnable**. `read-only-audit` declares `requires: a real provider`. The others
drive harness machinery — `--progress-case changing`, `--dialog-case write`, `--reuse-session`, a low message cap —
and two say in as many words that they need "nothing beyond the default faux responses". Their assertions are
written against **scripted** events, so pointing a real model at them does not test what they assert.

### 3. Contracts

- **A field run is a measurement, not an assertion.** It never enters `npm test` and is never a gate. The reading
  is not reproducible: the provider, the endpoint and the model drift, and the same command on another day is a
  different experiment. A gate built on it would fail for reasons that are not the change's fault, which is the
  false assurance this contract exists to prevent.
- **Record the provider, the endpoint, the model and the date with every reading, and state that it is not
  reproducible.** Without those four, a later reader cannot tell a regression from a different model.
- **What may be compared is the shape, not the values.** Two readings are comparable in which fields are populated
  and which relations hold between them — for example, that the goal line's provider count, the resource
  observation's `providerRounds` and the length of `stopReasons` agree with each other. They are not comparable in
  the numbers themselves.
- **A raised attempt budget shows the flow, not the default.** A run given ten attempts is evidence that the flow can
  complete, and says nothing about whether it completes under the shipped three. Both numbers go in the reading and
  neither stands for the other. What that bound protects is unchanged either way: the non-idempotent effect refusal does
  not consult the attempt count, so a started effect stays refused however this is set.
- **Declaring a scenario field-runnable is a claim about its assertions.** A scenario is field-runnable when its
  `requires` names a real provider **and** its steps assert nothing about scripted events. A scenario whose
  assertions count deterministic provider responses is not field-runnable at any wording.
- **The most recent reading is recorded below, and nothing verifies how recent it is.** It is a line a person
  updates. No check reads it, so a stale one is stale silently — which is why it is labelled a record and not a
  guarantee.
- **A field run proves the shape of a session, never that the agent did the work correctly.** See section 5.

### 4. Reading Format and Its Comparison

A reading is recorded in the task record that produced it, in this order:

```text
scenario / provider / endpoint / model / date
launcher / providerMode / carriedConfig / exitCode / settled / harnessTimedOut / events / duration
terminal: reason, detail, code
resources: toolCalls, providerRounds, elapsedMs, toolDurationMs
tokens: inputTokens, cacheReadTokens, cacheWriteTokens, outputTokens, reasoningTokens
stopReasons (the list, not only its length)
tools the model actually called, with counts
dialogs: approved / declined / answered / cancelled / defaulted / mismatch / unused
terminalConsistency / closeWaitMs
```

**Worked example.** The reading below is the run from 2026-09-29 that confirmed four adapter fixes. It is the
record of the most recent field run known when this was written. **It is not reproducible**, and it must not be
read as a baseline to re-run against.

```text
scenario=read-only-audit  provider=ant  endpoint=api.atria-asi.ai  model=Atria-Dawn-Preview  date=2026-09-29
launcher=source  providerMode=real  carriedConfig=[settings.json, models.json, auth.json]
exitCode=0  settled=true  harnessTimedOut=false  events=208  duration=49.2s
terminal: reason=failed  detail=non-idempotent-effect  code=retry-refused-after-effect
resources: toolCalls=7  providerRounds=4  elapsedMs=46770  toolDurationMs=274
tokens: input=29136  cacheRead=640  cacheWrite=0  output=320  reasoning=116
stopReasons: [tool_call, tool_call, tool_call, error]
tools the model actually called: read x5, bash x2
dialogs: approved=0 declined=0 answered=0 cancelled=0 defaulted=0 mismatch=0 unused=0
terminalConsistency=completed-ledger-only  closeWaitMs=51
```

Read as a shape, this example carries three claims a deterministic run cannot make: the goal line's provider
count, the observation's `providerRounds` and the length of `stopReasons` are all 4 and therefore agree; the
extracted tool names are non-empty and account for every tool call; and the terminal's `nextAction` names the
non-idempotent action the request actually ran.

**One line of that reading is history rather than current behaviour.** `detail=non-idempotent-effect
code=retry-refused-after-effect` is what the run ended with on that date. A measured probe of Pi's provider retry
then showed the tool is executed once across three provider calls, so the refusal no longer fires for a transient
provider failure; it now fires only for the overflow replay, at `session_before_compact`. The recorded reading is
left as it was recorded - a reading is evidence of what happened, not a baseline to re-run against, which is the
rule the paragraph above already states.

### 5. Fidelity Boundary

A field run does **not** cover, and must not be cited as covering:

- **Whether the agent did the work correctly.** The run proves the shape of a session, not the quality of its
  result.
- **TUI rendering, shortcuts, the status bar, and custom components.** Pi's headless surface is RPC, and these are
  not part of it.
- **Real provider rate limiting and network variance.** A single run samples one path through one endpoint.
- **Dialogs other than `confirm`.** The harness cannot reach the rest unattended.
- **`providerEvidence`.** It is empty for a real provider **by construction**: the capture is written inside the
  faux provider, so a real run has no such entries. A reader who expects them is expecting something this mode
  cannot produce.

### 6. Tests Required

- The routing and budget checks hold: this specification is linked by the router and named in
  `tests/spec-context-budget.test.ts`, keeps **exactly one** second-level heading, and stays at or below 24 KiB
  measured as LF-normalized UTF-8.
- The backend index lists this specification.
- Every path this specification names inside a code span resolves from the repository root.
- `tests/real-dove-blackbox.test.ts` is declared as verifying a component in `.trellis/harness-surface.yaml`, and
  every entry in that declaration resolves.

### 7. Wrong vs Correct

Wrong: put a field run in CI so real-usage regressions are caught automatically. Record a reading without the
provider and the model, so the next reader reads a model change as a defect. Declare a scenario field-runnable
because the file exists, when its assertions were written against scripted responses. Cite the most recent reading
as evidence that the path still works today.

Correct: run it on purpose, with credentials a person configured, against a scenario that declared a real
provider; record the provider, endpoint, model and date beside the reading and say it is not reproducible; compare
shapes rather than values; and leave the judgment — whether the shape is right — to a person with the reading in
front of them.
