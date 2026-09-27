# Bounded Harness Improvement

The instruments this harness uses to improve itself from its own evidence, and the boundaries that keep that
improvement **bounded**: what the axis reads, what a failure left behind, what a change predicted and what the round
after it decided, and the surfaces an edit is allowed to touch at all.

These contracts were spread across three specifications until the two that carried them reached their caps. They are
one subject - the loop - so they are one document; the evidence they read is still documented where it is produced.

## Scenario: Bounded Harness Improvement

### 1. Scope / Trigger

Read this before changing how the harness improves itself: adding an instrument, deciding what a change earned, or
letting a record act on its own reading. Nothing here acts. Every one of these contracts **reports**, and the record
that reports says so in a field a reader can check.

### 3. Contracts

- **The Safety & Stability axis (`src/core/harness-axes.ts`) is a read-only projection of the append-only
  execution ledger**, never a second source of truth: a `crash-free ratio` over `request.terminal` reasons and
  `sandbox violations` over `gate.refused` labels, plus a **declared** list of the axes it cannot read.
  - **A terminal reason is classified by a table we state**: `completed` is clean; `recovered` is reported
    beside the ratio and never folded into it; `cancelled` and `superseded` are interrupted; the five
    startup/authorization/`failed` reasons are failures. The table is keyed by the reason union, so **a new
    reason fails the typecheck** rather than defaulting, and the test enumerates the closed set.
  - **No data is not no failures**: a ledger with no terminals yields `undefined` ratios, never `1.0`. A
    perfect score from no evidence is the failure this project keeps finding in its own files.
  - **A recorded refusal label may be composite** (`gates.join("+")`) and is split into its atoms - the same
    rule the observation reader applies, so the axis and the record agree about what a refusal is.
  - **The reading is printed, never asserted**: `scripts/harness-axes.mts`, exit status 0 in every case,
    including "no ledger found". A threshold is a decision with its own evidence.
  - **This contract lives in this document because the loop has its own specification now.** It was filed in the
    evidence plane only because the specification that documents `request.terminal`
    (`personal-agent-request-runtime.md:332`) had reached its 24 KiB cap, and it moved when the loop contracts did.
- **`change.decided` is the validation half of the loop, written at the round boundary.** A verdict existed only as
  a function computed on read and discarded, which reports and does not accumulate: the manifest is bounded and lives
  in one task, so a change whose verdict is still `pending` falls out and stops being recomputable. So the round that
  makes a verdict readable records it, **once per change**, with `verdictOnly: true`.
  - **The round boundary is the only writer**, and the status read stays read-only; deciding in a read would make
    `status` a mutation.
  - **The memory is the ledger**, not a process-local set: a set would re-decide every change after a restart and the
    record would claim two revisions for one decision.
  - **`pending` is never recorded.** It means the next round has not happened; writing "not yet" every round for every
    change is noise. `unobserved` **is** recorded, because it is an answer - the prediction named something the record
    does not carry - and it is not the same as no decision.
  - **The record reports and never acts.** Nothing on that path reverts an edit, mutates a criterion or refuses a call,
    and `verdictOnly` is what lets a reader tell a reporting record from an acting one.
- **The failure reading (`src/core/failure-reading.ts`) is the mining half of the loop: a pure function of the
  ledger that turns an unsuccessful request into a bounded record.** It reads; it clusters nothing, ranks nothing and
  proposes nothing.
  - **The class and the mechanism are separate fields.** `reason` is one of the nine terminal reasons (usually
    `failed`) and `terminal.code` is what actually went wrong - `provider-attempt-limit`,
    `retry-refused-after-effect`, `model-budget-rejected`. Two requests that share the class and differ in the
    mechanism must not read the same, which is the distinction Self-Harness says is usually missing.
  - **Which terminals count as failures is the SSM axis's rule** (`classifyTerminal`), not a second one, so the
    reading and the axis cannot disagree.
  - **A refusal is attributed to a request by id, never by ledger position.** The four `appendGateRefused` sites
    pass the live `requestId`, and a refusal that carries none is **counted in `unrefused` rather than guessed
    at**: `issueRequestHostAbort` can settle a previous request after the next one has been received, so position
    would attribute a refusal to the wrong request.
  - **A convergence refusal is a terminal, not a gate refusal.** That path aborts the request instead of refusing one
    tool call, so the ledger holds a `request.terminal` with `origin: convergence` and no `gate.refused` record -
    which is why the reading attributes from the terminal's origin as well as from refusals.
  - **The component attribution is stated, with its evidence, or it is `unattributed`.** A refusal points at
    `middleware` (the policy that refuses); a provider outcome points at nothing of ours. An invented attribution
    would point an edit at the wrong file, which is worse than saying the records do not determine one.
  - **An empty corpus is a finding.** The reading reports how many requests it examined and what the corpus does not
    contain, so "nothing failed" cannot be read as "the reader is broken".
  - **A failing tool leaves no record at all**, because `appendToolObserved` is called only when the tool did not
    error - the same write is what offers the observable marker a passing criterion may cite. A failure record
    therefore cannot name the tool that failed. **Recorded as a decision, not an oversight**: recording an errored
    tool would also make its id citable by a pass, which is a change to the citation rule rather than to telemetry.
  - **The reading prints and never asserts** (`scripts/harness-failures.mts`, exit 0 always), like the axis.
