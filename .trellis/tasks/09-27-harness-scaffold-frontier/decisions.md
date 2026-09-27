# The six decisions, with their evidence, cost and cheapest first step

- Date: 2026-09-27
- Basis: `research/frontier-anatomy.md` (sources tagged [FETCHED] / [LOCAL]) plus the local reading recorded there.
- Shape: each decision states the question, the field's evidence, our state, the options, what it costs, how
  reversible it is, a recommendation, and **the cheapest step that would falsify the recommendation**. Nothing here
  is built; this is the artifact that makes the scaffold decidable.
- D1-D5 are the decisions the local reading produced; **D6** is the one the survey adds (`2605.18747` §3.4.4) and it
  arrives with the frame that orders all six - see "The frame that groups D1-D5" below, which also **corrects the
  ordering**: D5 is downstream of D1/D2, not parallel to them.

---

## D1. Do we build an execution-isolation layer?

**The question.** The paper's subsystem 5 maximal form is Codex's "policy rules + LLM approval reviewer +
three-platform OS sandbox". We have policy rules and no isolation at all. Do we add the third layer?

**The field's evidence.** [FETCHED] Rec 10: "implement **OS-level sandboxing with policy-as-code and per-agent audit
trails**", and "the cost is tolerable when you **reuse OS binaries (Node `child_process` or equivalent) rather than
writing namespace plumbing from scratch**". Codex ships Bubblewrap (Linux, vendored, via C FFI), Seatbelt (macOS,
`/usr/bin/sandbox-exec`), and on **Windows: restricted-token processes with ACL-based read/write restrictions**.
But §10's Observation 6 reframes it: "OS-level sandboxing is one of the **most code-expensive capabilities in the
corpus, and it is a choice rather than a consequence of scale**" - Hermes ships **zero** OS isolation and spends its
budget on content-borne defence; OpenCode is **policy-only**. So the options are three strategies, not one.

**Our state - and the finding that reframes this decision [LOCAL, 2026-09-27].** **Every shipped mode already declares
an isolation policy, and nothing reads it.** `GOVERNANCE_FIELDS` accepts a `sandbox` block; `modes/code-audit`
declares `isolation: worktree, network: none, filesystem: read-only-source`, and `modes/pentest` and `modes/trading`
both declare `isolation: container, network: allowlist, filesystem: ephemeral`. A field-level reader scan over `src/`
found **no reader**: the only `sandbox` mentions are a code-audit finding category and the parser's own field list.
So `isolation: container` in a mode file currently reads as a guarantee and is not one - the same defect as
`never_allow: [shell.exec]`, and the worst of this decision's three options rather than a fourth.

**The seam.** [LOCAL] Pi's own documented position is that safety is an extension's job (§10.8), and it supplies
`BashOperations { exec(command, cwd, options) }` - a **one-method seam** whose default is
`createLocalShellOperations`, typed as "shared process execution used by the built-in shell tools". The `user_bash`
event accepts `operations?` or a full `result?` replacement. **Not established by reading:** whether the *agent's*
built-in shell tool accepts an extension-supplied `operations` object, as opposed to only `user_bash`.

