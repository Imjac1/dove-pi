# Implementation plan

## Preconditions

- `design.md` and this file exist; `prd.md` carries AC1-AC8.
- Research is complete: 20 files in `research/`. **Read `design-constraints-from-evidence.md` first** -
  it is the seven constraints everything else must satisfy. Then `exactly-once-premise-correction.md`,
  which changes what the effect ledger may claim.
- The gate is: `npm run typecheck` clean, `npm test` green, and **every module the harness relies on is
  reachable from an entry point**.

## M0. Reachability as a test, before anything else

Nothing else can be verified while the defect that started this task - a module nothing reaches - has no
detector.

1. A test that walks relative imports from the four entry points and fails if any module under `src/core/`
   is unreachable **unless it is listed in an explicit allow-list with a reason**.
2. The allow-list starts with today's 12, so the test is green on arrival and **turns red as M1-M4 wire
   them**. Removing an entry is the definition of done for that module.

   The 12, re-derived independently on 2026-09-26 and matching `research/ground-truth-what-runs.md` exactly:
   `loop.ts`, `loop-runner.ts`, `gate-limit.ts`, `gate-conformance.ts`, `work-mode.ts`, `authority.ts`,
   `capability-scope.ts`, `effect-ledger.ts`, `checkpoint.ts`, `context-admission.ts`, `dispatcher.ts`,
   `dispatch-policy.ts`. Two further modules are unreachable outside `src/core` -
   `adapters/loop-pi-agent-core.ts` and `adapters/loop-scripted.ts` - and belong in the same allow-list.
3. **Normalize `..` when resolving a specifier, and assert the reachable count too.** The first attempt at
   the re-derivation did not, and reported 24 unreachable instead of 12 - all 12 extras false positives -
   with exit status 0 either way. An assertion on the unreachable set alone cannot tell a broken walk from a
   clean tree.

**Validate**: the test passes now, and fails if an entry is removed from the allow-list while the module
stays unwired.

## M1. The effect claim at the dispatch line

**Wiring point: `src/core/loop-runner.ts:135`**, the only site that runs a tool. **Not at an approval
boundary** - an approval gate re-executes whatever sits before it.

1. `EffectOutcome` gains `"unknown"`. Today it is `"completed" | "failed" | "cancelled"`, so "in flight"
   cannot be expressed and the checkpoint's "only completed effects count" rule has to guess.
2. `EffectClass` per tool: `"idempotent" | "key-idempotent" | "non-idempotent"`; only the first two
   automatically retryable.
3. **One atomic claim** - compare-and-swap or a unique constraint - in a store **shared across hosts**. The
   in-memory store's own docstring says it is "atomic only within one JavaScript realm; the duplicate it is
   meant to prevent crosses hosts". **A real store is the point of this milestone.**

   **Decided 2026-09-26 - do not re-litigate this, the evidence is in
   `research/effect-claim-store-evidence.md`.** The store is a directory of claim files under the project
   state root; the claim is the **exclusive create** of that file (`openSync(path, "wx")`, verified to raise
   `EEXIST` on this runtime), never a read followed by a write. Record states are
   `in_flight | completed | failed | cancelled | unknown`, and `unknown` is reached by construction: a crash
   between the create and the outcome write leaves `in_flight` with no outcome.

   **Two rules that are easy to get wrong, both stated in the design:**
   - **Do not reuse `project-provider/lock.ts`'s staleness reclamation.** That lock deletes a lock older
     than ten minutes and retries; copying it here would re-execute an effect whose outcome is unknown. A
     claim with a dead owner is surfaced as `unknown` and never reclaimed.
   - **Claim the run in a second process in the test, not just a second call in one process.** The failure
     this milestone prevents is cross-process, and it is the one the in-memory store cannot express.
4. The claim is taken **before** dispatch; a second attempt is refused and **reported**, not silently
   skipped.
5. **Documentation changes**: the module stops describing itself as an exactly-once primitive and states
   **at-most-once dispatch from our own resumption paths, plus a key the tool must forward**.

**Validate**: a test that dispatches the same effect twice within one process **and once in a second
process** reaches the tool once, refuses the others, and records `unknown` for an interrupted run.

