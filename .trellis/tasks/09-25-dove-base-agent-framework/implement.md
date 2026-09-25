# Implementation Plan

Companion to `prd.md` (requirements) and `design.md` (technical design). This file is the ordered
execution checklist: what to build in what order, how each step is verified, where the review gates
are, and where the rollback points are.

**Sequencing principle: by blast radius, smallest first.** Code auditing is reversible, penetration
testing acts on real targets under a contract, trading moves money. The framework must be proven on
the reversible vertical before it is allowed near the irreversible ones.

---

## M0. Precondition - make the verification gate meaningful again  **[DONE]**

The repository's own test suite could not be trusted as a gate: an uncommitted Trellis framework
update (0.6.16 -> 0.6.17) had removed the `convergence` subcommand wiring from
`.trellis/scripts/task.py`, and `tests/task-cli.test.ts` depends on it. HEAD was green
(316 pass / 0 fail); the working tree was red (3 fail).

**Resolved by investigation, not by preference.** The three options originally listed turned out to
be one action:

- `git diff --numstat` on `task.py` was **0 insertions / 6 deletions** - the update deleted only the
  wiring and changed nothing else in that file. So *restoring HEAD's `task.py`* and *re-adding the
  wiring on top of 0.6.17* produce the identical file.
- `.trellis/scripts/common/convergence.py` is a **project-local** module - its own docstring reads
  *"Project-local Trellis bridge for the shared task convergence reducer."* It was untouched by the
  update and is still present, as is the repo-level helper `scripts/trellis-convergence.mts`.
- Therefore the update overwrote a **local customization**, which is exactly the case the
  template-hash registry exists to track. The minimal correct action is to restore it.

- [x] Restore the convergence wiring: `git checkout -- .trellis/scripts/task.py` (the pre-change
      working-tree copy was saved to `%TEMP%/task.py.0.6.17-wt` before the change, in case a
      different disposition is later preferred).
- [x] Confirm the gate is green on that baseline.

**Validation (all run):**

```text
python ./.trellis/scripts/task.py convergence replay --trace september-3-installer-expansion-stops-at-finish
  -> {"ok": true, "traces": ["september-3-installer-expansion-stops-at-finish"], ...}

node --import tsx --test tests/task-cli.test.ts
  -> tests 9 / pass 9 / fail 0

npm run typecheck                     -> exit 0
npm test                              -> tests 318 / pass 316 / fail 0 / skipped 2
```

The 316/0 result matches the baseline recorded in
`08-27-dove-interop-layer/research/check-2026-09-25-skill-discovery.md`, so the gate is back to its
documented state and M1 may proceed.

---

## M1. Loop interface, first adapter, offline provider  **[DONE]**

Deliverable: the framework owns a minimal loop interface; the model transport is caller-supplied.

- [x] **Loop interface** - `src/core/loop.ts`.
- [x] **Reference loop** - `src/core/loop-runner.ts`, enforcing three rules that must not be left to a
      gate implementation: the gate is invoked for every action including allowed ones; anything
      unevaluable is a block; a target/display mismatch is blocked before the gate is consulted.
- [x] **Scripted offline provider** - `src/adapters/loop-scripted.ts`.
- [x] **Paired offline gate test** - `tests/loop-gate.test.ts`.
- [x] **The `pi-agent-core` adapter** - `src/adapters/loop-pi-agent-core.ts`, over Pi's thin `Agent`,
      with `@earendil-works/pi-agent-core@0.84.3` added as a **direct dependency pinned to match the
      installed `pi-coding-agent`**.

**Why the adapter matters beyond reuse.** If `AgentLoop` could only be satisfied by this framework's own
runner, it would not be a contract, and the reversibility that design decision 10.1 bought would be
imaginary. Pi's `Agent` is a genuinely different implementation - it owns retries, streaming, steering
queues and its own transcript - so wiring our gate into it is a real test of the boundary. **It passes.**