- **The declared editable surface** (`.trellis/harness-surface.yaml`, `src/core/harness-surface.ts`) is the
  file-level representation of the harness's own components: AHE's requirement that "every editable harness
  component [has] a file-level representation so the action space is explicit and **revertible**". The seven
  components are the ones `CHANGE_SURFACES` names, and the declaration binds each to workspace-relative paths.
  It is recorded here because it is the bounded context a proposal is made from and because the evidence-plane
  specification in `personal-agent-framework-core.md` is near its cap.
  - **Every entry must resolve**, refused as `component:path` when it matches nothing: a map whose entries are not
    real names an action space that is not there.
  - **It is not a partition.** One path may belong to two components (`extension.ts` is a tool description *and*
    middleware); forcing a partition would make the map lie about one of them.
  - **One vocabulary**: the parser refuses a component outside `CHANGE_SURFACES`, and a test asserts they agree in
    **both** directions.
  - **It belongs to the harness, not to the workspace a run happens to be in**, so it is resolved from the
    extension's own root and its entries resolve against the same root. Reading it from the current workspace was
    the first implementation, and a host test in another project refused it: every entry looked missing for a map
    that was there all along. A project-level map is a different declaration, not built.
  - **A missing or broken map is reported, not fatal**: the status read returns `surfaceIssue` with the reason and
    the rest of the read is unaffected.
  - **`revertible` is a convention here, stated rather than assumed**: one logical harness edit is one commit,
    which is what gives an edit a revert and what a change manifest's `fix` describes.

- **`change.applied` binds a change to the commit that embodies it, and is what makes an edit revertible.**
  AHE requires the action space to be explicit **and** revertible; the surface declaration made it explicit, and until
  this record existed nothing gave a revert a target - "which commit was change X" was unanswerable. It is a **ledger**
  record, not a convergence event: the ledger holds what happened, the convergence record holds goal state, and an
  application is not goal state.
  - **The runtime records the claim and a script checks it.** The runtime cannot reach git, and a process spawn on the
    request path to check one claim would be a control where a reading belongs. `scripts/harness-rounds.mts` checks,
    where git and this project evidence readings already live.
  - **Three refusals, each naming what is wrong**: an unknown change id (a prediction must be pre-registered, so a
    commit naming no change is an edit nobody predicted); a second application for the same change, naming the commit
    already recorded (one commit per logical edit is what gives the revert its granularity); an empty commit.
  - **The check is `surfaceFit`, against the declared paths of the surface the manifest named**, using the fence own
    rule through `declaredPrefixHit` rather than a second implementation of it. It answers **`inside`**,
    **`outside`** with the offending files named, or **`unresolved`** when the commit cannot be resolved - a third
    answer and not a nicer word for `outside`, because "the edit went somewhere it declared it would not" and "nobody
    could tell" are different facts and only one of them is about the edit.
  - **A file outside the declared component reads `outside`, and that is information rather than a violation.** A
    manifest names one component; an edit that also changes the specification, the declaration, or another component is
    a fact worth seeing, not something to hide by widening the claim - and a component implementation surface includes
    its own tests, or every real edit would read `outside`.

- **`scripts/harness-corpus.mts` summarises the recorded corpus, and says why it is empty when it is.** Mining needs a
  corpus rather than one ledger, and this is the reading that answers "what do we have" once instead of per round.
  - **Every count comes from a rule that already exists**: the terminal classes are the axis classification, the
    failures are the failure reading, and the refusal labels are the axis refusal split (exported as
    `gateRefusalCounts`, one rule for three readers). A corpus summary that derived any of them again could disagree
    with the instrument it is summarising, and a reader would have no way to tell which was right.
  - **What is missing is part of the summary, with its measured cause.** A corpus with no failure record says so **and**
    names why: the paths that produce one are driven by host tests whose state directories are created with
    `mkdtempSync` and go away with the run, while the blackbox runner keeps the ledgers of runs that did not fail. The
    surviving corpus is skewed by **which runner keeps its ledgers**, so "zero failures" is a statement about what was
    kept rather than about the harness.
  - **It walks and says what it walked**, skipping `node_modules` and `.git`, counting an unparseable ledger as empty
    rather than stopping, and printing rather than asserting - exit 0 in every case, including a root that does not exist.