### M1 record, 2026-09-26  **[DONE]**

Implemented: `EffectOutcome` gains `unknown` and the module stops calling itself an exactly-once primitive;
`EffectClass` with `effectClassOf` failing safe to `non-idempotent` and reporting `declared: false`;
`isAutomaticallyRetryable`; `ClaimResult.unreadable`; `EffectKeyConflictError` for one key carrying two
payloads; `EffectRetryRefusedError` for a retry opted into without a retryable class; `EffectLedger.outcomeOf`
so an interrupted run reads `unknown` rather than absent or failed; `createFileEffectStore` (exclusive create,
`fsync` before the claim is returned, write-then-rename on completion, and a dead owner's claim never
reclaimed); and the claim wired at `loop-runner.ts:135` with refusals reported through the new
`LoopOutcome.refusedEffects`.

**Two findings, and both are about the plan rather than the code.**

1. **No milestone in this task makes the reference loop reachable, so M1's wiring point is exercised by tests
   only.** M2, M3 and M4 wire the host's hooks and the host's own startup path, and the host runs its own
   loop. This was not inferred: adding `src/core/effect-store-file.ts` turned M0's reachability test red and
   the test named exactly that module - M0 working as intended, and the plan's gap stated by it.
   **AC8 says every module the harness relies on must be reachable from an entry point**, so the effect
   boundary needs a second adapter on the host's `tool_call` / `tool_result` hook pair - claim before, refuse
   when already claimed, complete after - which `research/host-hook-surface-verified.md` establishes both
   hooks can carry. That is the same "one policy, two adapters" shape M2 already uses for the gate. It is
   **not in this milestone's scope as planned**, and it is raised with the user rather than absorbed.

2. **This layer cannot promise cross-host exclusion, and the code now says so instead of implying it.** The
   store's docstring states the bound (one host, a local filesystem) and cites why every candidate primitive
   fails across a mount; `effect-ledger.ts` no longer calls itself an exactly-once primitive. AC5 is the
   reason that is a finding and not a footnote.

**Validation (all run):**

```text
node --import tsx --test tests/harness-effect-claim.test.ts  -> tests 13 / pass 13 / fail 0
node --import tsx --test tests/harness-reachability.test.ts  -> tests  6 / pass  6 / fail 0
node --import tsx --test tests/effect-ledger.test.ts         -> tests 10 / pass 10 / fail 0

npm run typecheck -> 0 errors
npm test          -> tests 515 / pass 513 / fail 0 / skipped 2   (502 after M0, +13)
```

**One test change, with its reason.** The two opt-in retry tests in `effect-ledger.test.ts` now pass
`effectClass: "key-idempotent"`. Their assertions are unchanged; what changed is that the declared class,
rather than the caller's belief, is what makes the retry safe - which is what those tests were always
asserting in their own names ("because the backend's key makes it safe"). Before this, the opt-in alone was
accepted, which is the substitution this contract exists to prevent.

## M2. The gate, behind the callback the host already calls

**Seam: `src/pi-adapter/extension.ts:1333`**, already fail-closed, already receives `args`.

1. Compose `gate-limit` and `gate-conformance` behind that callback.
2. **Deny is evaluated independently of allow and wins** (C3). Codex's "deny beats write, write beats read"
   is the precedent; Claude Code's `EndConversation`, which skips `PreToolUse` entirely, is the
   counter-example. **Check `loop.ts` for an override path** - C3 is unverified and this is where it is
   verified.
3. **A gate that cannot evaluate blocks.** Already the behaviour at `fast-path.ts:51`; the new gates must
   not weaken it.
4. **Record the refusal** with its reason. `capability.blocked` already exists on this path.

**Validate, end to end and not in a unit test**: an order above its declared limit is refused; a target
outside the authority document is refused; both refusals appear in the ledger with their reasons.

**Prerequisite, landed 2026-09-26:** the limits and effect classes this milestone gates against are now
validated and exposed by the mode loader, and the trading thresholds come from
`modes/trading/governance.yaml` rather than a test - see the M3 prerequisite record. **This milestone cannot be
observed end to end until M3's load lands**, because the limits and the authority document are mode content and
the host has neither today.

