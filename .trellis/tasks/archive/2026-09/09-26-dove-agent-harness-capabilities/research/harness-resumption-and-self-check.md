# Research: Durability and Self-Improvement (resumption after restart, error recording, self-check iteration)

- **Query**: How do shipping agent frameworks and published measurements handle (A) surviving a restart
  without losing work or repeating a side effect, (B) recording failures so they can be learned from, and
  (C) agents that evaluate their own output?
- **Scope**: Claude Code, OpenAI Codex, aider, LangGraph, Temporal, OpenHands (Part A); OpenTelemetry
  GenAI semconv, MAST failure taxonomy, Google SRE postmortem practice (Part B); Reflexion, Self-Refine,
  self-correction, LLM-as-judge self-preference, CriticGPT (Part C). Plus the existing
  `src/core` contracts in this repository.
- **Date of research**: 2026-09-26. All web pages fetched on this date.
- **Labels used below**: **[SOURCE]** what the cited source states; **[CODE]** what I observed in code;
  **[INFERENCE]** my reasoning over the two; **[OPINION]** my judgement.

> **Environment limitation, stated up front.** `github.com`, `raw.githubusercontent.com`, `sre.google`,
> `developers.openai.com` and the `r.jina.ai` reader proxy were **unreachable** from this sandbox
> (`fetch failed`), and the GitHub API was rate-limited after one call. So I could **not** read framework
> *source files* on GitHub, nor the Codex docs, nor the SRE book. Where a claim rests only on a search
> snippet or a badge service, it is marked as such. Repository metadata below comes from the
> shields.io badge service, which returns rounded/relative values, not SHAs.

---

## What the sources state

### Part A — Session resumption

**Claude Code** — `code.claude.com/docs/en/sessions` (Anthropic; fetched 2026-09-26).
- Sessions are saved continuously as JSONL transcripts at
  `~/.claude/projects/<project>/<session-id>.jsonl`; each line is a message, tool use, or metadata entry.
  The entry format is explicitly internal and "changes between versions". Resume entry points:
  `claude --continue`, `claude --resume`, `claude --resume <name>`, `claude --resume <transcript-path>`." (https://code.claude.com/docs/en/sessions)