### 4. The Turn, in Order

The steps a turn is made of, because instruments only become a loop when someone runs them in this order:

1. **Mine.** `scripts/harness-failures.mts` over the ledger. A failure record names the class, the mechanism, the
   refusals that preceded it, and the component the evidence points at - or says it cannot tell.
2. **Choose a surface, and check it is one.** The seven components of `.trellis/harness-surface.yaml`, reported by
   the convergence status read. An edit outside the surface is not bounded, whatever its merit.
3. **Record the prediction first**, with `operation=change`: the surface, the failure evidence ref, the root cause
   **distinct from the verifier-level cause**, the fix, and at least one predicted movement from the closed set. The
   runtime reads the baseline itself, which is why a caller cannot supply one. A change with nothing predicted is a
   rationale.
4. **Make the edit as one commit.** One logical edit is one commit, which is what gives step 6 a target.
5. **Record the application** with `operation=applied`, naming the commit.
6. **Let the next round decide.** `change.decided` is written at the round boundary, once per change, with the verdict
   the movements support - and `contradicted` is recorded as readily as `confirmed`, because an edit that failed to do
   what it predicted is what the loop most needs to learn from.
7. **Print the turn** with `scripts/harness-rounds.mts`, then keep or revert **as a person with that output in front
   of them**. Nothing here acts: the record reports, the reading prints, and reverting is
   `git revert <applied commit>`.

### 5. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| A surface entry that resolves to nothing | Refused, naming the entry as `component:path` |
| A component outside `CHANGE_SURFACES`, or one with no paths | Refused, naming the components there are |
| A missing or unreadable surface declaration | `surfaceIssue` on the status read; the read itself is unaffected |
| A refusal recorded with a live request | Carries `correlation.requestId` for the request it refused |
| A refusal with no request id | Counted as unrefused by the failure reading; never attributed by position |
| A terminal whose mechanism is unfamiliar | Emitted with the mechanism carried through; never dropped |
| A request whose converged state will not take an event | The ledger names the state; the convergence record is untouched |
| An application naming a change the record does not carry | Refused, naming the id; the manifest comes first |
| A second application for one change | Refused, naming the commit already recorded |
| A commit that cannot be resolved | `unresolved`, never reported as inside or outside |
| A touched file outside the declared paths | `outside`, with the files named |
| A corpus with no failure record | Reported with the preservation gap that explains it, not as a bare zero |
| A root that does not exist, or a ledger that will not parse | Walked past; the reading still prints and exits 0 |ed |
| A terminal reason outside the nine the type defines | Counted as unclassified; never folded into `clean` |
| A change whose verdict is still pending at a round | No decision recorded; the round has not happened yet |
| A change already carrying a decision | Never decided again, however many rounds follow |

### 6. Tests Required

- The axis classifies every terminal reason the type defines, reports `undefined` ratios for an empty ledger,
  and splits a composite refusal label into its atoms.
- A round records one decision per decidable change and never a `pending` one, and a second round adds none.
- An application is recorded once per change, and a second one, an unknown change and an empty commit are each refused.
- The surface check answers inside, outside with the offenders named, and unresolved for a commit nobody could read.
- The corpus summary counts each terminal class with the axis rule, splits a composite refusal label, and says why a
  corpus with no failure has none - and does not say it when the corpus holds one.
- The surface declaration resolves every entry against the real tree, agrees with `CHANGE_SURFACES` in both
  directions, and lets one path belong to two components; the status read reports it.
- The failure reading keeps the mechanism beside the class, counts only the terminals the axis calls failures,
  attributes refusals by id, reports an empty corpus as a finding, and returns `unattributed` where the records
  do not determine a component.

### 7. Wrong vs Correct

Wrong: let a record act on its own reading, so that an instrument becomes a control nobody voted for. Or write a
verdict on every round for every change, so that "not yet" and "decided" read the same. Or attribute a failure to a
component the evidence does not name, so that an edit is aimed at a file that had nothing to do with it.

Correct: every one of these reads evidence the harness wrote, states what it does not know, is printed rather than
asserted where it is a measurement, and leaves the decision to keep or revert an edit to a person with the record in
front of them.