### M2 record, 2026-09-26  **[IN PROGRESS - the limit half has landed at the host]**

Landed: **the limit gate at the host's `tool_call` boundary**, built once at session start from the loaded
mode's declared limits (a gate rebuilt per call is a gate whose thresholds can differ between two identical
actions), and **a `gate.refused` record in the execution ledger** carrying the tool, the action, the gate, the
reason and the remediation. The action mapping grew the other half of itself: a policy reads **a capability's
own arguments**, not the envelope that carries them, because a mode declares a limit as a path into the
action's payload (`order.notional`) and `{name, args}` is the transport's business.

**Four findings.**

1. **The gate is evaluated after every input mutation in the handler, and that placement is the requirement.**
   The host re-validates nothing after a mutation (`types.d.ts:703-708`), and this handler mutates `event.input`
   twice before dispatch (`applyAdaptiveShellTimeout`, `normalizeLsToolInput`). A gate placed at the top of the
   handler would have permitted something other than what runs. The reason is now in the code at the call site,
   not only in the research file.
2. **The gate sits behind a pre-existing boundary: `tool_call` returns early without an active request lease.**
   So the limit gate applies inside a Dove-managed request and not outside one. The mode's *refusal* and *deny*
   checks are deliberately before that early return, so a broken mode still stops an unmanaged call. Stated
   because it decides when the gate can fire at all - and because the host-level test had to establish a
   request before the assertion meant anything.
3. **\"Both refusals appear in the ledger\" needed a new ledger event, not a reuse.** `capability.blocked` is a
   capability-invocation refusal with capability-shaped details; a gate refusal happens at the pre-tool-call
   boundary and covers every tool. They are now separate kinds, and the `kind` union is a named type in
   `contracts.ts` so the append methods and the projection cannot drift from it.
4. **The conformance half is blocked on two things, and neither is code.** There is **no loader for an authority
   document** (only `validateAuthorityDocument`), and *nothing in the design says how a tool call resolves to a
   target* - `AuthorityRequest.target` must name a target the document declares (`t-web`), while a host tool call
   carries a command or a path. code-audit makes it sharper: its `authority.grant` is a bare name
   (`local-review`) with no document behind it at all, while its `gate.semantics` says `conformance`. Raised with
   the user rather than invented.

### M2's conformance prerequisite, landed 2026-09-26  **[DONE]**

Landed: **a mode declares its authority target argument** (`gate.target_argument`, option 1 of the three put to
the user) and **a conformance mode must resolve its grant document or refuse to load**. The document is parsed
with **both** checks (structural and unknown-field) and resolved relative to the workspace, and the host holds
the loaded document for the run rather than re-reading it per action.

**Four findings.**

1. **There was no loader for an authority document - only a validator over an object someone had already
   parsed.** So the structural checks were done nowhere: a document missing `grant.targets` parses, validates
   (unknown fields are all fine), and then `undefined` comparisons quietly fail at evaluation time. That is the
   same defect the unknown-field check exists for, approached from the other side, so `parseAuthorityDocument`
   names both a missing key and an unknown one, with the file it came from.
2. **The fail-closed rule has teeth, and the consequence is pinned rather than surprising.** Requiring a
   document means **`modes/code-audit` now refuses to load**: it declares `gate.semantics: conformance` and its
   `authority.grant` is the bare name `local-review`, so there is nothing an action could be checked against.
   The refusal names both ways out (point the grant at a document, or declare `gate.semantics: limit`), and a
   test pins it. **The mode was not silently changed and no document was fabricated for it**: an honest
   code-audit document needs `ownership_evidence` with a real `sha256`, and inventing a digest is exactly the
   false-evidence defect this project refuses. That is a content decision for the user.
3. **`authority.ts` left the reachability allow-list**, the second time the list has shrunk, and again the
   assertion is what noticed - the mode loader now resolves the document, so the module is reachable from the
   host.
