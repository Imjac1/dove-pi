# The five decisions, with their evidence, cost and cheapest first step

- Date: 2026-09-27
- Basis: `research/frontier-anatomy.md` (sources tagged [FETCHED] / [LOCAL]) plus the local reading recorded there.
- Shape: each decision states the question, the field's evidence, our state, the options, what it costs, how
  reversible it is, a recommendation, and **the cheapest step that would falsify the recommendation**. Nothing here
  is built; this is the artifact that makes the scaffold decidable.

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

**Cheapest falsifying step - executed 2026-09-27, and it confirmed the gap.** Written as a permanent test rather
than a probe, so the fix has somewhere to land:

```text
tests/host-work-mode.test.ts
  ✔ does not enforce a forbidden technique, because nothing carries one to the authority  [KNOWN GAP: D4]
```

The test declares `dos` as forbidden in **both** places it can be declared - the fixture mode's
`gate.excluded_techniques` and the fixture engagement's grant `constraints.excluded_techniques` - and calls the
capability with `technique: "dos"`. **The call is allowed.** The chain is exactly as read: the authority gate does
refuse an excluded technique when the request carries one (`src/core/authority.ts:403`), and the policy's
`toRequest` (`src/core/action-policy.ts:145`) builds `{ action, target, at, evidenceDigests }` and never supplies
one. The mode-level declaration has no consumer at all.

The test asserts the defect **so that the fix is a one-line inversion rather than a new test**, and its name carries
`[KNOWN GAP: D4]` so it cannot be mistaken for an endorsement. Full suite after adding it: 595 tests, 593 pass, 0 fail.

**What this changes for the recommendation.** Nothing about (a) versus (b) - the declared-and-inert fields still have
to be made real or removed. It does mean the *decomposition* half of the evasion paper's finding is worse than
reading suggested: it is not that the accumulator is empty, it is that **no request can ever carry the facts a
technique-scoped rule needs**.

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

## What is not on this list, and why

- **A framework** (Rec 15): 0/11 harnesses use one; we are a hand-rolled extension of a hand-rolled runtime.
- **RAG over code** (Rec 8/16): 0/11; our specs are routed by an index under an enforced size budget, which is the
  JIT pattern the corpus converged on.
- **Stuck detection** (Rec 18): we already ship more than the field's cheap caps, and the paper calls the elaborate
  forms platform-tier. The one thing worth taking is Claude Code's **denial counter** and Codex's **per-turn
  rejection circuit breaker**, both of which are cheap - folded into D2's work rather than a decision of their own.
- **MCP** (Rec 13): our host "pointedly rejects" it; that is an inheritance, not a gap.
- **Multi-agent protocol adoption**: Rec 12/13 say keep sub-agents in-process; the ACP question belongs to the host.