- **The resumption-of-effects answer is explicit** (section "What a resumed session restores"):
  > "A tool that was still running when the previous process ended, for example in a crash, doesn't
  > finish or run again when you resume. Claude sees the call marked as cut off before its result was
  > recorded and is told to check whether it took effect before running it again, unless
  > `CLAUDE_CODE_RESUME_INTERRUPTED_TURN` is set."
  (https://code.claude.com/docs/en/sessions) — i.e. Claude Code does **not** re-run the interrupted call;
  it records that the call was cut off and pushes the "did it take effect?" question back to the model.

**LangGraph** — `docs.langchain.com/oss/python/langgraph/checkpointers` and `.../persistence`
(LangChain; fetched 2026-09-26).
- Two persistence systems: **checkpointers** (thread-scoped graph-state snapshots, keyed by
  `thread_id`) and **stores** (cross-thread key-value). (https://docs.langchain.com/oss/python/langgraph/persistence)
- Checkpoints are written at **super-step** boundaries, but the durable unit for recovery is finer:
  "As each node within a super-step finishes, its outputs are written to the checkpointer's
  `checkpoint_writes` table as task entries linked to the in-progress checkpoint." The docs name this
  **pending writes**: "When a graph node fails mid-execution at a given super-step, LangGraph stores
  pending checkpoint writes from any other nodes that completed successfully at that super-step. When
  you resume graph execution from that super-step you don't re-run the successful nodes."
  (https://docs.langchain.com/oss/python/langgraph/checkpointers)
  So LangGraph's stated distinction is *per-task write committed vs. not*, not per-model-turn.
- Fault-tolerance is handled separately by per-node `retry_policy` and error handlers
  (`langgraph>=1.2`), with graceful shutdown "at a superstep boundary".
  (https://docs.langchain.com/oss/python/langgraph/fault-tolerance)

**Temporal** — `temporal.io/blog/idempotency-and-durable-execution` (Temporal, undated blog; fetched
2026-09-26).
- Workflows are event-sourced; Activity execution is **not atomic**, so Temporal guarantees
  "**at least once**" by default (unlimited retries), and "**at most once**" only by setting
  `maximumAttempts = 1` — and notes "at most once" means a side effect can happen **zero** times.
- The recommended fix is not in the runtime but in the contract: "Temporal recommends Activities be
  **idempotent**". Concretely: use a natural key, else `workflowRunId + '-' + activityId`, or an
  `operations` table with a `UNIQUE` constraint on an idempotency key.
- (Also relevant: docs.temporal.io/workflow-execution describes "Replay" as how a Workflow resumes.)

**OpenHands** — `docs.openhands.dev/sdk/guides/convo-persistence` (OpenHands SDK docs; fetched
2026-09-26).
- State is saved to a per-conversation directory: `base_state.json` (agent config, execution status,
  statistics, secrets, custom agent_state) plus an append-only `events/event-<n>-<id>.json` series
  (messages, tool calls, observations). Auto-save overwrites base state on every public-field change and
  appends one file per event. (https://docs.openhands.dev/sdk/guides/convo-persistence)
- **Gap I did not find**: the persistence guide documents *what* is restored but contains no
  idempotency key, no claim/commit split, and no statement about a tool that was mid-execution when the
  process died. Resumption is event-log replay, not effect de-duplication. This is absence of evidence
  in the fetched doc, not evidence of absence in the code.

**aider** — `aider.chat/docs/faq.html` and `aider.chat/docs/config/options.html` (fetched 2026-09-26).
- Chat is stored as markdown in `.aider.chat.history.md` ("Copy the markdown logs you want to share from
  `.aider.chat.history.md`"). (https://aider.chat/docs/faq.html)
- The options reference lists the history files `--input-history-file`, `--chat-history-file`,
  `--restore-chat-history`, `--llm-history-file`. (https://aider.chat/docs/config/options.html)
- aider's resumption is **transcript replay**. There is no effect ledger. If aider edits a file and dies,
  the git diff (aider auto-commits) is the only dedup mechanism — the transcript does not distinguish
  "applied" from "attempted".

**OpenAI Codex** — `github.com/openai/codex/issues/20165` (title retrieved via the GitHub API; body not
retrievable — API rate-limited; page itself unreachable).
- Issue title: "codex resume --all does not list existing local sessions, while resume <session-id> can
  open them." The issue body (seen only in a search snippet) names the store:
  `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`. **(search-snippet rank; I could not open the page.)**
- Codex CLI resume commands (`codex resume --last`) were reported by a third-party knowledge-base page
  (inventivehq.com) which returned HTTP 403 when fetched — **not used as a source**. The official Codex
  docs host (`developers.openai.com`) returned 403 from this sandbox. **Codex's effect semantics remain
  unverified.**

**Two measurements that directly attack the resumption question** (both fetched from arXiv):
- **arXiv:2608.03836**, Sajjad Khan, "Resume Means Resume: A Machine-Checked Conformance Contract for
  Checkpoint, Interrupt, and Resume Semantics in Workflow Persistence Layers", submitted 4 Aug 2026
  (v3 8 Aug 2026). [SOURCE] A deterministic, LLM-free harness at pinned releases found: "LangGraph 1.2.9
  durably records a second resume value and never consults it, persists schema-invalid state silently,
  and **re-executes durably recorded work after a real SIGKILL: exactly-once across interrupts,
  at-least-once across crashes, on one API.** CrewAI 1.15.2 re-executes completed effect-bearing methods
  against its written claim; pydantic-graph 1.x cannot resume after a mid-node crash". And the
  concurrency finding: "**Consume-once holds sequentially and fails under concurrent delivery: k
  processes resuming one parked interrupt fire the gated effect k times, saturation 1.0 in 36 of 40
  cells, and the failure crosses hosts.**" The paper defines a RESUME CONTRACT of six properties
  (prefix continuation, effect exactly-once, fork determinism, checkpoint validity, consume-once,
  recovery determinism); the cross-host cell is repaired only "at the read path: an opt-in gate claims
  consumption in the shared store, serving one racer and refusing the rest before any node executes."
  (https://arxiv.org/abs/2608.03836). *Note the tension with LangGraph's own docs above: docs describe
  pending writes preventing re-run; the measured harness found re-execution after SIGKILL. The window is
  between the side effect and its durable write.* **[INFERENCE]**
- **arXiv:2609.29095**, Jiapeng Li, "Where Does Exactly-Once Live? Model, Harness, and Tool-Contract
  Effects on Duplicate Side Effects in LLM Agents", submitted 24 Sep 2026. [SOURCE] LIMBO sandbox, six
  services, 12 fault modes, 25,930 episodes, nine models, three harnesses, two contract variants, 15
  recovery conditions. Findings: when an immediate read-back can reveal what happened, frontier models
  duplicate a lost-acknowledgement write only 0.5% of the time and "the model explains 53% of the
  explained variance"; when it cannot (request in flight, or transport redelivered), "the same frontier
  models duplicate in **56% and 74%** of episodes, and **the contract explains 81%**". "We prove that no
  verification-only policy is exactly-once under late commits without a bound on in-flight time." And:
  requiring an idempotency key on every write "lowers the duplicate rate from **28% to 4%**". Two more
  lines matter for Part C: "**The harness barely matters**, a guard that attaches keys transfers across
  harnesses unchanged", and "**agents reported success in 90% of the episodes in which they had
  duplicated an effect**." (https://arxiv.org/abs/2609.29095)

### Part B — Error recording

**OpenTelemetry** (fetched 2026-09-26):
- **Recording errors** (`.../general/recording-errors/index.md`, status Development): on failure set span
  status `Error` and the `error.type` attribute; "Errors that were retried or handled ... SHOULD NOT be
  recorded." Metrics SHOULD carry the same `error.type` so error rates are derivable.
  (https://opentelemetry.io/docs/specs/semconv/general/recording-errors/)
- **Exceptions in logs** (`.../exceptions/exceptions-logs/index.md`, status Stable): exceptions are
  recorded as attributes on a LogRecord — `exception.type` (fully-qualified class name),
  `exception.message`, `exception.stacktrace`. Conditionally required: at least one of type/message.
  "It's NOT RECOMMENDED to record the same exception more than once." The record MUST be associated with
  the corresponding span context.
  (https://opentelemetry.io/docs/specs/semconv/exceptions/exceptions-logs/)
- **GenAI semconv has moved**: `.../gen-ai/gen-ai-agent-spans/` now says the GenAI conventions "have moved
  to the OpenTelemetry GenAI semantic conventions repository" and the page is no longer maintained.
  The registry page still lists the (now Deprecated/Moved) keys `gen_ai.agent.id`, `gen_ai.agent.name`,
  `gen_ai.agent.description`, `gen_ai.agent.version`, `gen_ai.conversation.id`,
  `gen_ai.operation.name`, etc. (https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)
  I could **not** read the new repo (github.com unreachable).

**MAST — "Why Do Multi-Agent LLM Systems Fail?"**, Mert Cemri et al. (UC Berkeley), arXiv:2503.13657,
v1 17 Mar 2025, v3 26 Oct 2025. [SOURCE] MAST-Data (1600+ annotated traces, 7 MAS frameworks); the
taxonomy MAST was built from 150 traces with expert annotators, **inter-annotator agreement κ = 0.88**,
yielding **14 failure modes in 3 categories** (system design, inter-agent misalignment, task
verification); plus an LLM-as-judge annotation pipeline validated against humans.
(https://arxiv.org/abs/2503.13657)

**Google SRE — blameless postmortem**: `sre.google/sre-book/postmortem-culture/` was **unreachable**
from this sandbox. Search snippet only: "For a postmortem to be truly blameless, it must focus on
identifying the contributing causes of the incident without indicting any individual or team for bad or
..." (https://sre.google/sre-book/postmortem-culture/) — **search-snippet rank, not fetched.**

### Part C — Self-check iteration

- **Reflexion**, Noah Shinn et al. (Northeastern/MIT/Princeton), arXiv:2303.11366. [SOURCE, primary
  abstract] "Reflexion achieves a **91% pass@1 accuracy on the HumanEval coding benchmark, surpassing the
  previous state-of-the-art GPT-4 that achieves 80%**." It "verbally reflect[s] on task feedback signals"
  and keeps reflective text in episodic memory across trials. (https://arxiv.org/abs/2303.11366)
  - **What it actually measured (ablation).** The primary HTML body was truncated by the fetch limit and
    could not be re-fetched, so the ablation numbers below are from **alphaXiv's** analysis page, which
    cites the paper by page: [SECONDARY SOURCE — alphaXiv, AI-generated analysis, not the authors]
    On the 50 hardest HumanEval problems translated to **Rust** (compiled, so the compiler/tests give
    rich signal), each row removes one component: base model **0.60**; tests-only **0.60**; tests without
    verbal reflection **0.60**; **reflection without tests 0.52 (below baseline)**; full (tests +
    reflection) **0.68**. On HumanEval Python: **91.0% vs 80.1% for GPT-4 without reflection**. ALFWorld:
    **130 of 134** environments solved with a loop-detection heuristic; the no-reflection agent "plateaued
    early" at ~22% hallucination rate. HotPotQA: self-reflection gave an **absolute +8%** over the
    episodic-memory-only condition. (https://www.alphaxiv.org/abs/2303.11366)
    *I flag this as secondary; the direction of the ablation (reflection helps only when grounded in test
    execution; ungrounded reflection is worse than baseline) is the load-bearing claim and I could not
    re-verify the exact decimals against the primary text.*
- **Huang et al., "Large Language Models Cannot Self-Correct Reasoning Yet"**, Google DeepMind,
  arXiv:2310.01798, ICLR 2024. [SOURCE] "our research indicates that LLMs struggle to self-correct their
  responses **without external feedback**, and at times, their **performance even degrades** after
  self-correction." "Intrinsic self-correction" = "based solely on its inherent capabilities, without the
  crutch of external feedback". (https://arxiv.org/abs/2310.01798)
- **Self-Refine**, Madaan et al., arXiv:2303.17651, NeurIPS 2023. [SOURCE] A single LLM is "the generator,
  refiner, and feedback provider"; across 7 tasks "outputs generated with Self-Refine are preferred by
  humans and automatic metrics ... improving by **~20% absolute on average**".
  (https://arxiv.org/abs/2303.17651)
- **Self-Preference Bias in LLM-as-a-Judge**, Wataoka, Takahashi, Ri (Rakuten), arXiv:2410.21819,
  NeurIPS 2024 Safe GenAI Workshop. [SOURCE] "GPT-4 exhibits a significant degree of self-preference
  bias"; the bias tracks **perplexity** — "LLMs assign significantly higher evaluations to outputs with
  lower perplexity than human evaluators, regardless of whether the outputs were self-generated."
  (https://arxiv.org/abs/2410.21819)
- **LLM Evaluators Recognize and Favor Their Own Generations**, Panickssery, Bowman, Feng (NYU/Anthropic),
  arXiv:2404.13076. [SOURCE] "GPT-4 and Llama 2 have non-trivial accuracy at distinguishing themselves
  from other LLMs"; fine-tuning shows "a **linear correlation between self-recognition capability and
  the strength of self-preference bias**", resisting straightforward confounders.
  (https://arxiv.org/abs/2404.13076)
- **CriticGPT / "LLM Critics Help Catch LLM Bugs"**, McAleese et al. (OpenAI), arXiv:2407.00215.
  [SOURCE] A separately RLHF-trained critic: "model-written critiques are preferred over human critiques
  in **63%** of cases, and human evaluation finds that models catch more bugs than human contractors paid
  for code review." Caveat stated by the authors: critics "have limitations of their own, including
  **hallucinated bugs**"; "human-machine teams of critics and contractors catch similar numbers of bugs to
  LLM critics while hallucinating less". (https://arxiv.org/abs/2407.00215)

---

## What I read in code

### This repository: `src/core` (the unwired contracts)

Read in full: `src/core/effect-ledger.ts`, `src/core/checkpoint.ts`, `src/core/evidence-sarif.ts`;
targeted reads: `src/core/execution-ledger.ts`, `src/core/contracts.ts`, `src/core/request-lifecycle.ts`,
`src/core/evidence.ts`, `src/project-provider/continuation.ts`.

- **`effect-ledger.ts`** encodes exactly the answer Part A needs, and it is unusually explicit about why:
  - The unit is an **effect**, not a turn: the file header says "A `has()` check followed by a `record()`
    write cannot prevent [duplicates], because the window between them is exactly where the duplicate
    lands. The store therefore exposes one operation — `EffectStore.claim` — and an implementation is
    responsible for making it atomic." (`src/core/effect-ledger.ts:8-14`)
  - `deriveEffectKey` (line ~100) builds a sha256 over `engagement | mode.id | mode.version |
    mode.governanceVersion | tool | target | argumentsDigest | explicitKey`, with `argumentsDigest`
    rather than raw args "so the key never carries payload", and `explicitKey` "when a logical effect must
    survive a retry that would otherwise look identical - a client order id is the canonical example, and
    it is also what lets the *venue* reject a duplicate rather than only the framework."
  - `dispatchOnce` (line ~237) is the policy: on a claim that loses, it returns `executed:false` **unless**
    `retryPriorAttempt` is explicitly true; the comment justifies the default as "never duplicate" over
    "never lose work" because a claimed-but-incomplete effect is **ambiguous** and the two failure
    directions are asymmetric.
  - `toClientOrderId` maps the framework effect key onto a venue's field (truncated to 36 chars for
    Binance's `newClientOrderId`), making "the effect key is an idempotency key the backend honours"
    concrete.
- **`checkpoint.ts`** stores the resumption state as: `checkpointId`, `previousCheckpointId` (explicit
  lineage), `mode` (id/version/governanceVersion), `graphSignature` (sha256 of mode + sorted tool names
  + gate id), `sequence`, and **`completedEffectKeys`** — "Effects already admitted and completed. The
  unit that must not be replayed." `captureCheckpoint` filters `outcome === "completed"` only; "Blocked and
  failed effects are not part of it". `restoreCheckpoint` **refuses** (not warns) if the mode or
  `graphSignature` differs: "Resuming a checkpoint whose graph has changed means running a different
  program from where another one stopped." (`src/core/checkpoint.ts`, whole file)
- **`evidence-sarif.ts`** is the error-*identity* contract, and its central rule answers Part B:
  "**The fingerprint must exclude model prose.** A fingerprint derived from the message varies between
  runs - a model restates the same defect two ways - which makes baselineState meaningless and turns
  every re-run into a wall of spurious new findings." It emits a path-free `contentHashOf` plus a
  fingerprinted occurrence index, and both keys are **versioned**. (`src/core/evidence-sarif.ts:1-45`)
- **`execution-ledger.ts`** is an append-only JSONL ledger of typed records; `contracts.ts` enumerates the
  ~30 `kind` values (e.g. `request.attempt.started/completed`, `project.mutation.failed`,
  `capability.recovered`, `task.convergence.decision`) and a `correlation` block
  (`requestId/sessionId/taskId/attemptId/providerCallId/toolCallId`). (`src/core/contracts.ts:75-85`)
- **`request-lifecycle.ts`** contains a small failure taxonomy in code:
  `ProviderFailureClassification = { kind: "transient" | "terminal", reason }`, with
  `classifyProviderFailure` mapping 401/403 → terminal `authorization-denied`, 5xx-ish → transient
  `http_<status>`, etc. (`src/core/request-lifecycle.ts:69-70, 347-358`)
- **The wiring, checked**: `from "./checkpoint"` occurs in **0** files; `createEffectLedger` appears only in
  its own definition; `captureCheckpoint` only in its own file; `dispatchOnce` only in
  `effect-ledger.ts` and a doc-comment in `checkpoint.ts`. **[CODE]** The exactly-once and checkpoint
  machinery is defined and **never called outside itself** — consistent with the task PRD's claim that
  `src/core` is referenced only by its own tests.
- **The live resumption path is different**: `src/project-provider/continuation.ts` reads task artifacts
  (status, `convergence.state`, `nextAction`) and returns a `ProjectContinuation`
  (`current | selected | single_candidate | ambiguous | none`). It "deliberately treats task IDs and
  statuses as opaque provider data and never probes a provider's private runtime/session directories."
  **[CODE]** This is **plan-level** resumption (which task, what next step). It sits beside, and is
  disjoint from, the **effect-level** dedup in `effect-ledger.ts`. The harness today can reliably answer
  "what was I doing?" and cannot answer "did that side effect already happen?".

### Frameworks (documentation only — source unreachable)

I read no framework source files: `raw.githubusercontent.com` and `github.com` returned `fetch failed`
for every path attempted (LangGraph `libs/checkpoint/...`, repo READMEs, blob pages). Everything in
Part A about framework internals is therefore **documentation- or measurement-backed, not source-backed**.

---

## What is transferable to a harness

**[INFERENCE unless marked.]**

### Direct answers to the three must-answer questions

**1. What is the smallest resumption state that prevents both lost work and repeated effects?**
The minimum is **three things, one of which is a shared atomic operation, not a value**:
1. An **append-only effect log** keyed by a **stable effect key** derived deterministically from the
   logical action (engagement/mode/tool/target/args-digest + optional caller-supplied explicit key), with
   the key also handed to the executing backend as an idempotency key.
2. A **claim/commit split** on that log: `claimed` (in-flight, ambiguous) vs `completed`. A
   claimed-but-uncommitted effect must default to **not retried** — this is the "started but not
   finished" state, and it is the one whose mishandling produces duplicates. This is exactly what
   `dispatchOnce` and `EffectStore.claim` encode, and what Temporal/Papers 2608/2609 independently
   point at. It cannot be a plain record: it must be an atomic compare-and-set in a store visible to
   *all* resumers (Paper 2608.03836: concurrency saturation 1.0 in 36/40 cells when it is merely
   sequential).
3. A **program-identity guard** — mode version + a hash of the orchestration shape (tools + gate) —
   checked *before* resuming, and a refusal if it changed. This is `graphSignature` +
   `restoreCheckpoint` in `checkpoint.ts`, and it prevents a resumed run from silently being a
   different program.

Notably, "the transcript" is **not** in the minimum. Every transcript-based system (Claude Code, aider,
Codex, OpenHands) either adds a special case for the interrupted call (Claude Code: mark it cut off and
ask the model to verify) or leaves the duplicate to the user.

**2. What do projects that catch their own errors have in common structurally?**
Not a second agent, and not a schema, as the *primary* mechanism. The common structural feature is an
**execution oracle independent of the generator** — a compiler, a unit-test runner, a simulator, or a
differently-trained verifier:
- Reflexion's own ablation (secondary source) is the cleanest evidence: remove the tests and keep the
  reflection, and accuracy falls **below** the no-reflection baseline (0.52 vs 0.60).
- Huang et al. say the same from the negative direction: without external feedback, self-correction does
  not help and sometimes hurts.
- CriticGPT works because it is a *separately trained* critic, and even then it hallucinates bugs that
  humans alone do not; the recommended configuration is human + model, not model alone.
- MAST pairs the taxonomy with human-validated labels (κ = 0.88) rather than trusting the judge alone.
A **schema/taxonomy** is the second, load-bearing piece (MAST's 14 modes; OTel's `error.type` +
`exception.*`; `evidence-sarif.ts`'s prose-free fingerprint) — it is what makes two failures comparable
across runs. A **trace at step granularity** is the third (OTel spans; the `execution-ledger`'s typed
records with correlation IDs). "A second agent" appears only where it is also a second *training* or a
second *information channel*; a second call to the same model on the same context is the case the
evidence says is weakest.

**3. Is there measured evidence that self-critique improves outcomes?**
Yes, with numbers — **and it is conditional on an oracle**:
- Reflexion: HumanEval **91% vs 80%** (primary source). Ablation on Rust: full **0.68** vs base **0.60**;
  **reflection-without-tests 0.52** (secondary source).
- Self-Refine: **~20% absolute** average over 7 tasks, single model as generator/refiner/critic — but the
  headline metric is *preference*, not a hard oracle.
- Counter-evidence: Huang et al. (ICLR 2024) — no external feedback → no reliable self-correction,
  sometimes degradation.
- Judge bias: GPT-4 shows significant self-preference (Wataoka et al.); the bias scales linearly with
  self-recognition ability (Panickssery et al.).
- Duplicate-side-effect self-report: agents "reported success in **90%** of the episodes in which they
  had duplicated an effect" (Paper 2609.29095) — a direct measurement that an agent's own success report
  is not a reliable check.

So: **self-critique is measurably useful when the critique is grounded in an oracle the generator did not
author; ungrounded self-critique is not reliably positive and can be negative.**

### The failure to hunt for: "a self-check that cannot fail"

**[OPINION + CODE]** The structural test is not "does the loop contain a critic?" but **"is there any
outcome the critic is unable to produce that would change the result?"** Three concrete markers, all
visible in this repo:
- **A check nothing calls.** `captureCheckpoint`, `createEffectLedger`, `dispatchOnce` are correct,
  documented, and called by nothing but their own file. A helper that exists but is never called is not
  enforcement — the same defect the PRD says the project spent eight review rounds finding in a vertical.
- **A check whose inputs come from the thing it checks.** A fingerprint over a model-written message
  "turns every re-run into a wall of spurious new findings" (`evidence-sarif.ts`); the identity must be
  over stable inputs, versioned, so a genuine change is distinguishable from noise.
- **A check with no independent oracle.** If the generator and the approver share weights, context, and
  information channel, the measured biases above apply directly. The cheapest structural fix visible
  across the sources is to give the check *a different input* (test results, compiled output, a diff),
  not a different prompt.

---

## Could not verify

- **Framework source code.** `github.com` / `raw.githubusercontent.com` were unreachable, so I could not
  read LangGraph's `checkpoint_writes` implementation, OpenHands' `ConversationState`, aider's history
  code, or the Codex CLI. All framework claims here are documentation- or measurement-backed.
- **Codex resumption semantics.** Official docs (`developers.openai.com`) returned 403; the only
  substantive page was a third-party KB that also 403'd. The session store path
  (`~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`) and "codex resume --all" behaviour come from a search
  snippet of issue #20165, which I could not open. Whether Codex re-runs an interrupted tool call is
  **unknown to me**.
- **The Reflexion ablation table, from the primary text.** The fetched HTML was truncated before the
  ablation body and re-fetches failed. The 0.68/0.60/0.52 numbers are from **alphaXiv**, a secondary
  analysis; treat the exact decimals as unverified even though the direction matches Huang et al.
- **Google SRE's blameless-postmortem text.** `sre.google` and the Wayback Machine were both
  unreachable; I have only a search snippet. No claim here rests on SRE beyond that snippet.
- **The new OTel GenAI semconv repository** (`open-telemetry/semantic-conventions-genai`, 392★,
  Apache-2.0): unreachable. I read only the deprecated/moved registry page on opentelemetry.io.
- **Microsoft `WorkflowCheckpoint`.** `src/core/checkpoint.ts` says it copied two guards ("graph
  signature", "explicit lineage") from "the strongest precedent found in the wild (Microsoft's
  `WorkflowCheckpoint`)". I could **not** locate or read any such class — treat that citation as
  unverified.
- **The OpenHands resume issue** (`OpenHands/software-agent-sdk#2867`, "persist session_id and use
  load_session on resume"): only a search snippet; the issue page and API were unreachable.

## Caveats / Not Found

- **Repository metadata (for the "record every repo" rule).** Stars / last-commit / licence below come
  from **shields.io badge JSON**, not the GitHub API (rate-limited) or the repos themselves. Stars are
  rounded ("42k"); last-commit values are **relative labels** ("today", "may"), not dates or SHAs. Treat
  as approximate.

| owner/name | stars | last commit (badge, relative) | licence | what I actually read |
|---|---|---|---|---|
| langchain-ai/langgraph | ~42k | "last wednesday" | MIT | `docs.langchain.com/oss/python/langgraph/{checkpointers,persistence,fault-tolerance}.md` |
| Aider-AI/aider | ~49k | "may" | Apache-2.0 | `aider.chat/docs/faq.html`, `aider.chat/docs/config/options.html` |
| openai/codex | ~127k | "today" | Apache-2.0 | issue #20165 (title only, via API); **no docs** |
| OpenHands/OpenHands | ~89k | "today" | MIT | `docs.openhands.dev/sdk/guides/convo-persistence.md` |
| open-telemetry/semantic-conventions-genai | ~392 | "last thursday" | Apache-2.0 | **none (unreachable)**; read the moved-notice on opentelemetry.io instead |
| noahshinn024/reflexion | *repo not found via badge service* | — | — | arXiv:2303.11366 abstract + alphaXiv analysis; **repo not located** |

- **Two arXiv papers exist and are directly on-topic**, contra the usual expectation that a repo's cited
  IDs are decorative: 2608.03836 (Khan, Aug 2026) and 2609.29095 (Li, Sep 2026) both resolve and both
  measure exactly the resumption question. `src/core`'s comments quote them accurately.
- **The two central measurements disagree on one point and agree on another.** Disagree: LangGraph docs
  say pending writes prevent re-running completed nodes; 2608.03836 measured re-execution after SIGKILL
  (the crash window between effect and durable write). Agree: the durable guarantee lives in the tool
  contract / shared store, not the loop (2609.29095: contract explains 81%; "the harness barely
  matters"; keys cut duplicates 28%→4%).
- **Where I could not find published double-execution evidence.** Paper 2608.03836 is a *benchmark*
  (deterministic harness at pinned releases) rather than an incident report; I found **no** named
  engineer post-mortem of a production double-execution after resume. The best "this actually happened"
  evidence remains that paper's fault-matrix saturation and 2609.29095's 56%/74% in-flight duplication.
  A production incident report would outrank both and I did not find one.
- **Opinion on the harness decision this implies.** The repo already has both halves and wires neither:
  plan-level resumption runs (`project-provider/continuation.ts`, the Trellis journal) while effect-level
  exactly-once is a correct library with no caller. The smallest useful move is not a third design — it is
  to make the effect ledger load-bearing (call `dispatchOnce` on at least the non-reversible tools) and
  to give every such tool a deterministic effect key. Everything else in Parts B and C (fingerprint
  identity, oracle-grounded critique) is worth building only after that, because a self-check that runs
  on an unwired harness has nothing to check.