4. **`targetArgument` is declared and validated, and nothing reads it yet.** Stated as a pending consumer
   rather than as a wired control: the conformance gate that reads it is the next step, and until then the
   mode's target argument is a declaration with no runtime effect.

**Validation (all run):**

```text
node --import tsx --test tests/host-work-mode.test.ts -> tests  7 / pass  7 / fail 0   (+1: the pinned code-audit refusal)
node --import tsx --test tests/work-mode.test.ts      -> tests 30 / pass 30 / fail 0   (the real pentest mode loads with its document)
node --import tsx --test tests/harness-reachability.test.ts -> tests 6 / pass 6 / fail 0   (allow-list 11 -> 10)

npm run typecheck -> 0 errors
npm test          -> tests 541 / pass 539 / fail 0 / skipped 2   (540 before, +1)
```

**Still open from M1:** the effect boundary's second adapter on `tool_call`/`tool_result`, which is the same seam
as this milestone's and should share its change.

**Validation (all run):**

```text
node --import tsx --test tests/host-work-mode.test.ts -> tests  6 / pass  6 / fail 0   (5 before, +1: the limit refusal and its ledger record)

npm run typecheck -> 0 errors
npm test          -> tests 540 / pass 538 / fail 0 / skipped 2   (539 after M3's load, +1)
```

## M3. The mode, loaded by the host

**Wiring point: the host's startup path.** `work-mode.ts` is unreachable today.

1. The host loads `modes/<name>/` at startup: capabilities, authority document, limits, effect classes.
2. A mode that fails validation **refuses to start** rather than starting unconstrained.
3. `modes/code-audit/` becomes the first real load, and the existing permission policy gets its **runtime
   consumer** - today `loadWorkMode` and `evaluatePermission` are test-only.

**Validate**: delete a capability from the mode and observe the running agent lose it; corrupt the mode and
observe a refusal to start.

### M3 prerequisite, landed 2026-09-26  **[DONE]**

M3 says the host loads "capabilities, an authority document, **limits**, and **effect classes**". The loader
accepted `gate.limits` as a field and **never read it**, and had no effect-class concept at all, so neither was
available to load. That is fixed ahead of M3 rather than inside it, because the mode files already write
against this schema:

- `WorkMode` carries `limits: readonly LimitSpec[]` and `effectClasses: Readonly<Record<string, EffectClass>>`,
  both validated at load.
- `gate.limits` is parsed in the shape the mode files **already declare**: a mapping keyed by limit id, which is
  what `modes/trading/governance.yaml` contains. A limit with neither bound, a non-finite bound, an unknown
  field inside a limit, an empty id, and an inner `id` are each a **load** error naming the mode.
- `governance.effects.classes` is new: design 5.4 requires the map and nothing carried it. An unrecognised
  class value is refused by name rather than defaulted, because the default is the dangerous direction.
- `LimitSpec` gained `tools`, because `LimitGateOptions.tools` scopes the whole gate and cannot separate two
  limits that belong to two different actions.
- `modes/code-audit/governance.yaml` declares its effect classes and moves **1.3.0 -> 1.4.0**: the map changes
  what the mode authorizes, which is the convention `code-audit-mode.test.ts` asserts.

**Four findings.**

1. **A declared field was never read, so the threshold lived in a test.** `trading-mode.test.ts` built its limit
   gate from a hardcoded array while `modes/trading/governance.yaml` declared the same thresholds in the file a
   reviewer reads. The test now builds the gate from the loaded mode's `limits` and asserts where they came from.
   **That is this task's defect class, found inside a test fixture.**
2. **The declared shape is a map keyed by id; the first parser assumed a list, and the data corrected it.** A
   list is now refused with a message naming the expected shape, because an inner `id` would be a second name
   for a limit its key already names.
3. **M2 depends on M3, and the plan lists them the other way round.** M2's validation is "an order above its
   declared limit is refused; a target outside the authority document is refused" - and both the limits and the
   authority document **are mode content**. The host has neither today: `extension.ts` contains no reference to
   `authority`, `limits` or `work-mode`. So M3's load lands first, and M2 is observed end to end after it.
