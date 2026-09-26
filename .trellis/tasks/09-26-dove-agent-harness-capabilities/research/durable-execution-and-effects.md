# Research: Durable execution and exactly-once effects

- **Query**: How do the frontier durable-execution systems make an effect exactly-once - the *contract* on
  the effect, where the guarantee physically lives, what a resume does when it cannot determine whether an
  effect landed, and whether a claim/commit split exists in the wild with a stated default for an unfinished
  claim. Read the code, not the READMEs.
- **Scope**: Temporal (runtime + activity contract + saga/resumable-activity patterns), LangGraph
  (checkpointer interface, pregel loop, interrupt semantics, durability modes), Stripe idempotency keys and
  the published HTTP semantics, transactional outbox / saga, the two arXiv measurements this repo already
  cites, and the local `src/core/effect-ledger.ts` + `src/core/checkpoint.ts` + the dispatch seam in
  `src/core/loop-runner.ts`.
- **Date of research**: 2026-09-26. All pages and files fetched on this date.
- **Fetch methods used** (recorded per the task instruction):
  - `raw.githubusercontent.com/<owner>/<repo>/main/<path>` - **worked for every source file** I read
    (LangGraph, temporalio/skill-temporal-developer, LICENSE). Primary tool; it did not fail once.
  - `.md` twins of doc sites - `docs.temporal.io/<path>.md`, `docs.langchain.com/<path>.md`,
    `docs.stripe.com/<path>.md` - **worked**; the HTML of those pages is JS-rendered and effectively empty.
  - `ungh.cc/repos/<owner>/<repo>` for metadata and `ungh.cc/repos/<owner>/<repo>/files/<branch>` for file
    listings - **worked** (the listing is truncated at ~100 KB of JSON).
  - `arxiv.org/abs/<id>` HTML with the `citation_abstract` / `og:description` meta - **worked**.
  - Plain HTML plus my own tag-strip for `temporal.io/blog/...` and `microservices.io/...` - **worked**.
  - **Failed**: `web_search` (every engine failed: "firecrawl returned 429 ... keyless free tier rate
    limit"; "Every engine for the web source failed"). `docs.aws.amazon.com` SQS at-least-once page is
    JS-rendered and yielded **1,386 characters of text with no body**. `stripe.com/blog/idempotency` is
    JS-rendered too. I did **not** use the GitHub API, so I have no commit SHAs.
- **Ranking applied**: source code > reproducible measurement at pinned releases > official docs > forum
  claims. Vendor docs are named as vendor docs where they are the only support for a claim.

### Repositories touched, with the exact files read

| repo (owner/name) | stars | pushedAt | licence | files I read |
|---|---|---|---|---|
| langchain-ai/langgraph | 42,312 | 2026-09-26T04:38:30Z | MIT (LICENSE read) | ref `main`: `libs/checkpoint/langgraph/checkpoint/base/__init__.py`; `libs/langgraph/langgraph/pregel/_algo.py`; `.../pregel/_loop.py`; `.../pregel/_runner.py`; `.../pregel/main.py`; `.../langgraph/types.py`; `LICENSE` |
| temporalio/skill-temporal-developer | 222 | 2026-09-26T02:29:16Z | LICENSE present (1083 B), not opened | `SKILL.md` (no idempotency match); `references/core/patterns.md`; `references/core/gotchas.md` |
| microsoft/agent-framework | 13,802 | 2026-09-25T19:09:24Z | not read | file listing only (truncated); **no source file read** - see gaps |
| temporalio/temporal | not retrieved | - | - | **no file read**; Temporal claims below are docs + first-party skill, not engine code |

Stars/pushedAt come from `ungh.cc` on 2026-09-26, rounded as the service reports them; no SHAs.

---

## What the sources state

### Temporal - the durable-execution contract, and where it explicitly refuses to promise exactly-once

(Temporal docs, fetched as `docs.temporal.io/*.md`; quotes from those pages unless marked blog.)

- **The runtime guarantees at-least-once by default, and says so.** `encyclopedia/retry-policies.md`:
  "**Maximum Attempts** ... **The default is unlimited.**" And
  `temporal.io/blog/idempotency-and-durable-execution` (Keith Tenzer, Joshua Smith, 2024-02-27): "since
  Activities are just events in the Workflow history, Temporal is able to guarantee '**at least once**'
  execution ... limiting `maximumAttempts` to 1 and using normal Activities (not Local Activities) will
  guarantee '**at most once**' execution, **meaning zero times is also possible**."
- **The contract is placed on the activity, not the runtime.** `activity-definition.md`: "Temporal
  recommends that Activities be idempotent ... Activities should be designed to be safely executed multiple
  times without causing unexpected or undesired side effects." `activities.md`: "We recommend that it be
  idempotent, so retries can be processed without duplicate side effects."
- **The key must be enforced by the backend.** The blog's `SubmitOrder` example: "If
  `ExternalAPI.SubmitOrder` doesn't do anything when receiving duplicate order IDs (**for example, if the
  first thing it attempts is inserting a record into a database with a uniqueness constraint on the order
  ID** ...) then `orderId` serves as the idempotency key." If there is no natural key: use
  `workflowRunId + '-' + activityId`, "constant across Activity retries, and unique among all Workflows."
  If the data model has nowhere to put it, the blog prints the DDL: `CREATE TABLE operations
  (idempotency_key VARCHAR(255) UNIQUE NOT NULL)`, inserting **first**, inside the same transaction as the
  effect, `ON CONFLICT DO NOTHING`; a duplicate-key error means the effect already ran.