**Options.** (a) OS sandbox through the seam - on Windows, a restricted-token process; (b) content-borne defence
(Hermes' route: promptware scanning, untrusted-content tainting, deobfuscated command matching); (c) policy-only
(OpenCode's route: syntax-aware command permissioning), which is D4.

**Cost.** (a) is the most expensive per the paper, but the seam is one method and the OS primitives already exist;
(b) is cheap per line and defends a different threat (injected content rather than agent behaviour); (c) is the
cheapest and defends the shell specifically.

**Reversibility.** High for all three: an `exec` wrapper can be removed; content defences are additive.

**Recommendation, revised after the finding above.** The choice is no longer whether to *have* an isolation policy -
the modes already state one - but whether to **enforce it or delete it**. Both are defensible; leaving it is not.

- **Enforce (a)**, because the declaration names exactly what to enforce (`container` / `worktree`,
  `network: allowlist` / `none`, `filesystem: ephemeral` / `read-only-source`), the seam is one method, and the corpus
  says the cost is tolerable when OS binaries are reused. The sequencing is then: enforce what is declared, then
  extend it.
- **Delete the block (b)** if enforcement cannot be done honestly on a given platform, and record that the mode
  declares no isolation. That is (b) in D4's shape and it is the fail-honest direction.
- **Never leave it.** A mode file claiming `isolation: container` while the run is unconfined is worse than either,
  because it is the claim the host's own documentation warns against: "easy to misunderstand as a security
  boundary".

**Built (2026-09-27, commits 2ece003/011abac) - the fail-honest + enforce-what-is-enforceable path, not (a).** The
`sandbox` block is now validated at load (typed axes, a contradiction check), carried on the mode, and consumed in
two places:

- **The host refuses to load a mode whose claims it cannot honour**: `isolation: container`/`worktree` and
  `network: allowlist` need an OS sandbox and an egress control the runtime does not have, and the refusal names an
  enforceable claim as the way out. This is D1's own "delete the block" option applied automatically per axis, so a
  mode author sees the refusal instead of a reviewer seeing a guarantee.
- **The policy enforces the two claims that need no OS sandbox**: `network: none` refuses every network-capable host
  tool, and `filesystem: read-only-source` refuses every filesystem-mutating one, both labelled `[sandbox]` in the
  reason. Absent axes mean the mode says nothing - the validator refuses only wrong values, not missing ones, because
  "delete what you cannot honour" requires omission to be legal.

The three shipped modes were rewritten accordingly: code-audit keeps `network: none` + `filesystem:
read-only-source` (1.8.0); pentest and trading declare `isolation: none`, `network: unrestricted`, `filesystem:
unrestricted` with comments naming what actually contains them (1.4.0/1.3.0). Two host tests pin the behaviour: one
refuses the overpromising fixture at load, one proves the enforced claims block `web_search` and `write`.

**What was deliberately not built.** (a)'s OS-sandbox half - a restricted-token process on Windows, per Rec 10 and
Omnigent's Job Objects. The seam is real (`*Operations`/`spawnHook`), but wrapping a command is not the same as
proving the wrapped command satisfies the read-only-vs-mutating classification, and D6's measurement would be needed
to claim the enforcement buys what an OS sandbox buys. The declaration now matches reality; extending reality to match
the stronger declarations is a platform decision, recorded here as open.

**And the shell still comes first.** Whatever happens to the `sandbox` block, the measured losses are at the shell
(D4), and that is policy we can write today.

**Cheapest falsifying step - executed 2026-09-27, and it changes the answer.** The seam analysis resolved further
than expected, so the experiment is no longer "is it possible":

- Every built-in tool has an `*Operations` interface (`EditOperations`, `FindOperations`, `GrepOperations`,
  `LsOperations`, `ReadOperations`, `WriteOperations`, `PowerShellOperations`), and `ToolsOptions`
  (`core/tools/index.d.ts:25`) carries them per tool, with `BashToolOptions.operations` documented as "Custom
  operations for command execution. Default: local shell" plus a `spawnHook` that "adjust[s] command, cwd, or env
  before execution". **[LOCAL]**
- But the *construction* is the host's (`createAllToolDefinitions(cwd, options)`), and the seam Pi documents for
  extensions is `user_bash`'s `operations?`, whose docstring scopes it to "extensions that **intercept `user_bash`**".
  That is the **user's** shell, not the agent's. **[LOCAL]**
- What an extension *does* hold over the agent's shell is the `tool_call` event's **mutable arguments** - the same lever
  this project already uses for `normalizeLsToolInput` and `applyAdaptiveShellTimeout`, and the host's own docs say no
  re-validation happens after a mutation, so the mutated command is what runs. **[LOCAL]**

So isolation is **feasible without a new host capability**: wrap the command at the boundary (or register replacement
buildings built from `createAllToolDefinitions`). The remaining step is therefore not a feasibility probe but a
**platform** one: pick the wrapper (Seatbelt/Bubblewrap on POSIX; a restricted-token process on Windows, per Rec 10)
and prove that the wrapped command still satisfies the read-only-vs-mutating classification the permission list
depends on. **The recommendation hardens**: (a) is a small task, which makes "do (c) first" a sequencing choice
rather than a necessity - and it moves (a) up the order if the shell cannot be governed by policy alone.

---

## D2. Is the approval default a constant or a mode?

**The question.** An action on none of the three lists: allowed, or asked about? And who decides?

**The field's evidence.** [FETCHED] Every one of the eleven systems takes a position, and **the position is a mode,
never a constant**: Gemini CLI's `PLAN` (read-only) / `DEFAULT` (per-call, with **once / always / reject**) /
`AUTO_EDIT` / `YOLO`; Mistral Vibe's SAFE / NEUTRAL / DESTRUCTIVE / YOLO profiles; Codex's collaboration-mode
presets; Claude Code's permission modes. Rec 9 states it as a recommendation. A read-only class is the **universal
floor** - nobody asks about a read. Our three independent earlier sources (goose's docs, OpenCode's `"*"` rule,
Gemini CLI) say the same.

**Our state.** [LOCAL] The documented default is `ask` (`evaluatePermission` and its test); the implemented default
is `allow` (`src/core/action-policy.ts`, the final branch returns `allow` for both the `"allow"` and the unlisted
`"ask"` cases). `always_allow` therefore cannot change any decision. Every literal entry in all three shipped modes
names an action that cannot occur. **This is the one place in the framework where an unknown is an allow.**

**Options.** (a) Keep the constant, delete `always_allow` (my first proposal); (b) constant `ask`, keep three lists,
modes enumerate their tools; (c) **`permissions.unlisted: "allow" | "ask"`, required** - the mode declares its
stance, which is what goose's docs and OpenCode's `"*"` rule both do, and it is the only shape that fits three modes
that genuinely want three different stances.

**Cost.** (c) is one field and one branch, plus a rule that `unlisted: allow` with a non-empty `always_allow` is
refused (the list could not decide anything - the same rule shape as `limit` with no limits). (b) forces every mode
to enumerate, including the ones that want everything allowed.

**Reversibility.** High: a declared field can be defaulted later, but a *constant* cannot be made per-mode without
the field, which is why (c) dominates.

**Recommendation.** **(c).** It is what the corpus does, it resolves the documented-versus-implemented contradiction
by making the stance explicit instead of picking a winner, and it subsumes both (a) and (b).

**Cheapest falsifying step.** None needed - this one is decided by the corpus. The check is that the three shipped
modes can each state their stance in one line, which they can.

---

## D3. Do we build the outer verification loop?

**The question.** Do we add a scaffold-level guard that validates completion outside the turn loop, with an oracle
the generator does not control?

**The field's evidence.** [FETCHED] It is a **named pattern** (§13.1): "scaffold-level judge/guard validating
completion, outside the turn loop", used by OpenHands (`/goal` judge + critics) and Hermes (verify-on-stop).
`2609.30219` is the protocol form: "**candidate generation is separated from release authority** ... released only
when both facts can be derived by an **external gate under a sealed grammar**", with 21 of 22 fabricated "ready"
plans rejected by the gate - and one false release in 146 outside its benchmark. `2605.18747`'s open-challenge list
leads with "**verification under incomplete feedback**". And Rec 12's caution applies to the *multi-agent* form only.

**Our state.** [LOCAL] Our own synthesis reached this independently: "**self-check is the one capability with no
implementation in either layer**", and "Reflexion's own ablation puts reflection **without** an execution signal
below baseline". We have the *substrate* - `tool.observed` records, the citable-observable marker, the verification
ladder, the convergence snapshot - but no loop that validates completion against an oracle the agent does not
control.

**Options.** (a) Build it, with the oracle being an **execution** signal (a command whose exit status is the
verdict) rather than a model judge; (b) build it with an LLM judge; (c) do not build it, and rely on the existing
per-criterion ladder.

**Cost.** (a) is the cheapest *honest* form: the ladder already parses exit status, so an outer loop is mostly
scheduling plus a refusal contract. (b) contradicts our own recorded finding that judge self-preference is
structural - and RHO's counter-result uses *self-consistency across re-solves*, not self-judging.

**Reversibility.** High; it is additive and its refusals are observable.

**Recommendation.** **(a).** It is the one capability the field names and our own synthesis called missing, and the
oracle must be an execution signal, which we already know how to read.

**Cheapest falsifying step - executed 2026-09-27, and it produced a withdrawal.** The experiment was to take a real
acceptance contract, ask whether each criterion can be an executable check, and see whether the loop refuses a
fabricated pass. It was run against the only real convergence snapshot in the repository:
`.trellis/tasks/archive/2026-09/09-03-task-convergence-control/convergence.json` - ten criteria, `revision: 1`,
`state: working`, `completedStepIds: []`, `observedResources: {toolCalls: 0, ...}`, and **`evidenceRefs: []` on all
ten**.

**Result 1 - the criteria are expressible, and are expressed.** `tests/task-convergence.test.ts` holds ten cases
that map onto the ten criteria about one-for-one by subject: the freeze, the trace replay, unknown acceptance IDs,
"keeps resource observations outside semantic decisions" (AC-008, the invariance criterion I expected to be
inexpressible), regression findings as blockers reaching finish, the evidence requirement, finding amendment, the
unblock condition, malformed revisions, and evidence URIs bound to an acceptance ID. **So AC-008's "never influence a
decision" is testable** - by asserting invariance, which is exactly how it is written.

**Result 2 - my first pass at this was wrong, and the way it was wrong is the finding.** I first audited coverage by
grepping the suite for each criterion's distinctive vocabulary. Three criteria looked uncovered - AC-001 ("fast lane"
- 0 hits), AC-003 ("attribution" - 1 hit, in a *fixture*), and AC-008 ("influence" - 1 hit, in a fixture) - and
**all three are covered**, under different words. A vocabulary proxy produced three false negatives and looked
confident doing it. That is the same failure this project already named for `read_*`: a check that agrees with itself.

**Result 3 - the link from criterion to check is recorded nowhere.** The snapshot's `evidenceRefs` are empty for all
ten; no `AC-00x` in the suite refers to that task's criteria (the ones that appear are test-local fixtures, e.g.
`{ id: "AC-001", text: "The primary behavior passes." }`); and nothing binds a criterion to a test id. So "is this
criterion verified?" is answered by a human matching vocabulary - which Result 2 shows is unreliable.