4. **Which mode the host loads is still open.** The workspace policy offers `development | pentest`; the mode
   directories are `code-audit | pentest | trading`. M3 says "`modes/code-audit/` becomes the first real load",
   which means either the workspace policy gains a mode, or `development` maps to one, or the mode is selected
   another way. **Raised with the user rather than assumed**, because it decides what a mode *is* in this
   product.

**Validation (all run):**

```text
node --import tsx --test tests/work-mode.test.ts       -> tests 21 / pass 21 / fail 0   (13 before, +8)
node --import tsx --test tests/code-audit-mode.test.ts -> tests 15 / pass 15 / fail 0   (14 before, +1 new test)
node --import tsx --test tests/trading-mode.test.ts    -> tests  7 / pass  7 / fail 0   (same suite, limits now loaded)
node --import tsx --test tests/gates.test.ts           -> tests 18 / pass 18 / fail 0   (17 before, +1)

npm run typecheck -> 0 errors
npm test          -> tests 525 / pass 523 / fail 0 / skipped 2   (515 after M1, +10)
```


### M3 record, 2026-09-26  **[IN PROGRESS - the load has landed]**

Landed: the loader's selection and directory reading (`resolveWorkModeSelection`, `loadWorkModeFromDirectory`,
`workModeRefusal`); the **host load at `session_start`**; the fail-closed refusal that blocks every tool call
while a declared mode is unreadable; and the `never_allow` consumer at `tool_call`, which needed the action
mapping in `src/pi-adapter/action-identity.ts` first. `bin/dove-pi.cjs` now exports
`DOVE_PI_FRAMEWORK_VERSION`.

**Five findings.**

1. **The permission sets named actions that do not exist, so the policy was inert.** `never_allow: [shell.exec]`
   never fired against the tool `bash`, because a mode names **Dove actions** while Pi names **tools**, and the
   umbrella capability tool carries its real action in `input.name`. Wiring `evaluatePermission` without the
   mapping would have produced `ask` for every tool - a control that reads as present and does nothing. The
   mapping is now one function, and the host-level test shows `shell.exec` being refused through
   `agent_run_capability`.
2. **`always_allow: read_*` still matches nothing real.** The capabilities are dotted (`repo.read`), so the
   pattern matches neither a capability nor the host's `read` tool. **Not rewritten here**: choosing which real
   action the author meant is a content decision in a security-relevant file, and inventing it would be the
   silent-rewrite defect. Recorded for the user, with the observation that the entry is currently inert.
3. **There was no framework version at runtime to check a mode's range against.** The launcher exports the
   package version as `DOVE_PI_EXTENSION_VERSION` and the extension consumes it as its *identity* version -
   a different number space that happens to agree until one of them moves. Added an explicit
   `DOVE_PI_FRAMEWORK_VERSION`; when it is absent the load is **refused naming the missing variable**, rather
   than compared against a wrong number or silently unchecked.
4. **`ask_before` is not consumed**, and the load now says so in a warning instead of leaving it implicit:
   `deny` is enforced, `ask` falls through. That is the remainder of this milestone's item 3, and an unstated
   gap is the defect this project keeps finding in configuration.
5. **M0's allow-list shrank for the first time.** Making `work-mode.ts` reachable from the host's startup path
   took `gate-limit.ts`, `effect-ledger.ts` and `loop.ts` off the list with it - fifteen entries to eleven - and
   the reachability test is what noticed, by asserting in both directions.

