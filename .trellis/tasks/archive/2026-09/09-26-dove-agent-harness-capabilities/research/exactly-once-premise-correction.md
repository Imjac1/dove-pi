# Exactly-once: the premise is wrong, and the wiring point is known

- Date: 2026-09-26
- Source: `research/durable-execution-and-effects.md` (634 lines), read from LangGraph source at `main` and
  the vendor documentation of Stripe and Temporal

## 1. The correction

This project has been describing its effect ledger as an "exactly-once primitive". The research contradicts
that, from LangGraph's own source and docs:

> `interrupt()`: "The graph resumes from the start of the node, **re-executing** all logic"
> `interrupts.md`: "Side effects called before `interrupt` **must be idempotent** ... it will be **re-run
> multiple times** when the node is resumed ... **creating duplicate records**"

So **"exactly-once across interrupts, at-least-once across crashes" is a property of the durably recorded
task, not of the effect.** And the consequence for this project is concrete: **an approval gate duplicates
any effect placed before it**, which means the effector must sit at the **tool-dispatch line and never at an
approval boundary.** This repository's own design once proposed the opposite.

## 2. Why, from the code

- `pregel/_runner.py`: `Runner.commit()` is called only **after** the node returns, and then
  `put_writes(task.id, task.writes)`. **The durable record follows the side effect**, which is the
  late-commit window: a SIGKILL in between keeps the effect and loses the record. That is the exact mechanism
  behind "at-least-once across crashes".
- `pregel/_algo.py`: `get_null_resume(consume=True)` consumes the resume value with
  `pending_writes.remove(...)` on a **process-local list**. That is the code behind k concurrent resumers
  firing a gated effect k times, saturation 1.0 in 36 of 40 cells, across hosts.
- `libs/checkpoint/base/__init__.py`: `BaseCheckpointSaver` offers `get_tuple`, `list`, `put`,
  `put_writes`, `delete_thread`, `delete_for_runs`, `copy_thread`. **There is no atomic claim operation
  and no "has this task already had its effect" read.** It is a state-snapshot store, not a claim/commit
  registry.
- `main.py:2602`: the default durability is `"async"`, documented as "a small risk that LangGraph does not
  write checkpoints if the process crashes". `Durability = Literal["sync", "async", "exit"]`, and `"exit"`
  means no mid-run persistence at all.

## 3. The minimum at-most-once contract

Six parts, and all six are required:

1. **Deterministic effect identity computed before dispatch**, stable across attempts **and across
   processes**.
2. **One atomic claim** - a compare-and-swap, a unique constraint, a conditional write - **in a store shared
   across hosts. Not `has()` followed by `record()`, and not process-local.**
3. **A key the executor's backend enforces**, handed to the tool by the harness: a unique-constraint insert
   inside the effect's own transaction, a persisted key-to-response record, or a native venue parameter.
4. **A terminal outcome record that includes an "unknown" state.**
5. **A declared effect class per tool** - idempotent, key-idempotent or non-idempotent - with only the first
   two automatically retryable.
6. **A bound on in-flight time, or a refusal to auto-resolve.**

Explicitly **not** required: effect atomicity, read-back ability, reversibility.

## 4. And the guarantee is not the harness's to give

> "the contract explains 81%"; "the harness barely matters" - arXiv:2609.29095

Stripe's server stores the response, returns `Idempotent-Replayed: true`, and **refuses** a concurrent
same-key request with `idempotency_key_in_use`. Temporal explicitly refuses to promise more than
at-least-once, and `maximumAttempts = 1` - the way to get at-most-once - "means **zero times is also
possible**".

**So the true claim for this project is "at-most-once dispatch from our own resumption paths", plus an
idempotency key the tool must forward.** "Exactly-once" requires backend enforcement of the key and can never
be the harness's own property. The repository currently describes it as one.

## 5. On an outcome that cannot be determined

In descending order of how often it appears in frontier practice:

1. **Refuse and surface; do not guess.** Stripe returns an error rather than executing; the resume-contract
   repair "serves one racer and refuses the rest before any node executes"; this repository's
   `dispatchOnce` already defaults to `retryPriorAttempt: false` - skip and report. **That default is
   right.**
2. **Reconcile by key, not by content.** `Idempotent-Replayed: true` is the read-back signal; Temporal's
   answer for a business key is an entity or lock workflow keyed by that business key; a transactional
   outbox makes the intent durable in the same commit as the effect. Content-based read-back is the one
   **Temporal's own documentation calls racy**.
3. **Park and escalate to a human** when neither works - Temporal's "Resumable Activity ... park on a Signal
   that delivers corrected input".
4. **Re-dispatch only if the effect is key-idempotent** - exactly what the local
   `retryPriorAttempt` opt-in is for.

And never accept the agent's own account: **agents reported success in 90% of the episodes in which they had
duplicated an effect.**

**The design detail worth copying**: the good implementations keep **three** states - not started, done, and
**unknown**. A ledger with only done/not-done has to guess, and every default it can pick is wrong in one
direction.

## 6. Named published double-execution cases

From arXiv:2608.03836, measurements at **pinned releases**: **LangGraph 1.2.9** - "re-executes durably
recorded work after a real SIGKILL"; **CrewAI 1.15.2** - "re-executes completed effect-bearing methods
against its written claim"; **pydantic-graph 1.x** - cannot resume after a mid-node crash; plus the cross-host
k-resumer saturation. No company post-mortem could be found; the agent records that as a gap rather than
filling it.

## 7. The local wiring state, grep-verified

- `effect-ledger.ts` is imported **only as types**, by `checkpoint.ts:2` and
  `adapters/loop-pi-agent-core.ts:4`.
- **`src/core/loop-runner.ts:135` - `const raw = await options.executeTool(call, signal);` - is the only
  place a tool runs.** The gate is at `:120`, `onGateInvoked` at `:122`, and **there is no ledger on that
  path**. **That line is the wiring point.**
- `EffectRecord.outcome` is `"completed" | "failed" | "cancelled"` - **there is no "unknown"**, so the
  checkpoint's "only completed effects count" rule cannot express "in flight".
- `createInMemoryEffectStore`'s own docstring says it is not production-sufficient: "atomic only within one
  JavaScript realm; the duplicate it is meant to prevent crosses hosts". **A real cross-host `EffectStore`
  is the highest-leverage missing piece.**

## 8. A misattribution in this repository's own code

`checkpoint.ts:12-13` cites "the strongest precedent found in the wild (Microsoft's `WorkflowCheckpoint`)".
The agent could not locate any such class - the `microsoft/agent-framework` file listing it could retrieve
showed checkpoint files only under `dotnet/samples`. **Recorded as unverified. A code comment citing a
precedent that does not exist is the same defect family this project has been fixing all along**, and it is
in the file that is supposed to be the frontier-shaped one.

## Caveats to carry forward

- LangGraph was read at `main` on 2026-09-26, **not** at the 1.2.9 the paper measured. The structure should
  survive; the code read is not provably the code measured.
- Only the two arXiv **abstracts** were read, not the PDFs or their harnesses.
- Temporal's claims are its documentation and a first-party developer skill, not engine source. Stripe's are
  vendor API-reference pages.