**Result 4 - and a hypothesis I had to withdraw.** Reading `task-convergence.ts` alone, the evidence rule looks like a
shape check: `decodeEvidenceRefs` validates length, string shape and uniqueness, and the reducer refuses a pass with
**no** refs. I concluded that any invented string would satisfy it, and that this was the gap. **That is false, and the
check is in the extension rather than the reducer**: `src/pi-adapter/extension.ts:1548-1556` resolves every ref of a
`passed` operation through `unresolvedAcceptanceEvidence(...)`, reading the **ledger** and the effects directory, and
throws "names evidence the harness has no record of" for anything unresolved. The comment above it states the intent
better than my draft did: "a well-shaped ref to a record the harness never wrote is the same assertion in the right
costume." So the loop **can** refuse a fabricated pass, and the earlier withdrawal of this rule was correctly
reinstated once the host began writing citable observables. Recorded because the hypothesis was wrong and the
evidence for its wrongness is a line of code I would otherwise have skipped.

**What this changes for the recommendation.** The outer loop's *refusal* machinery already exists in two layers
(shape in the reducer, resolvability at the host boundary) - so (a) is smaller than the pattern's name suggests. What
is missing is **(i) the recorded link from criterion to check**, which would make "is this verified?" answerable
mechanically, and **(ii) anything that drives the criteria**: the only real snapshot in the repository was frozen at
revision 1 with all ten pending and was archived in that state. The cheapest step is therefore not a new loop but
**populating `evidenceRefs` with the check that decided each criterion, and adding a test that fails when a criterion
has none** - which is the same shape as the reachability test, applied to acceptance.