- **Replay does not re-execute completed activities.** `activity-definition.md`: "By design, completed
  Activities will not re-execute as part of a Workflow Replay." Blog: "During replay, activities that have
  already been executed are not re-executed. Instead Temporal simply takes activity input and output from
  its event history." Re-execution comes from **retry**, not replay.
- **The default when a claim is found unfinished is RETRY, and the reason is stated.**
  `encyclopedia/detecting-activity-failures.md`, Start-To-Close: "The Temporal Server **doesn't detect
  failures when a Worker loses communication with the Server or crashes**. Therefore, the Temporal Server
  relies on the Start-To-Close Timeout to force Activity retries." The timeout is measured from the moment a
  worker picked the task up. So claim = "a worker dequeued the Activity Task"; unfinished claim = "no
  completion before Start-To-Close" = retry. There is no reconciliation pass; the at-least-once retry *is*
  the resolution.
- **Check-before-act has an admitted race.** Blog: "There unfortunately **is a race condition** with this
  code ... If the first attempt takes a long time to run `ExternalAPI.CreateUser` - for example, longer than
  the Start-To-Close Timeout - then a second attempt will be run, and if the second attempt gets past the
  `UserExists()` check before the first attempt's `CreateUser()` completes, then **both the first and second
  attempts could successfully run `CreateUser()`**." Named mitigations: longer retry interval, honour
  Activity Cancellation, per-request timeout. The real fix named is a lock - "if we knew we were the only
  users of the API, we could implement the lock on our end with a **lock workflow**" (an entity workflow
  keyed by the business key).
- **When the outcome must not be guessed, park and ask a human.** `design-patterns/resumable-activity.md`
  ("Resumable Activity (AKA Pause On Failure)"): "After retries are exhausted, **park the Workflow in a
  waiting state and block on a Signal that notifies the Workflow to proceed or optionally delivers
  corrected input from a human operator, then re-execute the Activity.**" The workflow "waits indefinitely
  without polling, accepts an external correction, and completes without restarting."
- **Duplicate prevention for the unit of work itself.** Blog: two Workflow Executions with the same input
  are avoided when "Both Workflows have the same ID, and the second start request is received by the Server
  while the first is still running" or with Workflow Id Reuse Policy "Reject Duplicate" - "the Workflow Id
  acts as an idempotency key, and **the Server will return a duplicate error instead of creating the second
  Workflow**."
- `design-patterns/saga-pattern.md`: each step is a local transaction with a compensating action; on
  failure, compensations run in reverse order. A compensation is itself an effect, so it needs the same
  contract.

### Stripe - the client-supplied key the server enforces, and what happens mid-flight

(`docs.stripe.com/api/idempotent_requests.md`, `docs.stripe.com/error-low-level.md`,
`docs.stripe.com/error-codes.md`. Vendor docs, but these are the published semantics other systems copy.)

- "A **client generates** an idempotency key, which is a unique key that the **server uses to recognize
  subsequent retries** of the same request." Up to 255 characters; UUIDv4 or a user-attached object ID
  suggested; "Avoid using sensitive data ... as idempotency keys."
- "Stripe's idempotency works by saving the **resulting status code and body** of the first request made for
  any given idempotency key, **regardless of whether it succeeds or fails** ... Subsequent requests with the
  same key return the same result, **including `500` errors**."
- "We save results only **after the execution of an endpoint begins**. If incoming parameters fail
  validation, **or the request conflicts with another request that's executing concurrently, we don't save
  the idempotent result** ... You can retry these requests."
- `error-codes.md`: **`idempotency_key_in_use`** - "The idempotency key provided is **currently being
  used in another request**. This occurs if your integration is making duplicate requests simultaneously."
  This is the concrete behaviour on an unfinished claim: **refuse, do not execute a second time**, and name
  the case.
- "The idempotency layer **compares incoming parameters to those of the original request and errors if
  they're not the same** to prevent accidental misuse." A key with a different payload is an error, not a hit.
- "You can remove keys from the system automatically after they're at least **24 hours** old. We generate a
  new request if a key is reused after the original is pruned." Retention is part of the contract.
- Read-back signal: "To identify a previously executed response that's being **replayed** from the server,
  look for the header `Idempotent-Replayed: true`." And `Stripe-Should-Retry`: `true` = retry,
  `false` = "it won't have an additional effect", unset = the API cannot determine, so the client must fall
  back to status codes.
- Ordering caveat a harness must respect: "a request that's rate limited with a `429` can produce a
  different result with the same idempotency key **because rate limiters run before the API's idempotency
  layer**."

### LangGraph - what a checkpoint is, and why interrupts differ from crashes

(`docs.langchain.com/oss/python/langgraph/checkpointers.md`, `.../durable-execution.md`,
`.../interrupts.md`. Vendor docs; the mechanism claims are corroborated in code in the next section.)

- **A checkpoint** is "a snapshot of the graph state saved at each super-step", keyed by `thread_id`,
  surfaced client-side as a `StateSnapshot`. A super-step is one tick in which all scheduled nodes run.
- **The finer unit is per-task writes.** "In addition to super-step checkpoints, LangGraph also persists
  writes at the **node (task) level**. As each node within a super-step finishes, its outputs are written to
  the checkpointer's `checkpoint_writes` table as task entries linked to the in-progress checkpoint." And:
  "**Pending writes**: When a graph node fails mid-execution at a given super-step, LangGraph stores pending
  checkpoint writes from any other nodes that completed successfully at that super-step. When you resume
  graph execution from that super-step **you don't re-run the successful nodes**."