**Remaining in M3:** `capability-scope.ts` has no runtime consumer yet (item 1's "capabilities"), the
`ask_before` half of item 3, and item 1's "authority document" - the mode declares `authority.grant`, and
nothing loads that document yet, which is what M2's conformance gate needs.

**Validation (all run):**

```text
node --import tsx --test tests/host-work-mode.test.ts    -> tests  5 / pass  5 / fail 0   (new: the host, not a unit)
node --import tsx --test tests/work-mode.test.ts         -> tests 30 / pass 30 / fail 0   (21 before, +9)
node --import tsx --test tests/harness-reachability.test.ts -> tests 6 / pass 6 / fail 0   (allow-list 15 -> 11)

npm run typecheck -> 0 errors
npm test          -> tests 539 / pass 537 / fail 0 / skipped 2   (525 after the M3 prerequisite, +14)
```

## M4. Admission: delegate, and supply the policy

1. **Do not build a compressor.** The host has spill/retention/pruning. This resolves the
   three-implementations problem: `context-admission.ts` becomes the **policy**, and either delegates or
   is removed.
2. Implement **stage one only** - tool-result clearing - and do not build a summarizer.
3. Ship the digest-plus-reference shape and, critically, **the belief invalidation**: when content is
   dropped, the harness's own cached beliefs about it are dropped too.
4. **Do not split a tool-call/result pair.** Removing part of a loop breaks Anthropic thinking-block
   checksums and makes the request API-invalid.
5. **Mask rather than remove**, for prefix stability.

**Validate**: an oversized tool result reaches the model as a digest plus a resolvable reference; the full
payload is retrievable; and a dropped result does not leave a cached belief behind.

## M5. Acceptance: observables, not assertions

Wiring point: `task-convergence.ts` is already reachable from the host.

1. Close the known hole: `acceptance.passed` takes **optional** evidence refs today, so a pass need not be
   backed by anything. **A pass requires a resolvable observable the agent did not author.**
2. The observable must not live where the agent can edit it. SpecBench: every frontier agent saturates the
   visible suite while the held-out gap grows **28 points per 10x of code size**; and in 120
   kernel-checked proofs, **30% had spec defects**.

**Validate**: a criterion marked passed without a resolvable observable is refused.

## M6. The verification ladder

1. A cost-ordered ladder that **short-circuits** and records `decided_by`, returning **unscored** rather
   than a default if nothing settles (Inspect's `cascade()`). Its docstring states its own premise and the
   design should state it too.
2. Rungs 1-3 only: parse/typecheck/lint; run and read the exit status; **compare against a second
   implementation** (roundtrip, idempotence). **No model.**
3. Rungs must resist the agent weakening them: a **skipped** check counts as failed, the runner requires
   positive evidence it ran at all, and the parsed result is **cross-checked against the exit status**.

**Validate**: a deliberately weakened check is caught, and rung 3 catches a mutation that rung 1 misses.

## M7. Typed termination

1. A run that does not finish stops with a **typed reason**, visible to the operator. SWE-agent's
   `_BlockedActionError / _RetryWithOutput / _ExitForfeit / _TotalExecutionTimeExceeded` is the shape;
   Aider's `max_reflections = 3` is the budget.
2. Reproduce the most-reported production failure as a test: a run that cannot make progress **stops and
   says so**, rather than looping.

## M8. Truth in the documentation

1. `checkpoint.ts:12-13` cites "Microsoft's `WorkflowCheckpoint`". **No such class was found.** Remove the
   citation or replace it with one that exists.
2. Sweep for every claim about a guarantee the harness does not have (AC5).

## Validation

```bash
npm run typecheck                      # 0 errors
npm test                               # green, including the reachability test
node --import tsx --test tests/harness-*.test.ts
```

## Risky files and rollback

| File | Risk | Rollback |
|---|---|---|
| `src/pi-adapter/extension.ts` (2,736 lines) | the only running entry point | revert the `authorize` callback to the read-only check |
| `src/core/loop-runner.ts` | the effect claim enters at `:135` | remove the claim; behaviour returns to today's |
| `src/core/effect-ledger.ts` | `EffectOutcome` widens | the narrower union |
| `work-mode.ts` usage in the host | a bad mode refuses start | a per-mode bypass flag, removed after one release |

**Nothing in `src/core` is reachable today, so every wiring change has a blast radius of the host path
alone** - which is both why the work is needed and why it is safe to start.

## Follow-up checks before `task.py start`

- Confirm the host exposes a **pre-tool-call** boundary that can refuse, and whether it can refuse on
  **arguments** rather than only on a tool name.
- Confirm whether the host offers any hook that could contain **its own subprocesses**. C1 is a stated
  limitation only while the answer is no.
- Confirm `loop.ts` cannot be overridden once the gates are in it (C3).