**Built (2026-09-27, commit 4e684a0) - the sensor half of (a).** `agent_task_convergence status` now returns a
`verification` vector beside the snapshot: for every criterion, the same resolver the pass path refuses on
(`unresolvedAcceptanceEvidence`) resolves each evidence ref against the ledger and the effect store, and the result
is one of `verified` (passed, every ref resolves) / `unresolved_evidence` (passed, a ref names nothing the harness
wrote) / `failed` / `waived` / `not_claimed`. Two tests pin it: a passed criterion citing `ledger:tool:suite-run`
audits `verified`, and a snapshot forged on disk to cite `ledger:tool:never-happened` audits
`unresolved_evidence` with the ref named - the forgery the pass path cannot see because it bypasses the pass path,
which is precisely the case the audit exists for.

**What this does not claim.** (ii) is still open: nothing drives the criteria, and the audit reads a snapshot rather
than running the checks. The mechanical link is now a *reading* instead of a human vocabulary match - which the
executed probe above showed was unreliable - but "the criterion was decided by this check, and that check is green"
still requires whoever passes a criterion to cite the right observable. The audit catches a forged or stale citation;
it cannot catch a citation to a real record that does not actually decide the criterion. That is the boundary between
this sensor and a real judge, and it is why (a) is scoped to the execution-signal oracle rather than an LLM one.

---

## D4. Do we make the cumulative constraints real?

**The question.** Our gate sees one call at a time. The measured evasion tactic is to split an operation across
calls. Do we add cross-call state?

**The field's evidence.** [FETCHED] `2609.30217`: best-of-3 evasion attempts up to **98%**, success up to **88%**,
"**increases with test-time compute**", and the tactics are "encode prohibited commands, **decompose operations
across tool calls**, and retry until relevant context leaves the monitor's history". The field's answers are
argument-level: OpenCode's tree-sitter parse plus a ~130-entry arity dictionary; OpenHands' shell-AST rails
(`fetch-to-exec`, `raw-disk-op`, `catastrophic-delete`); Hermes' **47 patterns matched on deobfuscated variants**;
OpenClaw's fixed-window rate limiting.

**Our state.** [LOCAL] `extension.ts:2316` and `loop-runner.ts:116` pass `accumulatedIntensity: {}`; the mode's
`gate.intensity` / `windows` / `excluded_techniques` have **no consumer in `src/`**; the policy's `toRequest`
(`action-policy.ts:145`) never supplies `technique` / `phase` / `intensity`, so the engagement document's
`constraints` can never fire. So all three tactics work against us: encoding (name matching), decomposition (empty
accumulator), and retry (stateless per call, with admission and compaction able to drop the history a monitor needs).

**Options.** (a) Make the declared fields real: populate the accumulator, give the fields consumers, carry
`phase`/`technique` in the request; (b) delete the fields and record the absence; (c) add syntax-aware shell parsing
(the field's answer to *encoding*), which is a different axis from (a)'s *decomposition*.

**Cost.** (a) touches the gate contract and the host's invocation construction. (b) is free and honest. (c) is the
largest single piece in the corpus's safety budgets (OpenCode's arity dictionary is LLM-generated and ~130 entries).

**Reversibility.** (b) is trivially reversible; (a) changes a contract but only in the direction of carrying more
truth.

**Recommendation.** **(a), and (b) for anything (a) cannot justify.** A declared control with no consumer is this
project's founding defect; the choice is to make it real or remove it, never to leave it declared. Do **(c) only
after** (a), because decomposition is what the benchmark measured and encoding is what the corpus guessed.

**Cheapest falsifying step - executed 2026-09-27, confirmed the gap, then inverted by the fix.** Written as a
permanent test rather than a probe, so the fix would have somewhere to land:

```text
tests/host-work-mode.test.ts
  ✔ does not enforce a forbidden technique, because nothing carries one to the authority  [KNOWN GAP: D4]   (before)
  ✔ refuses a technique the mode excludes, at the boundary, on a raw capability call  [D4]                  (after)
```

**Before:** the test declared `dos` as forbidden in both places it can be declared - the mode's
`gate.excluded_techniques` and the grant's `constraints.excluded_techniques` - and the call was **allowed**, because
`toRequest` built `{ action, target, at, evidenceDigests }` and never supplied a technique.

**After (2026-09-27, commit 1616a3d): (a) is built.** The policy reads `technique`/`phase`/`intensity` off the
action's arguments, refuses a technique the mode excludes **before any allowing check**, meters a phase against its
`gate.intensity` ceiling using an accumulator that counts actions actually run (`recordRun`/`counts`, carried into
each invocation as `accumulatedIntensity`), and forwards all three in `toRequest` so a grant's `constraints` fire
too. `gate.windows` is **deleted rather than implemented**: a calendar window outlives a session and is a property of
the grant, which carries and checks its own - so the loader refuses a mode-level one with that reason, not as an
unknown field. The inverted test also covers the case the authority cannot reach: a call that names no target builds
no request, so only the mode's own list can refuse it.

---

## D5. Do we close the postmortem-to-precondition loop?

**The question.** The harness can be improved from its own traces. Do we build the loop, or keep improving it by
hand?

**The field's evidence.** [FETCHED] Self-Harness's three stages - **Weakness Mining** from execution traces →
**Harness Proposal** tied to those failures → **Proposal Validation** that "accepts candidate edits **only after
regression testing**" - with held-out gains up to 132%. StateM's mechanism is the same loop aimed at controls:
"turns **selected postmortem findings into persistent, executable preconditions and practices**", worth ~9 points on
Terminal-Bench 2.1 and a ~38x cost ratio. `2607.13285` supplies the missing half: **behaviour localization** is the
bottleneck in harness evolution, and BGPD "verifies candidate locations against the current source".

**Our state.** [LOCAL] All three stages have substrate: the execution ledger and `tool.observed` records (mining);
the Markdown/YAML tree - mode files, specs, skills - as the harness object (proposal); `npm test`, the spec-budget
test and the reachability test (validation). **And every finding in this session was made by hand**: a declaration
with no consumer, a field nothing reads, a rule that never fires.

**Options.** (a) Build the loop; (b) keep doing it by hand and record the findings; (c) build only the *detector*
half - behaviour localization - and leave the proposals to a human.

**Cost.** (a) is the largest of the five and its selection signal is the risky part: RHO selects by **self-preference**
with no external grading, while our own research says judge self-preference is structural. (c) is bounded and its
output is checkable (a list of behaviour-to-code locations), which is exactly the artifact this project keeps needing.

**Reversibility.** High; a detector is read-only.

**Recommendation.** **(c) first.** The bottleneck the field names is localization, not proposal - and localization is
the half whose output can be verified against the source. Then (a) only with an oracle that is not the generator,
i.e. the regression tests we already have.

**Cheapest falsifying step - executed 2026-09-27, and it found five more than the three it was asked about.** Rather
than reason about whether localization would help, a **field-level reader scan** was built and run: extract every
field name the mode format declares (the eight `*_FIELDS` sets in `src/core/work-mode.ts`), then count occurrences of
each name anywhere in `src/` **outside the parser**. A field with no occurrence has no reader.

**It found the known case mechanically** - `PERMISSION_FIELDS.always_allow: NO READER` - and then found five the
session had not:

| Field | Declared by | Readers |
|---|---|---|
| `GOVERNANCE_FIELDS.sandbox` | **all three shipped modes**, with `isolation: container` / `worktree`, `network: allowlist` / `none`, `filesystem: ephemeral` / `read-only-source` | **none** - the only `sandbox` mentions in `src/` are a code-audit finding category (`sandbox_absent`, of all names) and the parser's field list |
| `SCOPE_FIELDS.exclusions` | code-audit `[]`, pentest `[t-payments]`, trading `[production-venue]` | **none** |
| `AUTHORITY_FIELDS.expires` | all three (`2026-10-01`, `2026-12-31`, `2027-01-01`) | **none** - an expired mode keeps loading |
| `AUTHORITY_FIELDS.grant_graph` | the format accepts it | **none** |
| `MODE_FIELDS.license` | all three (`MIT`) | **none** |

**And it missed two of the three cases it was asked about.** `gate.intensity`, `gate.excluded_techniques` and
`gate.windows` were reported as *having* readers, because the bare names match unrelated code: `intensity` and
`excluded_techniques` match `src/core/authority.ts`, which reads the **authority document's** `constraints`, not the
mode's `gate` block; `windows` matches the Windows runtime. **That is the vocabulary-proxy failure again, one level
down**: the scan resolves *names*, and a field name that is a common word gets a false negative. The fix is
scope-aware resolution (`gate.intensity`, not `intensity`) - which is what a behaviour-to-code map would have to do,
and what the Harness Handbook paper's "verify candidate locations against the current source" is for.