- **Durability modes**, default `"async"`:
  - `"exit"`: "persists changes only when graph execution exits ... means intermediate state is not saved,
    so **you cannot recover from system failures (like process crashes) mid-execution**."
  - `"async"`: "persists changes asynchronously while the next step executes ... there is **a small risk
    that LangGraph does not write checkpoints if the process crashes during execution**."
  - `"sync"`: "persists changes synchronously before the next step starts."
- **Interrupt semantics, stated twice, and it is not what "exactly-once across interrupts" sounds like.**
  `interrupts.md`: "**Side effects called before `interrupt` must be idempotent** ... Because interrupts
  work by **re-running the nodes** they were called from, side effects called before `interrupt` should
  (ideally) be idempotent ... it will be **re-run multiple times when the node is resumed**, potentially
  overwriting the initial update or creating **duplicate records**." Prescriptions: idempotent operations
  before the interrupt, side effects **after** the interrupt, or "**Separate side effects into separate nodes
  when possible**." Plus: "Avoid `while True` + `interrupt()` loops inside a single node. Because the node
  re-runs from the beginning on every resume ... The result is **exponential re-execution** of any code
  inside the loop body."

### arXiv 2608.03836 - "Resume Means Resume" (Sajjad Khan; v3 8 Aug 2026)

Abstract fetched verbatim from `arxiv.org/abs/2608.03836`. All findings `[SOURCE]`: measurement at pinned
releases with a deterministic, LLM-free harness.

- The RESUME CONTRACT has **six properties over the persistence API**: prefix continuation, **effect
  exactly-once**, fork determinism, checkpoint validity, **consume-once**, recovery determinism, plus
  fork-intent and liveness obligations. Checked with a TLA+ model (7.4M states) and TLAPS proofs; a 39-cell
  fault matrix.
- **LangGraph 1.2.9**: "durably records a second resume value and never consults it, persists
  schema-invalid state silently, and **re-executes durably recorded work after a real SIGKILL:
  exactly-once across interrupts, at-least-once across crashes, on one API**."
- **CrewAI 1.15.2**: "**re-executes completed effect-bearing methods against its written claim**."
- **pydantic-graph 1.x**: "**cannot resume after a mid-node crash**."
- "**Consume-once holds sequentially and fails under concurrent delivery**: k processes resuming one parked
  interrupt **fire the gated effect k times, saturation 1.0 in 36 of 40 cells, and the failure crosses
  hosts**."
- The named repair for the cross-process cell: "at the **read path**: an **opt-in gate claims consumption in
  the shared store, serving one racer and refusing the rest before any node executes**." Their reference
  implementation (REMIT) has a Verus-verified recovery core.

### arXiv 2609.29095 - "Where Does Exactly-Once Live?" (Jiapeng Li; 24 Sep 2026)

Abstract fetched verbatim from `arxiv.org/abs/2609.29095`. I re-fetched it rather than trusting the
second-hand numbers; every figure checks out.

- LIMBO sandbox: six services, **twelve fault modes** injected at the service boundary including late
  commits, redelivery and partial batches; **25,930 episodes**; nine models; three production harnesses; two
  contract variants; fifteen recovery conditions; "every episode is graded against a ledger of committed
  effects."
- Read-back possible, so the model decides: frontier models "almost never duplicate a write whose
  acknowledgement was lost (**0.5%**)", and "the model explains **53%** of the explained variance."
- Read-back impossible (in flight, or transport redelivered): "the same frontier models duplicate in **56%
  and 74%** of episodes, and **the contract explains 81%**."
- "We prove that **no verification-only policy is exactly-once under late commits without a bound on
  in-flight time**." Waiting works only when the in-flight bound is short and known; with heavy tails, "even
  an hour of waiting per episode falls short of offering an idempotency key on every write, which lowers the
  duplicate rate from **28% to 4%** because agents use keys when they exist."
- "**The harness barely matters**, a guard that attaches keys transfers across harnesses unchanged, and
  **agents reported success in 90% of the episodes in which they had duplicated an effect**."

### Supporting patterns outside agents

- **Transactional outbox** (`microservices.io/patterns/data/transactional-outbox.html`, Chris Richardson):
  the database update and the message commit in one local transaction; the relay "might publish a message
  **more than once**. It might, for example, crash after publishing a message but before recording the fact
  that it has done so ... As a result, a message consumer **must be idempotent**, perhaps by tracking the IDs
  of the messages that it has already processed." Same shape as the effect ledger: make the intent durable in
  the same commit as the effect, then de-duplicate on the read side.
- **Saga** (Temporal pattern page, plus the underlying Garcia-Molina/Salem pattern): forward-recover with
  compensating actions instead of rolling back. A saga is only as safe as its compensations are idempotent.
- **Microsoft Durable Functions** (`learn.microsoft.com/.../durable-functions-error-handling`): the retry
  APIs are recommended "for activities that read data from web services **or perform idempotent writes to a
  database**" - idempotency stated as the precondition for retrying. I did **not** find an explicit
  at-least-once statement on the pages I fetched (see gaps).

---

## What I read in code

### Local - this repository

**`src/core/effect-ledger.ts` (258 lines, read in full).** A contract plus one in-memory implementation,
whose header states the two decisions that are deliberately not the obvious implementation:

```ts
// **1. Consume-once is an atomic `claim`, not a read-then-write.** ... A `has()` check followed by a
// `record()` write cannot prevent that, because the window between them is exactly where the
// duplicate lands. ... an implementation is responsible for making it atomic.
// **2. The effect identity is the idempotency key the backend must honour.**
```

(`effect-ledger.ts:9-20`.) Mechanics:
- `EffectStore` (`:51-55`) has exactly four operations - `claim`, `get`, `complete` - and the docstring on
  `claim` (`:47-50`) reads: "Implementations must make `claim` atomic **across processes**, because the
  failure it prevents is a cross-host duplicate."
- `createInMemoryEffectStore` (`:65-83`) is a `Map` with a check-then-set, and the file says so: "**This is
  not sufficient for production.** Its `claim` is atomic only within one JavaScript realm; the duplicate it
  is meant to prevent crosses hosts." The shipped store therefore does not satisfy its own interface.
- `deriveEffectKey` (`:100-113`) is a `sha256` over `"dove-effect/v1"`, engagement, mode id/version/
  governanceVersion, tool, target, an `argumentsDigest`, and an optional `explicitKey`, joined with NUL.
- `toClientOrderId` (`:137-143`) strips anything outside `[A-Za-z0-9_.:-]` and truncates to 36 characters
  (Binance's `newClientOrderId` grammar is cited): "Truncation keeps the leading characters of a hash, which
  is where the entropy is."
- `dispatchOnce` (`:237-258`): claim; if not claimed and (`existing.outcome === "completed"` **or**
  `retryPriorAttempt !== true`) return `{executed: false, existing}`; else execute, then
  `ledger.complete(effectKey, {outcome: "completed"})`; on throw mark `"failed"` and rethrow. The default is
  **skip an ambiguous effect**, with the reasoning explicit at `:204-224`: "A claimed-but-incomplete effect
  is ambiguous: the previous attempt may be in flight right now, or it may have died mid-effect. A ledger
  cannot tell those apart - that is exactly the late-commit problem." Re-dispatch is opt-in
  (`retryPriorAttempt`) and "Only safe when the effect key is an idempotency key **the executing backend
  honours**".
- `EffectIsolationError` (`:145-150`, thrown at `:180-184`): a ledger refuses a record whose engagement
  differs from its own.

**`src/core/checkpoint.ts` (139 lines, read in full).** `ActionCheckpoint` = checkpointId,
previousCheckpointId?, mode, graphSignature, sequence, completedEffectKeys, createdAt (`:22-32`).
`captureCheckpoint` (`:89-109`) includes **only** effects with `outcome === "completed"`, sorted;
`restoreCheckpoint` (`:122-139`) returns a **refusal** (not a warning) with `reason` and `remediation`
when the mode identity or the `graphSignature` differs. `computeGraphSignature` (`:64-74`) hashes mode
id/version/governance, the sorted tool names, and the gate id. The header (`:12-19`) attributes the
graph-signature and lineage guards to "Microsoft's `WorkflowCheckpoint`" - **I could not verify that class
exists in that form** (see gaps).

**Wiring status (code-verified, not inferred).** A `grep` over `src` for
`effect-ledger|EffectLedger|dispatchOnce|createEffectLedger|deriveEffectKey|toClientOrderId` returns
**only** `checkpoint.ts:2` (a type-only import of `EffectRecord` and `ModeIdentity`) and
`adapters/loop-pi-agent-core.ts:4` (`import type { ModeIdentity }`). The same grep for
`captureCheckpoint|restoreCheckpoint|createInMemoryCheckpointStore` matches **only checkpoint.ts itself**.
Neither module is called from any entry point; they are types, an in-memory store, and tests.

**The dispatch seam.** In `src/core/loop-runner.ts` the gate decision is at `:120`
(`const decision = await decide(invocation)`), the record-whether-allowed-or-blocked call at `:122`
(`options.onGateInvoked?.(invocation, decision)`), and the effect itself at:

```ts
134: executedActions += 1;
135: const raw = await options.executeTool(call, signal);
136: const result = options.afterToolCall ? options.afterToolCall(call, raw) : raw;
```

Line 135 is the only place a tool runs. There is no ledger, no claim, no effect key and no completion record
on this path.

**Mode-declared effect classes** are designed but not implemented: the archived design
(`.trellis/tasks/archive/2026-09/09-25-dove-base-agent-framework/design.md:529-534`) says "A mode declares,
per effect, whether the effect is idempotent, key-idempotent, or non-idempotent. A **non-idempotent** effect
requires explicit confirmation on first execution and is never auto-retried."

### Frontier - LangGraph, read from source

Files fetched from `raw.githubusercontent.com/langchain-ai/langgraph/main/...` (ref `main`, 2026-09-26).

**`libs/langgraph/langgraph/pregel/_runner.py` - the commit happens after the effect.** `Runner.commit()`
(~line 575) is called from `tick()` immediately after the node function returns:

```python
self.commit(t, None)
except Exception as exc:
    self.commit(t, exc)
```

and `commit` itself ends with:

```python
else:
    if not task.writes:
        task.writes.append((NO_WRITES, None))
    # save task writes to checkpointer
    self.put_writes()(task.id, task.writes)
```

with the `GraphInterrupt` branch writing `(INTERRUPT, exception.args[0])` plus any `RESUME` writes, and the
error branch writing `(ERROR, exception)` / `(ERROR_SOURCE_NODE, task.name)`. **This is the late-commit
window in code: whatever the node did to the outside world has already happened by the time its result is
handed to the checkpointer, so a SIGKILL in between loses the record while keeping the effect.**

**`libs/langgraph/langgraph/pregel/_algo.py` - consume-once is an in-process list mutation.** Inside
`_scratchpad(...)` (~line 1281):

```python
def get_null_resume(consume: bool = False) -> Any:
    if null_resume_write is None:
        ...
    if consume:
        try:
            pending_writes.remove(null_resume_write)   # a process-local Python list
            return null_resume_write[2]
        except ValueError:
            return None
    return null_resume_write[2]
```

The comment above it ("None cannot be used as a resume value, because it would be difficult to distinguish
from missing when used over http") shows the designers thought about *shape*, not about *concurrency*. The
consumption mutates a per-process list that was loaded from the store - **which is precisely what the arXiv
k-resumer experiment saturates at 36/40 cells: k processes each load the same resume write and each remove
their own copy.** The paper's fix - claim consumption in the shared store before any node executes - is a
change to exactly this function.

**`libs/langgraph/langgraph/pregel/_loop.py` - the write pipeline and the durability gate.**
- `_put_pending_writes()` groups `self.checkpoint_pending_writes` by task id and submits each group to
  `checkpointer_put_writes` (with `task_path` when the saver accepts it).
- `_put_checkpoint()` (~line 1081) computes
  `do_checkpoint = self._checkpointer_put_after_previous is not None and (exiting or self.durability != "exit")`
  - so under `exit` durability **nothing is persisted mid-run**.
- The ordering guarantee is documented on the field: "`_checkpointer_put_after_previous` drains this list
  ... before putting the next checkpoint, so **a checkpoint never becomes durable before the writes that
  produced it**" (the `_delta_write_futs` comment, ~line 190). That is the harness-side half of the
  contract, and it orders *writes against checkpoints*, never *effects against writes*.
- `_suppress_interrupt()` (~line 1317) is where an interrupt's final checkpoint and writes are persisted.

**`libs/langgraph/langgraph/pregel/main.py:2602` - the default is the lossy one:**

```python
durability = config.get(CONF, {}).get(CONFIG_KEY_DURABILITY, "async")
```

**`libs/langgraph/langgraph/types.py` - the enum and the interrupt docstring:**

```python
Durability = Literal["sync", "async", "exit"]
"""Durability mode for the graph execution.
- 'sync': Changes are persisted synchronously before the next step starts.
- 'async': Changes are persisted asynchronously while the next step executes.
- 'exit': Changes are persisted only when the graph exits.
"""
```

and `interrupt()`: "In a given node, the first invocation of this function raises a `GraphInterrupt`
exception, halting execution ... **The graph resumes from the start of the node, re-executing all logic.**
If a node contains multiple `interrupt` calls, LangGraph matches resume values to interrupts based on their
**order** in the node." So the *task* re-runs from the top; only the *resume-value matching* is
positionally deterministic.

**`libs/checkpoint/langgraph/checkpoint/base/__init__.py` - the checkpointer interface.** `PendingWrite =
tuple[str, str, Any]`. `CheckpointMetadata` (total=False) carries `source: Literal["input","loop","update",
"fork"]`, `step` (-1 for the input checkpoint, 0 for the first loop checkpoint), `parents: dict[str,str]`
(namespace to checkpoint id), `run_id`, and a beta `counters_since_delta_snapshot`. `BaseCheckpointSaver`
requires `get_tuple(config)`; `list(config, *, filter, before, limit)`;
`put(config, checkpoint, metadata, new_versions) -> RunnableConfig`;
`put_writes(config, writes, task_id, task_path="") -> None`; `delete_thread`; `delete_for_runs`;
`copy_thread`; plus async variants. **Note what is absent: there is no operation that atomically claims a
task, and none that reads back "has this task already had its effect".** The store is a state-snapshot
store, not a claim/commit registry.

**`temporalio/skill-temporal-developer` (Temporal's own agent skill, first-party).**
`references/core/patterns.md`, "Idempotency Patterns": "**Why It Matters**: Temporal may re-execute
activities during retries (on failure) or replay (on worker restart). Without idempotency, this can cause
duplicate charges, duplicate emails, duplicate database entries." Good key sources: Workflow ID, business
identifier, "Workflow ID + activity name + attempt number". Then **Check-Before-Act**: "Query the external
system's state before making changes ... YES: Return early (already done)". (This is the pattern the Temporal
blog admits is racy; the skill does not repeat the race caveat, so the blog is the better source for it.)
`references/core/gotchas.md`: "**Non-Idempotent Activities** - Activities may execute more than once due to
retries or Worker failures ... **The Fix**: Always use idempotency keys when calling external services ...
**Local Activities skip the task queue for lower latency, but they're still subject to retries. The same
idempotency rules apply.**"

---

## The four must-answers

### 1. The minimum contract an effect must satisfy for the harness to guarantee at-most-once

Concrete and implementable, in dependency order:

1. **A stable, framework-derived effect identity, computed before dispatch and reproducible byte-for-byte
   across attempts *and across processes*.** Inputs: run/engagement id, mode id+version (+ governance
   version), tool name, normalised target, a digest of validated arguments, and an optional caller-supplied
   key. Anything nondeterministic (wall clock, a random id, a model-regenerated id) must stay out of the
   digest, or the retry computes a different key. Precedent: `deriveEffectKey`
   (`src/core/effect-ledger.ts:100-113`); Temporal's `workflowRunId + '-' + activityId`; the blog's
   `SubmitOrder(orderId)`.
2. **A single atomic claim operation**, exposed by a store shared across hosts, using compare-and-set or a
   unique constraint, returning one winner plus the prior record to everyone else. Not `has()`+`record()`,
   and not process-local: the measured failure is a cross-host duplicate (`effect-ledger.ts:9-20, 47-50`;
   arXiv 2608.03836's 36/40 saturation; the repair "claims consumption in the shared store, serving one racer
   and refusing the rest before any node executes").
3. **The key must be one the executor's backend enforces, and the harness must hand it to the executor.**
   One of: a unique constraint on the key (Temporal's `operations` table, inserted first inside the same
   transaction as the effect); a persisted key-to-response record (Stripe); a native idempotency parameter
   for the specific venue (`toClientOrderId`). A key the tool does not forward is bookkeeping, not a
   contract. Evidence that it is load-bearing: LIMBO's 28% to 4% when every write carries a key, and "the
   contract explains 81%" while "the harness barely matters".
4. **A terminal outcome record** with a vocabulary that distinguishes at least `completed`, `failed` and
   `unknown` (the local `EffectRecord.outcome` has the first two; the third is what makes the ambiguous
   case nameable), plus artifact references so completion is checkable.
5. **A declared effect class per effect**: idempotent, key-idempotent, or non-idempotent. Only the first two
   may ever be auto-retried from an ambiguous state. (Design: base-framework design `:529-531`; the code has
   `retryPriorAttempt` but nothing sets it.)
6. **A bound on in-flight time, or refusal.** LIMBO's proof: "no verification-only policy is exactly-once
   under late commits **without a bound on in-flight time**." So either the effect has a deadline after which
   it is *ambiguous* (not "still running"), or it can never be auto-resolved.

What the contract does **not** require: that the effect be atomic, that the harness be able to read back
whether it landed, or that the effect be reversible. Those are all nice to have; 1 through 3 are the minimum.

### 2. Where the contract must live, and which layer carries the guarantee

**The backend carries the guarantee; the harness carries the *identity* and the *claim*; the tool carries
the *forwarding*.** The evidence is unusually consistent:

- arXiv 2609.29095: "the contract explains **81%**", "**The harness barely matters**, a guard that attaches
  keys transfers across harnesses unchanged." A harness-side ledger can be perfectly correct and still
  produce duplicates, because the duplicate is born outside it (late commit, transport redelivery).
- Stripe: the *server* stores the response, the *server* returns `Idempotent-Replayed: true`, the *server*
  refuses a concurrent same-key request with `idempotency_key_in_use`. The client only chooses the key.
- Temporal is the clearest refusal to put the guarantee in the runtime: the runtime is explicitly
  at-least-once by default, at-most-once only via `maximumAttempts = 1` - "meaning **zero times is also
  possible**" - and the recommendation lands on the Activity author. The Workflow ID case shows what
  server-side enforcement looks like when it exists: "the Server will return a duplicate error instead of
  creating the second Workflow."
- LangGraph is the harness-side half read honestly: `sync` durability closes the *write-lag* window
  ("persist synchronously **before the next step starts**") and `_checkpointer_put_after_previous` guarantees
  a checkpoint never becomes durable before its writes - but **nothing closes the effect-to-write window**,
  because `_runner.commit()` runs after the node returns. And the docs concede that node code before
  `interrupt()` re-executes.

Concretely for this harness: the ledger's job is to make the *harness's own resumption* single-shot and to
hand out a key; it must not be described as providing exactly-once. A capability that cannot accept an effect
key is, by construction, at-least-once, and the harness should be able to say so per tool. The conformance
question at the tool boundary ("does this tool accept and forward an effect key?") is worth more than another
local dedup layer.

### 3. Correct behaviour when a resume cannot determine whether the effect landed

Frontier practice, in descending order of how often it appears:

1. **Refuse and surface; do not guess.** Stripe returns `idempotency_key_in_use` for a concurrent same-key
   request and does not execute. The resume-contract repair "refuses the rest before any node executes". The
   local `dispatchOnce` defaults to `retryPriorAttempt: false`, i.e. skip-and-report
   (`effect-ledger.ts:204-224`). The caigosec ledger (locally supplied archives, read by a sibling agent,
   **not by me** - see gaps) is reported to treat an intent event with no terminal event as an *unfinished
   intent* that is "**never auto-claimed as success**" and "surface[s] as RUNNING and [is] re-run or
   reconciled explicitly".
2. **Reconcile, keyed by the effect key - not by content.** `Idempotent-Replayed: true` is the read-back
   signal; Temporal's answer for a business key that must be serialised is an entity/"lock workflow" keyed by
   that business key; the transactional outbox makes the intent durable in the same commit as the effect so
   the read path has something to reconcile. Content-based read-back (Temporal's `UserExists()`) is the one
   the vendor itself calls racy.
3. **Park and escalate to a human** when neither works: "park the Workflow in a waiting state and block on a
   Signal that notifies the Workflow to proceed **or optionally delivers corrected input from a human
   operator**" (Temporal, Resumable Activity). This is the honest terminal behaviour, and the local design's
   "non-idempotent effect requires explicit confirmation" mirrors it.
4. **Re-dispatch only if the effect is key-idempotent.** The local `retryPriorAttempt` opt-in is exactly
   this, and only this.
5. **Never** blindly retry a non-keyed effect; and never accept the agent's own report - "agents reported
   success in **90%** of the episodes in which they had duplicated an effect."

The telling detail is that the good implementations keep three states, not two: *not started*, *done*,
*unknown*. A ledger with only done/not-done has to guess, and every default it can pick is wrong in one
direction.

### 4. A published case of a real system double-executing after a resume - named

Yes, four, all from arXiv 2608.03836 (deterministic, LLM-free harness at **pinned releases**; abstract
fetched verbatim):

1. **LangGraph 1.2.9** - "**re-executes durably recorded work after a real SIGKILL**: exactly-once across
   interrupts, at-least-once across crashes, on one API." This is the precise one: the same API is
   exactly-once for one failure class and at-least-once for the other. My code read explains the mechanism
   (`_runner.commit()` after the effect; `async` durability by default; the write lag is closed but the
   effect lag is not).
2. **CrewAI 1.15.2** - "**re-executes completed effect-bearing methods against its written claim**", i.e. it
   re-runs work its own persisted record says was already done.
3. **pydantic-graph 1.x** - "cannot resume after a mid-node crash" (the opposite failure: a lost run, not a
   duplicate).
4. **The same frameworks under concurrent resume** - "k processes resuming one parked interrupt fire the
   gated effect **k times**, saturation 1.0 in 36 of 40 cells, and the failure **crosses hosts**." The
   code-level cause is visible in LangGraph's `get_null_resume(consume=True)` removing the resume write from
   a **process-local list**.

And at the model/harness level rather than the framework level: LIMBO measured **56%** and **74%** duplicate
rates for frontier models when a read-back cannot reveal the outcome.

What I could **not** find is a *production incident write-up* (a company reporting "we double-charged after a
resume, here is our post-mortem"). Web search was unavailable in this sandbox; see gaps. The four cases above
are measurement at pinned release, not narrative post-mortems - stronger on reproducibility, weaker on "this
hurt a real customer".

---

## What is transferable to a harness

- **Put the dispatch decorator at `loop-runner.ts:135`, not around the model turn.** The checkpoint unit is
  "an effect was admitted and completed"; a model turn is a transcript boundary. `captureCheckpoint` already
  encodes this by filtering `outcome === "completed"` (`checkpoint.ts:89-94`).
- **Derive the key before dispatch and hand it to the tool.** `toClientOrderId` exists for this. Add the
  missing half: a per-tool declaration of whether it *forwards* the key. Without that, "the seam exists" and
  "the guarantee exists" are different statements.
- **Give each effect a class, and make the class the only thing that can set `retryPriorAttempt`.** The
  design says a mode declares idempotent / key-idempotent / non-idempotent; the code has the flag but nothing
  sets it. A call site setting it is exactly the bug the design warns about.
- **Supply a real `EffectStore`.** The in-memory store's own docstring says it is not sufficient; a DB row
  with a unique constraint, a lock service, or an append-only log with a unique constraint is the contract.
  This is the highest-leverage gap, because every other guarantee is downstream of an atomic cross-process
  `claim`.
- **Three-state outcome, with "unknown" first-class.** Add `outcome: "unknown"` (or an explicit
  unfinished-intent projection) so a resume never infers "still running" from "no completion". Both frontier
  answers that work - Stripe's `idempotency_key_in_use`, and the parked workflow awaiting a human - require
  being able to say "in flight / unknown" as distinct from "failed".
- **Build a reconciler, not just a retrier.** A pass over ambiguous effects that resolves each against the
  backend *by key*, and escalates to a human when the backend cannot be asked. Neither LangGraph nor Temporal
  ships this; Temporal's pattern page shows the shape (park plus signal), and the outbox pattern shows how to
  make the read side resolvable at all.
- **Bound in-flight time.** A per-effect deadline that converts "running" into "ambiguous" is the only thing
  that makes the reconciler fire, and LIMBO's proof is that without it no amount of verification gets you
  exactly-once.
- **Refuse to resume across a shape change.** `restoreCheckpoint`'s refusals on mode identity and
  `graphSignature` (`checkpoint.ts:122-139`) implement the resume contract's "checkpoint validity", and the
  measured failure they prevent ("re-executes durably recorded work") is what LangGraph 1.2.9 did. Keep the
  refusal, not a warning.
- **Trust the ledger over the agent.** Write `outcome: completed` from the dispatcher's view of the tool
  result, never from the model's claim, because the model's claim is wrong in 90% of the duplicated episodes
  the only large measurement of this looked at.
- **Say "at-most-once" only where it is true.** The honest vocabulary: the harness can guarantee *at-most-once
  dispatch along its own resumption paths* (given an atomic shared claim); exactly-once requires the backend
  to enforce the key; an ambiguous effect against a non-keyed backend can only be *escalated*. That framing
  matches every source here, and it is what makes the tool-contract conformance check the load-bearing piece
  rather than the ledger.

---

## Could not verify

- **A production post-mortem naming a company that double-executed after a resume.** `web_search` failed on
  every engine ("Every engine for the web source failed ... firecrawl returned 429"); no direct fetch
  surfaced one. The named cases I found are measurements at pinned releases plus the frameworks' own docs.
- **Microsoft's `WorkflowCheckpoint`**, cited by `src/core/checkpoint.ts:12-13`. I fetched
  `ungh.cc/repos/microsoft/agent-framework/files/main` (truncated at 100 KB of JSON); the only
  checkpoint-named paths it surfaced were under
  `dotnet/samples/02-agents/Agents/Agent_Step19_InFunctionLoopCheckpointing/`. I read **no**
  `WorkflowCheckpoint` class. The claim that Microsoft's checkpoint carries a graph signature and explicit
  lineage is therefore **unverified**, and the local file's appeal to that precedent should be read as design
  rationale, not citation.
- **The caigosec `orchestrator/ledger.py` semantics** ("unfinished intents are never auto-claimed as
  success; they surface as RUNNING and are re-run or reconciled explicitly"). I read a sibling agent's
  analysis of it (`.trellis/tasks/09-26-dove-code-audit-vertical/research/reference-caigosec-analysis.md:310-346`)
  but the archives are **not in this workspace**: `glob **/orchestrator/ledger.py` and `glob **/caigosec*`
  both return nothing. Treat that item as second-hand.
- **The SQS at-least-once page content.** JS-rendered; ~1,386 characters of text and no body. Only the
  `meta name="description"` ("... ensuring message delivery at least once") is evidence, and it is weak. Not
  used above.
- **Stripe's own engineering blog on idempotency** (`stripe.com/blog/idempotency`). JS-rendered, no
  content retrievable. The Stripe claims above come from the API reference and error pages, which I did read.
- **Whether `argumentsDigest` is stable across a resume.** `deriveEffectKey` takes an `argumentsDigest`
  string, but there is no digester in `src/core` and no call site - so nothing guarantees that a resume in
  which the model regenerates the same logical call produces the same key. If the re-emitted arguments differ
  at all (key order may be canonicalised somewhere I did not find; content is not), the claim does not match
  and the effect is dispatched again. **An unverified risk, not a finding.**
- **No test was run.** I did not execute `tests/effect-ledger.test.ts` or a type-check. Any statement that
  those modules are "tested" comes from
  `.trellis/tasks/archive/2026-09/09-25-dove-base-agent-framework/implement.md:252`, not from a run I
  performed.
- **The code I read is not the code that was measured.** The arXiv papers measure **LangGraph 1.2.9**; I
  fetched `main` on 2026-09-26, with no SHA (I avoided the rate-limited GitHub API; `ungh.cc` reports
  `pushedAt`, not a commit hash). Line numbers above are as of `main` on that date and will drift. The
  mechanisms I name (`commit` after the effect, process-local resume consume, `async` default) are
  structural and I expect them to survive a revision, but I cannot claim I read 1.2.9.
- **Only the abstracts of the two arXiv papers were read**, not the PDFs or their harnesses. Every number
  attributed to them above is verbatim from the abstract.
- **Temporal's engine code was not read.** The Temporal claims rest on docs plus Temporal's own first-party
  agent skill, not on `temporalio/temporal` source. I fetched that repo's metadata only.

## Caveats / Not Found

- **The most decision-relevant correction to the framing I was given.** "Exactly-once across interrupts" in
  arXiv 2608.03836 is a property of the **durably recorded task**, not of the **effect**. LangGraph's own
  source (`types.py`, `interrupt()`: "The graph resumes from the start of the node, **re-executing** all
  logic") and its own docs ("**Side effects called before `interrupt` must be idempotent** ... it will be
  re-run multiple times when the node is resumed ... creating duplicate records") both say the node's logic
  runs again. A harness that reads "exactly-once across interrupts" as "effects at an approval gate are safe"
  will duplicate an effect at **every** gate - and its own reference docs will have warned it. The
  interrupt-boundary guarantee is about *consume-once of a resume value*, which the same paper shows fails
  under concurrent delivery anyway.
- **Vendor docs are named as such.** The Temporal and Stripe claims are from vendor documentation and a
  vendor blog. Where I could check the code behind a claim (LangGraph) the code and docs agree on the
  mechanism while the docs' own warning contradicts the "exactly-once" framing.
- **Ranking.** The two arXiv items (deterministic harnesses, pinned releases, 25,930 episodes and a 39-cell
  fault matrix) outrank everything else here. LangGraph source outranks LangGraph docs, which is why the
  interrupt contradiction is stated as a code finding rather than a documentation dispute. Stripe's published
  HTTP semantics are authoritative for Stripe, not a general claim about clients.
- **Not found at all**: any mechanism in the frontier that makes a *non-idempotent, non-keyed* effect
  exactly-once. Every system surveyed resolves it either by requiring a key it can enforce (Temporal, Stripe,
  the local ledger) or by parking and asking a human (Temporal's Resumable Activity). Nothing claims a third
  option exists.
- **Tooling gaps, restated for the parent**: `web_search` was down for the whole session;
  `api.github.com` was deliberately untouched (the ~60/hour budget); `docs.aws.amazon.com` and
  `stripe.com/blog` are JS-rendered; `raw.githubusercontent.com` and the `.md` doc twins worked
  flawlessly and are what I would use again.
- **A note on the local ledger's citation hygiene.** `effect-ledger.ts` and `checkpoint.ts` cite
  arXiv 2608.03836 and 2609.29095 for their key claims. I resolved both IDs and the quoted lines are in the
  abstracts verbatim - including "the harness barely matters", "the contract explains 81%", "no
  verification-only policy is exactly-once under late commits", "saturation 1.0 in 36 of 40 cells", and
  "agents reported success in 90% of the episodes in which they had duplicated an effect". The in-code
  citations are accurate; the *inference* drawn from one of them (that "exactly-once across interrupts" helps
  at an approval gate) is the part the primary sources contradict.