**What is deliberately not bridged.** Pi's `streamFn` returns a Pi-ai `AssistantMessageEventStream`, not
this framework's `LoopProvider`. Translating between them would mean building Pi-ai partial
`AssistantMessage` objects, coupling the adapter to a pre-1.0 package's message protocol for no
benefit: in production the caller supplies a `streamFn` from Pi-ai's own provider catalog. The provider
abstraction therefore differs per loop implementation, which is correct - **the interface is
`AgentLoop`, not the provider**.

**Validation (all run):**

```text
node --import tsx --test tests/loop-gate.test.ts           -> tests 7 / pass 7 / fail 0
node --import tsx --test tests/pi-agent-core-adapter.test.ts -> tests 4 / pass 4 / fail 0

  adapter: an allowed action executes; a blocked one never reaches the tool, with the reason and
      remediation delivered through Pi's own error tool result
  adapter: the invocation log records allowed actions too
  adapter: the target/display mismatch and the throwing-gate guard are applied by the adapter as
      well, so the framework's guarantees do not depend on which loop is running
  adapter: the mode identity is stamped on every invocation

npm run typecheck  -> 0 errors
npm test           -> tests 425 / pass 423 / fail 0 / skipped 2   (318 baseline + 107 new)
```

**Review gate G1** applied to the loop interface, and it has now been exercised by two independent
implementations.

---

## M2. Gate boundary with two semantics  **[DONE]**

- [x] **One pre-execution, parameter-level boundary** at tool dispatch - `ActionGate`, invoked by the
      runner for every action (M1).
- [x] **Limit gate** - `src/core/gate-limit.ts`. Allows iff the action is inside declared numeric
      bounds; blocks above a maximum and below a minimum. This is the SEC 15c3-5 pre-trade semantics.
- [x] **Conformance gate** - `src/core/gate-conformance.ts` over `src/core/authority.ts`. Allows iff
      the action is inside the pre-established authority contract; blocks anything outside it. This is
      the NIST SP 800-115 Rules-of-Engagement semantics.
- [x] **Both fail closed.** Every unevaluable case is a block, in both gates - and there are a lot of
      them, which is the point.
- [x] **Canonicalisation on both sides** - enforced by the loop itself, not left to gate authors (M1).
- [x] **Block reason reaches the tool result**, with remediation.

**Two semantics, not one.** A limit gate blocks anything over a threshold, always. A conformance gate
allows everything the contract covers. A framework offering only one forces the other vertical to
bypass it.

**Validation (all run):**

```text
node --import tsx --test tests/gates.test.ts
  -> tests 17 / pass 17 / fail 0

  limit gate:      in-bounds allow; over-max block; under-min block;
                   absent required argument -> block (fail closed);
                   non-finite value -> block; a limit with neither max nor min -> rejected at construction;
                   non-required absent -> allow
  conformance gate: fully covered -> allow (naming the resolving grants);
                   unknown target -> block ("never in scope");
                   unverifiable ownership evidence -> block;
                   unauthorized action -> block;
                   missing required grant -> block;
                   grant issued by the operator itself -> block (an agent may not grant itself authority);
                   outside the window -> block;
                   pending or stale external approval -> block;
                   excluded technique -> block; over-ceiling intensity -> block;
                   unmappable action -> block ("cannot tell" is not "allowed")

npm run typecheck  -> exit 0
npm test           -> tests 342 / pass 340 / fail 0 / skipped 2   (318 baseline + 24 new)
```

**A defect found and fixed during this milestone.** `ActionGate.evaluate` is typed
`GateDecision | Promise<GateDecision>`, which made every synchronous call site fail typecheck even
though the tests passed. Rather than casting at 13 call sites, the contract gained a
`SynchronousActionGate` subtype: the loop still awaits either shape, and a pure policy check can be
declared as what it is.

---

## M3. Work-mode loader and validation  **[DONE]**

- [x] **Three-file loader** - `src/core/work-mode.ts`. Parses `MODE.md` frontmatter + body,
      `governance.yaml`, and `permissions.yaml` (design section 3.4).
- [x] **Reject unknown fields with a named error**, at every level the schema defines: mode
      frontmatter, governance, permissions, and the nested `scope` / `authority` / `gate` mappings.
      The precedents all silently ignore unknown fields, so a typo in a security key fails open.