**Answer to the question the experiment was asked.** Localization would have found the class **partially**: it caught
`always_allow` and found five more, but would have missed two of the three known instances. So (c) keeps its
justification **only in the scope-aware form** - and the detector that answered this question is 30 lines, which is
evidence for the bounded version rather than against it.

**The finding that changes another decision.** `GOVERNANCE_FIELDS.sandbox` is not a cosmetic omission: **every shipped
mode declares an execution-isolation policy and nothing reads it.** `isolation: container` in a mode file reads as
"this run is containerised". It is not. That is the same defect as `never_allow: [shell.exec]`, and it is the *worst*
of the three options in D1 - a mode file claiming isolation it does not have. **D1 is therefore not "should we build
isolation" but "the declaration already exists and is a false claim: enforce it or remove it"**, which is exactly
D4's choice applied to the sandbox block. It also makes enforcement more attractive than round 4 judged, because the
modes already name the policy to enforce (container / allowlist / ephemeral) and the seam is one method.

---

## The frame that groups D1-D5, and the sixth decision it adds

**The frame [FETCHED].** `2605.18747` §3.4 names the loop as **PEV - Plan, Execute, Verify** - and §3.5 adds the
optimization loop over it. §3.4.2 makes the plan "an **explicit contract over the next state transition**" that is a
"**harness artifact rather than an unobserved reasoning trace**"; §3.4.3 requires execution to be "**sandboxed and
permissioned**" with three tiers (read-only / sandbox-edit / full-access); §3.4.4 requires verification to run on
"**deterministic or at least reproducible**" sensors, with critique "**interpret[ing] sensor outputs rather than
replac[ing] them**"; §3.5.1 asks for deep telemetry; §3.5.3 requires the loop's own mutations to be sandboxed,
regression-tested, and **escalated to a human when they move a permission boundary**.

**Where the five decisions land in it.**

| Phase | Decisions | Note |
|---|---|---|
| **Plan** | none | the contract-as-artifact phase is what `.trellis/` already is; the survey argues it *matters*, not that it needs work |
| **Execute** | **D1**, **D2**, **D4** | all three are "execution must be sandboxed *and* permissioned"; the three-tier model is the frontier's name for what our mode files already declare |
| **Verify** | **D3** | "the link from criterion to the sensor that decided it" is the survey's own requirement that verification be reproducible |
| **The loop over the loop** | **D5** | governed mutation - and §3.5.3 makes it **dependent on Execute**, since permission-boundary changes need HITL approval |

**Two consequences for the ordering.** First, the survey's own logic puts **Execute before the loop over it**: D5
cannot be governed without D1/D2 having drawn the boundary it escalates. Second, and more usefully, §3.4.4's
"**evaluation harnesses**" clause names something we have no version of, and it is the instrument that would settle
the other five decisions with evidence instead of argument. That is recorded as **D6** below rather than folded into
D3, because it compares *harness variants* while D3 verifies *one run*.

**What the frame does not change.** It does not promote D1 or D2 above the others, and it does not make the ordering
D2 -> D4 -> D3 -> D1 -> D5 wrong: within Execute, D2 (what a permission list means) has to be settled before D4 (which
declared constraints can fire), and D1's enforcement seam is one method, so it is cheap whenever it is taken. The
frame's contribution is that **D5 is downstream of D1/D2, not parallel to them** - which is a correction to the
ordering I proposed in round 8.

---

## D6. Do we build an evaluation harness - a way to compare harness variants under controlled conditions?

**The question.** §3.4.4: "**Evaluation harnesses broaden this idea from a single test command to repeatable task
distributions**: they encode evaluator logic, simulation hooks, red-team cases, or RL-style environments that can
**compare harness variants under controlled conditions**." We have one test suite that verifies our code, and nothing
that measures our harness. Every decision above is currently argued from literature and local reading, not from a
measurement.

**The field's evidence.** [FETCHED] The AHE ablation quoted in `frontier-anatomy.md` §15.5 is exactly this
instrument: it is what produced "tools +3.3 pp, middleware +2.2 pp, long-term memory +5.6 pp, **system prompt alone
-2.3 pp**". Self-Harness's weakness mining, RHO's self-preference result (59% -> 78% on SWE-Bench Pro), RHI's -60%
cost, and StateM's 92.1% vs 83.1% are all measurements of *harness* variants against a fixed task set. **Every number
in this document's evidence base comes from a system that has one.** That is the strongest argument for D6 and it is
also the reason not to start with it: those systems had a task set, a scoring function, and a baseline to compare
against, and we have none of the three.

