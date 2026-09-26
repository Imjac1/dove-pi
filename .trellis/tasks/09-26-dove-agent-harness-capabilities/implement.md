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
4. The claim is taken **before** dispatch; a second attempt is refused and **reported**, not silently
   skipped.
5. **Documentation changes**: the module stops describing itself as an exactly-once primitive and states
   **at-most-once dispatch from our own resumption paths, plus a key the tool must forward**.

**Validate**: a test that dispatches the same effect twice within one process **and once in a second
process** reaches the tool once, refuses the others, and records `unknown` for an interrupted run.

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

## M3. The mode, loaded by the host

**Wiring point: the host's startup path.** `work-mode.ts` is unreachable today.

1. The host loads `modes/<name>/` at startup: capabilities, authority document, limits, effect classes.
2. A mode that fails validation **refuses to start** rather than starting unconstrained.
3. `modes/code-audit/` becomes the first real load, and the existing permission policy gets its **runtime
   consumer** - today `loadWorkMode` and `evaluatePermission` are test-only.

**Validate**: delete a capability from the mode and observe the running agent lose it; corrupt the mode and
observe a refusal to start.

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