- [x] **Require all three files** and the required fields: `name`, `description`, `version`,
      `framework`, `scope`, `authority.capabilities`, `gate.semantics`.
- [x] **Refuse an out-of-range or unparseable `framework` range** rather than partially applying the
      mode.
- [x] **`never_allow` wins** over `always_allow`, over `ask_before`, and over any mode setting.
- [x] **A new direct dependency: `yaml@^2.9.1`.** It was previously only a nested dependency of
      `pi-coding-agent`, and nothing in `src/` read YAML at all. A hand-rolled subset parser was
      rejected deliberately: the GitHub survey caught a real adapter bug caused by a **YAML block
      scalar** (`description: >` emitted with a literal `>`, breaking the consumer's loader), so
      hand-rolling would repeat a known failure class. There is now a regression test for exactly that
      shape.

**Validation (all run):**

```text
node --import tsx --test tests/work-mode.test.ts
  -> tests 13 / pass 13 / fail 0

  loads a well-formed three-file mode
  unknown field in frontmatter / governance / permissions -> rejected, naming the field
  missing fence, missing name, missing description         -> rejected
  missing scope / capabilities / gate.semantics            -> rejected
  unrecognised gate.semantics value                        -> rejected
  out-of-range framework                                   -> refused, naming the running version
  unparseable framework range clause                       -> refused, never assumed satisfied
  YAML block-scalar description                            -> parsed correctly
  framework range truth table; permission precedence       -> never_allow wins; unlisted -> ask

npm run typecheck  -> 0 errors
npm test           -> tests 355 / pass 353 / fail 0 / skipped 2   (318 baseline + 37 new)
```

**A defect found and fixed during this milestone.** A missing `authority.capabilities` reported
`invalid-type` rather than `missing-field`. The test was asserting the intended contract, so the
loader was corrected rather than the test: a required field that is absent is a *missing field*, and
the message now says why the field exists (*"a mode that cannot declare its authority cannot be
reviewed before it runs"*).

**Review gate G2** applies here: the schema is a public contract, and it is now implemented and
tested at `src/core/work-mode.ts`.

---

## M4. Session and evidence plane  **[DONE]**

- [x] **Append-only per-engagement ledger** - `src/core/effect-ledger.ts`.
- [x] **Every record stamps the work-mode identity** (`mode.id`, `mode.version`,
      `mode.governanceVersion`) plus the resolved `grantIds`, so "what was this agent allowed to do
      when it did that?" is answerable after the fact. No surveyed project records which mode version a
      run used - versions pin content, only evals pin behaviour.
- [x] **Effect identity as the idempotency key** - `deriveEffectKey`, with an explicit-key escape
      hatch so a venue-level key (a client order id) can be used instead, which is also what lets the
      *venue* reject a duplicate rather than only the framework.
- [x] **Consume-once is an atomic `claim`, not a read-then-write.** The measured failure is
      *"k processes resuming one parked interrupt fire the gated effect k times, saturation 1.0 in 36
      of 40 cells, and the failure crosses hosts"*; a `has()`-then-`record()` window is exactly where
      the duplicate lands.
- [x] **Cross-engagement isolation is enforced, not documented.** A ledger refuses a record whose
      engagement differs from its own (PTES: *"don't re-use a report from another customer engagement
      as a template"*).
- [x] **SARIF emitter** - \`src/core/evidence-sarif.ts\`. 2.1.0 log with a **versioned** fingerprint key
      (\`doveFinding/v1\`), \`partialFingerprints\`, \`baselineState\`, \`occurrenceCount\`, and a rank
      derived from severity. **The fingerprint excludes the finding's message** - a prose-derived
      identity varies between runs, which makes \`baselineState\` meaningless. This is the lesson from the
      one surveyed project that got it right, whose fingerprint is \`sha256(Path|Category|ExistingCode)\`
      with the explicit comment *"not message.text, which is LLM prose that varies across runs"*.
- [x] **Checkpoint at the action boundary** - \`src/core/checkpoint.ts\`. The unit is **an effect that
      was admitted and completed**, not a model turn. Two guards are copied from the strongest precedent
      in the wild (Microsoft's \`WorkflowCheckpoint\`): a **graph signature** over mode + sorted tool names
      + gate, and **explicit lineage** rather than timestamps. Resuming under a changed shape is
      **refused**, because that means running a different program from where another one stopped.

**A design flaw found by the concurrency test, and how it was resolved.** The first implementation
retried a claimed-but-incomplete effect, on the reasoning that a crash must not lose work. The race
test then executed the effect **8 times for 8 concurrent resumers**.

The root cause is a genuine tension: crash recovery wants *retry*, concurrency safety wants *skip*,
and a ledger cannot tell "in flight right now" from "died mid-effect" - that is the late-commit
problem (arXiv 2609.29095: *"no verification-only policy is exactly-once under late commits"*). The
two failure directions are not symmetric: retrying duplicates the effect k times across hosts, while
skipping risks losing work a crash interrupted.

**Resolved by making the default "never duplicate" and the retry an explicit opt-in**
(`retryPriorAttempt`), with the mode - not the call site - deciding which effects may set it. The
same reasoning was then applied to *failed* effects, which are equally ambiguous: a timeout that
failed *after* the effect landed is indistinguishable from one that did not.

**Validation (all run):**

```text
node --import tsx --test tests/effect-ledger.test.ts
  -> tests 10 / pass 10 / fail 0

  effect key stable across a retry, different on any component change; explicit key wins
  mode identity and resolved grants recorded on every entry
  a record from another engagement is refused
  a completed effect is not re-dispatched
  8 concurrent resumers -> exactly 1 execution
  a claimed-but-incomplete effect is not re-dispatched by default; the caller can see it is stuck
  re-dispatch of an incomplete effect happens only on explicit opt-in
  a failed effect is not retried by default; opt-in retries it

npm run typecheck  -> 0 errors
npm test           -> tests 365 / pass 363 / fail 0 / skipped 2   (318 baseline + 47 new)
```

---



**Additional validation for the SARIF emitter and checkpoint (all run):**

```text
node --import tsx --test tests/evidence-sarif.test.ts
  -> tests 9 / pass 9 / fail 0
     fingerprint unchanged when the model rewords the message  <- the point of the module
     fingerprint changes when path/category/code changes; unaffected by severity or line numbers
     2.1.0 log with a versioned key; duplicates collapse with occurrenceCount
     baselineState unchanged/new; rank derived from severity; fingerprints round-trip as a baseline

node --import tsx --test tests/checkpoint.test.ts
  -> tests 7 / pass 7 / fail 0
     only completed effects are recorded (blocked and failed are excluded)
     lineage chained; graph signature independent of tool registration order
     restore succeeds on a matching shape; refused on a mode-version, tool-set, or gate change

npm test -> tests 381 / pass 379 / fail 0 / skipped 2   (318 baseline + 63 new)
```

**Two test defects were found and corrected during this milestone**, both cases of a test asserting
something the code does not (and should not) do: a rank test that used two findings with identical
stable components, which correctly collapsed into one result; and a retry test that assumed a failed
effect is retryable by default, when a timeout that failed *after* the effect landed is
indistinguishable from one that did not.
## M5. Context admission boundary  **[DONE]**

- [x] **One centralized admission point covering all three channels** - `src/core/context-admission.ts`:
      `tool_result`, `extension_message`, `background_notification`. There is deliberately **no
      parameter that exempts a channel**, because the recorded incident came through the one that was
      exempt.
- [x] **Oversized content is replaced** by source, channel, digest, omitted size, line count, and an
      artifact reference. The raw payload is **absent** from model-visible content, not merely
      truncated-and-included.
- [x] **Generated and dependency trees are not delivered as actionable context**, even when small - a
      diagnostic about a downloaded tool tree is a fact about the tree, not an instruction about the
      task.

**Validation (all run):**

```text
node --import tsx --test tests/context-admission.test.ts
  -> tests 6 / pass 6 / fail 0

  the recorded 2,865,326-character background diagnostic:
      compacted to under 3000 characters
      digest retained, omitted size retained, channel and source retained
      artifact reference present, and the full payload written to the sink (not the transcript)
      a distinctive marker from deep inside the payload is ABSENT from the admitted content
  all three channels are compacted by the same boundary
  small actionable content passes through unchanged
  a node_modules diagnostic is marked non-actionable even at 30 characters
  path classification: node_modules/vendor/.venv/site-packages/dist/build/out/target/coverage/.git/.cache
      are non-actionable; src/core/loop.ts, docs/distribution.md, tests/target.test.ts are not
  with no artifact sink configured the payload is still omitted and the digest still retained

npm run typecheck  -> 0 errors
npm test           -> tests 387 / pass 385 / fail 0 / skipped 2   (318 baseline + 69 new)
```

**Why the marker assertion matters.** The test places a unique string *past the head window* and
asserts it is absent, rather than asserting on length. "Truncated" and "absent" are different
guarantees, and only the second one survives a later change to the head window.

---

## M6. Capability scoping (the strongest measured control)  **[DONE]**

- [x] **Typed capabilities, and the ceiling derived from trusted input** - `src/core/capability-scope.ts`.
      The scope is constructed from the mode's declaration, not computed after reading a repository.
- [x] **Stored outside the model's context.** Nothing in the module renders capabilities into prompt
      text, and a structural test asserts the exported surface is exactly
      `{authorize, capabilitiesOf, narrow}` - a capability the model can read is one it can be
      persuaded to describe.
- [x] **Per-agent sets, checked against the issuing agent.** A capability granted to one agent is not
      available to another, so a delegated subagent cannot borrow its parent's authority by existing.
- [x] **A delegate may narrow, never widen.** Anything the containment check cannot *decide* is
      refused, because a guess in this direction is a privilege escalation.

**A resource pattern language was needed, and its size is deliberate.** The first implementation
matched resources by exact string, which made a declared `reports/**` meaningless - caught by a test.
The fix is not full globs: deciding containment between two arbitrary globs is exactly where a
containment check starts guessing. The language is therefore two forms - an exact string, and `P/**`
meaning `P` and anything beneath it - and an unrecognised pattern is refused rather than interpreted.

**Validation (all run):**

```text
node --import tsx --test tests/capability-scope.test.ts
  -> tests 10 / pass 10 / fail 0

  allows a held capability
  denies an unheld capability "however plausible the name"      <- the injection case
  denies an agent with no capability set at all                 <- fail closed, not permissive
  enforces resource restrictions and reports what is held instead
  stops honouring an expired capability
  does not let one agent's capability be used by another        <- the delegation case
  lets a delegate narrow its authority
  refuses a delegate that widens, including by claiming a broader resource
  narrows an unrestricted parent capability by adding a resource
  exposes no path that renders the capability set into model-visible text

npm run typecheck  -> 0 errors
npm test           -> tests 397 / pass 395 / fail 0 / skipped 2   (318 baseline + 79 new)
```

**Review gate G3** applies here: this is the control the security evidence says carries the most
weight (injected effect executes in 3/75 runs under capability scoping versus 33-47/75 under
ambient-authority baselines). It should be reviewed before any vertical ships.

---

## M7. First vertical - code auditing (lowest blast radius)  **[DONE]**

- [x] **One mode, three files, no core code change** - `modes/code-audit/{MODE.md, governance.yaml,
      permissions.yaml}`, loaded from disk by the real loader.
- [x] **SARIF output** with stable `partialFingerprints`, `baselineState`, `occurrenceCount`, and a
      rank derived from severity (M4).
- [x] **Re-runs are diffable**: a reworded message keeps its identity; a changed finding gets a new
      one; an untouched finding stays `unchanged`.

**The "no core change" claim is tested, not asserted.** The test reads every file in `src/core`,
strips comments, and fails if the mode id appears in executable code. A vertical that needs a core
change is a framework defect, not a vertical feature.

**A test defect found and corrected.** The first version of that check failed on
`evidence-sarif.ts`, whose module docstring says which vertical motivated it. The docstring is
documentation, not a special case, so the **test** was refined to strip comments rather than the
docstring being rewritten to satisfy it.

**Validation (all run):**

```text
node --import tsx --test tests/code-audit-mode.test.ts
  -> tests 5 / pass 5 / fail 0

  loads from disk; the mode's own permission policy applies (read_* allow, report.write ask,
      shell.exec deny - the deny list survives the mode's settings)
  no per-vertical branch in src/core (comments stripped)
  identical finding identities across two runs, including a model-reworded message
  baselineState: changed -> new, untouched -> unchanged, added -> new
  the mode's conformance gate runs end to end: an in-scope action executes, a deploy is blocked
      with "does not authorize action 'deploy'"

npm run typecheck  -> 0 errors
npm test           -> tests 402 / pass 400 / fail 0 / skipped 2   (318 baseline + 84 new)
```

---

## M8. Second vertical - penetration testing  **[DONE]**

- [x] **Mode carries the full contract** - `modes/pentest/{MODE.md, governance.yaml, permissions.yaml}`:
      scope as actions *and* expected outcomes, a grant-graph reference, capabilities, expiry, a
      **per-phase intensity vector**, excluded technique classes, time windows, and coordination fields.
- [x] **Example engagement contract** - `engagements/example-engagement/authority.yaml`, the grant graph
      from design section 3.5: principals, grants with signed evidence and third-party approvals,
      targets with ownership evidence and required grants.
- [x] **A run is blocked until the authorization is valid** - `preflightAuthority`, a generic check
      that applies to any conformance-gated mode. Without it, the absence of a signed grant would only
      surface when the first action was attempted.

**Validation (all run):**

```text
node --import tsx --test tests/pentest-mode.test.ts
  -> tests 12 / pass 12 / fail 0

  loads from disk; dos.* is denied rather than asked about
  an action covered by every required grant is allowed, naming both grants
  out-of-scope target -> blocked
  ownership evidence unverifiable -> blocked
  outside the engagement window -> blocked
  excluded technique -> blocked; over-ceiling intensity -> blocked; the ceiling is per phase
  missing signed authorization -> the run does not start
  a required grant absent from the document -> the run does not start
  a third party's approval lapsed -> the run does not start
  the example engagement pre-flights clean
  the mode's conformance gate drives the example contract end to end

npm run typecheck  -> 0 errors
npm test           -> tests 414 / pass 412 / fail 0 / skipped 2   (318 baseline + 96 new)
```

**Three framework improvements came out of fixture mistakes, which is the useful direction for a
mistake to go.**

1. **A silently ignored key in the authority document is now rejected.** Writing the first fixture, a
   grant listed its targets under `authorizes`, where no such field exists. It parsed, the target list
   was ignored, and the failure surfaced later as an unrelated `undefined`. That is exactly the failure
   mode this framework refuses everywhere else, so `validateAuthorityDocument` now rejects unknown keys
   at the document, grant, and `authorizes` levels - and there is a test for the precise mistake.
2. **`risk_acceptance` was missing from the `Grant` type.** The validator caught the fixture using a
   field the type did not have. NIST SP 800-115 Appendix B 1.4 requires risks and mitigations to be
   identified before testing, so the type was wrong, not the fixture.
3. **A grant is evidenced by a signed document *or* by an approved external authorization.** Requiring
   documentary evidence from every grant blocked the third-party approval grant, whose approval form
   *is* its evidence. A grant with neither is still an unauthorized grant and still stops the run.

---

## M9. Third vertical - quantitative trading (highest blast radius, deliberately last)  **[DONE]**

- [x] **Limit gate with pre-trade thresholds** - `modes/trading/governance.yaml` declares a notional
      ceiling and a quantity band; `src/core/gate-limit.ts` enforces them before the venue sees
      anything. An unevaluable limit is a **block**, never a pass.
- [x] **The effect identity doubles as the client order id** - `toClientOrderId` maps the framework's
      identity onto a venue-safe id (Binance documents `newClientOrderId` as
      `^[\.A-Z\:/a-z0-9_-]{1,36}$`). This is what makes *"the effect key is an idempotency key the
      backend honours"* true rather than aspirational: the framework and the venue are talking about
      the same string.
- [x] **An ambiguous submission is never auto-retried** - a timeout may have filled, and the framework
      does not guess.
- [x] **Sandbox only.** The mode declares `environment: non-production` and excludes
      `production-venue`; `production.*` is on the deny list.

**Validation (all run). No live endpoint is contacted** - the venue in the test is a sandbox double
implementing the documented duplicate-rejection semantics, because the point is the mechanism rather
than connectivity.

```text
node --import tsx --test tests/trading-mode.test.ts
  -> tests 7 / pass 7 / fail 0

  loads from disk; production is out of reach (non-production scope, production-venue excluded,
      production.* denied, order.withdraw_funds denied)
  an over-threshold order is blocked pre-trade and the venue never sees it
  an order whose limit cannot be evaluated is blocked
  the client order id is stable across retries, venue-safe, and <= 36 characters
  a resume that resubmits the same order does not double-execute
  a duplicate the framework's own ledger did not see is rejected by the venue  <- the id is the last line of defence
  an ambiguous submission is not auto-retried

npm run typecheck  -> 0 errors
npm test           -> tests 421 / pass 419 / fail 0 / skipped 2   (318 baseline + 103 new)
```

**Review gate G4 was satisfied before this milestone started** (M6 and M8 both green).

---

## Cross-cutting requirements (apply inside every milestone)

These six patterns come from reading the actual control code of real vertical implementations
(design section 4.3). They are not a separate milestone; each one lands inside an existing one.

| Requirement | Lands in | Why it exists |
|---|---|---|
| **Split governance from the prompt.** `MODE.md` stays portable; `governance.yaml` and `permissions.yaml` carry the fields nothing else in the ecosystem has | M3 | Keeps the interop artifact valid while the governance fields stay reviewable and diffable |
| **Declare the policy externally, enforce it inside the loop, return a typed reason, and make it inheritable** so a spawned subagent cannot bypass it | M2 + M6 | Verticals will spawn subagents; a gate a delegate can escape is not a gate |
| **Log the gate's invocation, not only its decision** - an allow is logged too | M2 | The survey's most common real failure is a gate that exists but is **off the path**. An allow-side log line is the only way to detect it |
| **A block carries remediation, not only refusal** - return the reason *and* what to do instead | M2 | Otherwise the model retries the identical action |
| **Finding identity excludes model prose, and the key is versioned** | M7 | A prose-derived identity is unstable across runs, which makes the baseline diff meaningless |
| **Idempotency is a separate control from scope, and the framework owns the key** | M4 | Confirmed from two independent directions (design 5.2 and the vertical survey) |

### Mode version stamping (required from M4 onward)

Every evidence record carries **mode id + mode version + governance version**. The survey found that
**no surveyed project records which mode version a given run used** - versions pin content, only evals
pin behaviour. Without this, "what was this agent allowed to do when it did that?" is unanswerable
after the fact.

### Fail-closed is the default, everywhere

The single most common observed failure across all three verticals is **fail-open at the boundary** -
the cleanest example being a scope checker that returns `True` for an empty scope. Every milestone's
validation must include the *absent-configuration* case, not only the *present-but-wrong* case.

## Validation commands (whole-task gate)

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
```

Plus the milestone-specific tests above. A milestone is not done until its own validation passes **and**
the whole-task gate still passes.

## Rollback points

Every milestone is independently revertable. Additionally, by construction:

- Disabling a **mode** must never require a framework change.
- Disabling the **framework** must leave the session log readable and the evidence intact.
- Replacing the **first adapter** must not require touching the gate, the mode schema, or the evidence
  plane - that is the whole point of design 10.1.

## Explicit non-goals

- Implementing the trading, pentest, or audit *verticals* beyond one mode each to prove the seams.
- Any live production trading endpoint. Sandbox/testnet only.
- Any unauthenticated scanning of third-party targets.
- Replacing the Pi TUI or building a second chat interface.
- Adopting a third-party agent framework as the base (design section 11).

## Open items carried in

- Design 10.3 (field **names**) and 10.5 (first adapter confirmation) are still open pending the
  GitHub survey wave. Neither blocks M1-M2; both should close before M3 freezes the schema into
  documentation.
- Design 10.4 (machine-readable authority grant graph) is genuinely unsolved and blocks M8's full
  implementation. It needs its own design pass.