**Our state.** The convergence criteria (`.trellis/tasks/archive/2026-09/09-03-task-convergence-control/convergence.json`)
are the closest thing: 10 criteria, each with a check and a `pending` status. But they are one run's acceptance
contract, not a repeatable distribution, and they are frozen at `revision: 1` with `evidenceRefs: []` - i.e. **D3's
gap and D6's absence are the same artifact**. The ledger records enough to score a run (tool calls, permission
requests, test results, outcomes) but nothing aggregates it across runs.

**The options.**

- **(a) Build it now**, before D1-D5: define a small task set, a scoring function, and a baseline, then measure each
  change. Correct in principle; requires tasks, a scoring function, and a baseline, and the tasks would have to be
  about *this* project to be meaningful. Cost: large, and the first version would measure the wrong thing.
- **(b) Build it after Execute (D2/D4/D1)**, using D3's work as the seed: once every criterion records the check that
  decided it, the criteria *are* a scoring function and runs *are* comparable. Cost: moderate, and it reuses D3.
- **(c) Do not build it**, and keep arguing from literature plus targeted tests. Cost: zero; and the five decisions
  stay unfalsifiable at the level that matters ("did this change make the harness better?").

**Recommendation: (b), and only after D3.** D6 is not urgent, and it is not independent: D3 is a prerequisite,
because an evaluation harness that cannot say which check decided a criterion cannot score a variant either. The
ordering D2 -> D4 -> D3 -> D1 -> D5 stands, with D6 as the thing that makes D2..D5 measurable rather than the thing
that decides them.

**The cheapest step that would falsify (b).** Take one already-settled decision and try to score it. Concretely:
ask whether any observable distinguishes "the mode loaded correctly" from "the mode loaded and its declarations were
honoured". If nothing can distinguish them, no scoring function exists and (b) is not reachable from D3 alone.

**[Executed 2026-09-27] `node --import tsx --test --test-name-pattern="KNOWN GAP" tests/host-work-mode.test.ts` ->
exit 0, all three green.** So the three gap tests **pass**: they pin the *absence* of an effect, they do not detect
it. **Withdrawal:** an earlier draft of this paragraph claimed they "fail at the point where a declaration should have
had an effect". That was false - I asserted a test outcome instead of running the test. The run above is the
correction, and the claim is withdrawn rather than reworded.

**What the run actually establishes.** The distinguishing observable exists and is *nameable*: each gap test's title
names the missing effect (`does not enforce a forbidden technique`, `allows a target the mode excludes`, `loads a mode
whose declared expiry is in the past`), and each was written from a fixture whose declaration the runtime ignores.
The scoring signal D6 needs is therefore one inversion away - the same fixture, the same assertion, with the expected
value flipped from "nothing happens" to "this happens" - and inverting them is exactly what D2/D4/D1 would do as they
land. **Not falsified**, but the stronger version of the claim is: D6's first scoring function is *not* new work, it is
the gap tests flipped, so (b) is cheaper than the cost column says - and (b) is still correctly placed after D3, since
a flipped test is only a measurement once the criterion records which check decided it.
---

## Round 10: what the full practitioner's guide and the platform turn change

Source: `2609.00006v1` §14.2-14.5, §15.3, §15.6, §16 (all 18 recommendations, previously only §16.6/§16.9), §17 -
recorded in `research/frontier-anatomy.md` §14-15. Four deltas, and one candidate that the measurement closed.

### D2 gains the field's own name for our defect, and its shape

§14.5 "Policy migrated out of prose": "**behavioral policy is moving from the prompt (where the model reads it) to
configuration (where the platform enforces it)**" - Codex dropped its no-commit and anti-gold-plating prompt rules for
feature flags; Mistral Vibe deleted its "Never Commit" hard rule and re-founded on a seven-level precedence contract.
Rec 11 makes it a recommendation: "codify safety rules as data or dedicated policy files rather than as imperative
code - and if you support a YOLO mode, keep a floor beneath it".

So our mode files are not a local oddity with a local fix: they are policy that has **already arrived in
configuration**, in the direction the field names, with the enforcement half missing. That reframes the deliverable -
not "make the lists work" but "finish the move" - and it predicts the failure mode of doing nothing: as the field's
models internalise the norms, a prose-level rule we do not enforce is one we progressively stop being able to rely on.

**Shape, from Omnigent's policy plane (§14.4).** A cross-harness policy plane is described as "three-level (session →
agent → admin; **six phases**; CEL, Python, or LLM-classifier evaluators; cross-session per-user budgets)... **with
fail-closed semantics**". Two things to take: **fail-closed** is already our loader's behaviour (it refuses rather than
defaults), which is why D2's "`unlisted` must be declared" is the right rule and not an invented one; and **levels +
phases** are the two axes our `gateSemantics`/`permissions` pair does not name, so if D2 wants the frontier's shape
rather than a local invention, those are the axes to name. **Not to be adopted wholesale** - six phases and three
levels are a meta-harness's requirement, not a mode file's.

**The objection this removes.** "A permission list cannot be enforced without a shell parser" is false in the corpus's
terms: §13.1's **Syntax-Aware Command Permissioning** pattern - "commands parsed (tree-sitter) and grants scoped by
argument arity" - is shipped by OpenCode (~130-entry arity dictionary), Mistral Vibe (parse-validation) and Hermes
(47 deobfuscated patterns). So D2's "entries must name host tools or capability names" is a choice among
implementations, not a retreat from enforcement.

### D6 is the field's open problem, not the field's practice

§17.2 lists as **future work**: "Unified evaluation frameworks that assess safety, user experience, cost efficiency, and
extensibility alongside correctness"; "Formal verification of safety policies for policy-as-code systems"; "Cross-system
benchmark suite". The AHE ablation numbers I cited as proof the instrument exists prove it exists **for task quality**.
The instrument D6 wants is what the paper that studied all eleven systems says it did not build and does not know how to
build. **Recommendation unchanged ("not now, and after D3")**; the reason changes from "adopt what the frontier has" to
"the frontier does not have it either", which is a stronger argument for scoping the first version to something
measurable - and the flipped gap tests remain the cheapest such thing.

### D1 gains a concrete Windows answer, and loses a bad argument

§14.4: Omnigent's uniform sandbox stack is "bubblewrap-plus-seccomp on Linux, generated Seatbelt profiles on macOS,
**Job Objects on Windows**" - and its restraint is evidence "that **OS-level isolation resists being factored out as a
shared service**". So the cheapest-step question for D1 has a named answer (Windows Job Objects, i.e. the same
`child_process`-reuse route Rec 10 recommends) rather than "write namespace plumbing". **The bad argument to drop:**
§15.3 records that the April edition's "large systems are the sandboxers" correlation was **falsified** - Hermes and
OpenCode are comparably large with zero OS isolation. So "we are too small for isolation" is not available as a reason;
the available reasons are the ones the paper gives, and none of them is size.

### D3 and D4 are named patterns, not inventions

§13.1's catalog includes **Outer Verification Loop** - "scaffold-level judge/guard validating completion, outside the
turn loop" (OpenHands's `/goal` judge plus critics; Hermes's verify-on-stop). That is what the convergence criteria are
trying to be, so D3 completes a known pattern rather than designing one. It also settles D3's shape question: the
pattern is a **guard outside the turn loop**, which is where our criteria already live.

### New candidate: D7, our tool surface is above the deferred-loading threshold - **measured, and mostly closed**

**The claim under test.** Rec 4: "When your tool count exceeds ~15, adopt deferred tool loading... Below ~15 tools the
indirection is not worth the added complexity"; Claude Code's version "reduces the initial prompt by ~40%"; Hermes
collapses its catalog "once schemas would exceed 10% of the context window".

**Measured 2026-09-27, by running the code.** `src/pi-adapter/extension.ts` registers **13** tools unconditionally
(verified by calling the extension against a mock host). `tests/fixtures/representative-tool-catalog.ts` - the
captured installed Pi catalog - holds **57 unique names** (verified independently, and asserted by
`tests/tool-profile.test.ts:8`). Serializing the 13 registered schemas gives **5,476 bytes**, i.e. ~1,370 tokens by
`model-gateway.ts`'s estimator; **`agent_task_convergence` alone is 1,753 bytes, 32% of that**. **Withdrawal:** an
earlier draft of this section said "the model sees ~21 schemas". That was wrong - it counted our 13 plus the host's
eight-name core union and missed every other installed extension. Corrected here and in `frontier-anatomy.md` §14.1.

**The answer.** The count criterion fires (57 > ~15), but our own share of the prompt cost is ~1.4 K tokens, an order
of magnitude below Hermes's 10%-of-window trigger. So **D7 is closed for our thirteen tools**: deferred loading them
would add an indirection to save a fraction of a percent of the window. Two things survive the closure. (1) The
count that Rec 4 actually targets is the whole 57-tool payload, which this measurement does not cover - and that number
is already recorded per request as `providerToolSchemaBytes` (`execution-ledger.ts:292`), so it is readable from a real
session whenever we want it. (2) One of our thirteen schemas is five times the size of its siblings, which is a
prompt-economics observation about a single tool rather than a decision. **D7 does not enter the decision list**; it
is recorded as a measured non-finding, which is what the cheapest step was for.
---

## What is not on this list, and why

- **A framework** (Rec 15): 0/11 harnesses use one; we are a hand-rolled extension of a hand-rolled runtime.
- **RAG over code** (Rec 8/16): 0/11; our specs are routed by an index under an enforced size budget, which is the
  JIT pattern the corpus converged on.
- **Stuck detection** (Rec 18): we already ship more than the field's cheap caps, and the paper calls the elaborate
  forms platform-tier. The one thing worth taking is Claude Code's **denial counter** and Codex's **per-turn
  rejection circuit breaker**, both of which are cheap - folded into D2's work rather than a decision of their own.
- **MCP** (Rec 13): our host "pointedly rejects" it; that is an inheritance, not a gap.
- **Multi-agent protocol adoption**: Rec 12/13 say keep sub-agents in-process; the ACP question belongs to the host.