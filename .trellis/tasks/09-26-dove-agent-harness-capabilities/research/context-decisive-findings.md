# Context: the decisive findings, and the third implementation

- Date: 2026-09-26
- Source: `research/harness-context-management.md` (~8,600 words, every claim carrying the URL, package or
  file the agent actually read)

## 1. There are now three implementations of the admission contract

The agent found that **the DSH desktop application running this very session** already implements the
admission boundary: `dsh-spill-policy`, `dsh-output-retention` and
`dsh-compaction-tool-result-pruner`, with defaults `thresholdChars 8192 / head 4096 / tail 1024`, and a
KV-cache-preserving compaction call whose directive is appended as the **final** user message so the
auxiliary call shares the prefix of the last routed request.

Meanwhile `src/core/context-admission.ts` implements the same contract - `admit()`, 8000 characters, a
sha256 digest, an `artifactRef` - and is **unwired**. And `.trellis/` injects context with a budget, which
is a third approach to the same problem.

**Three implementations of one contract.** This project has spent eight review rounds finding that defect
inside a single vertical; at the harness level it now spans a vendor application, unwired core modules, and
the workflow layer.

## 2. Length costs quality independently of retrieval - and there is a cheap mitigation

**arXiv:2510.05381** (EMNLP 2025 Findings, Du et al.), five models, math/QA/coding: performance degrades
**13.9% to 85%** as input grows, **even with perfect retrieval, even when the irrelevant tokens are pure
whitespace, even when they are masked away**. The mitigation the paper measures: have the model **recite the
retrieved evidence before solving** - +4% for GPT-4o on RULER.

Supporting work with numbers: **RULER** (arXiv:2404.06654) - of models claiming 32K, "only half maintain
satisfactory performance at 32K". **NoLiMa** (arXiv:2502.05167, ICML 2025) - at 32K, 11 of 13 models fall
below 50% of their short-context baseline; GPT-4o 99.3% to 69.7%. **Chroma's Context Rot** (2025-07-14,
18 models) - degradation is non-uniform and worsens as needle-question similarity drops.

**What this requires of the design**: a small context plus a recitation step is the cheapest measured
improvement available, and it argues against the "inject the relevant documents" model the live layer uses.

## 3. The thresholds, all read from shipped code rather than from marketing

| Harness | Trigger | What it keeps |
|---|---|---|
| Claude Code (npm 1.0.128) | auto-compact at `effective_window - 13,000` | 3 most recent tool results; ≤40,000 tokens of tool-result text; acts only if ≥20,000 tokens would be freed **and** <20,000 remain |
| Codex | `auto_compact_token_limit()`, 90% of the window, **accounting scope excludes the system prompt and tools so the KV prefix stays stable** | all annotated user messages + a 4-bullet summary |
| Cline | 0.9 of usable input, target 0.7 | typed user messages + 3 most recent assistant texts + a `<SYSTEM_NOTICE>` activity summary; strips attachments except the latest |
| OpenHands | `max_size=80` events | `keep_first=4`, last 40 events |
| **DSH (this session's host)** | `thresholdRatio 0.8` | `retainRatio 0.16` verbatim tail + a fixed 9-section checkpoint in `<compacted-summary>` tags |

**Every one of these is a team's product default, not a measured optimum.** No source reports an experiment
that chose its own threshold. Nothing here should be copied as if it were tuned.

## 4. Dropping content is safe only under three conditions

(a) the content is re-fetchable, (b) the marker says **what** was lost, and (c) **the harness invalidates
its own cached beliefs about it.**

**Claude Code is the only implementation found that does (c)**: after clearing a Read result it deletes that
file from `readFileState`, so the model must re-read rather than trust a memory the harness knows is gone.
The agent's own note: "that is two lines and it closes a real bug class".

And no evidence anywhere that **an agent can detect its own context loss** - every harness *tells* the model,
and none relies on it noticing. Claude Code invalidates `readFileState` precisely because it assumes the
model will not notice.

## 5. OpenHands' shape is worth copying verbatim

Its `Condensation` is itself a durable event: `{forgotten_event_ids, summary, summary_offset,
llm_response_id}`. Events are removed from the **view** given to the model but remain in the event store, so
the transcript always carries a machine-readable list of what the model can no longer see. It snaps
forgetting ranges to "manipulation indices" so **a tool call and its result are never split** - DSH has the
same invariant as `toolPairingBalancedBefore/After`.

## 6. Cline's stale-compaction guard, and a requirement it implies

Cline stores a sidecar with `source_message_count` and a **sha256 of the source prefix**, and refuses to
project the compaction unless the hash matches the current transcript - so a stale compaction can never
silently apply. Its code comments record two real bugs: including id/timestamp in the hash made projection
fail every turn, and reasoning models burned the summary budget thinking and returned no summary at all, so
**compaction silently did not happen** until the budget was raised.

**Requirement**: a compaction that fails must be **observable**. Silent non-compaction is the failure mode,
not the exception.

## 7. Untrusted marking is advisory everywhere, including here

**Spotlighting** (arXiv:2403.14720, Microsoft) measures attack success dropping from >50% to <2% through
provenance marking - but the marking is **text inside the same context**. **CaMeL** (arXiv:2503.18813,
DeepMind) buys provable security at **77% versus 84%** task utility on AgentDojo; that roughly seven-point gap
is the price of enforcement.

This repository marks untrusted content in prose (`[PROJECT_CONTEXT trust=untrusted ...]` in
`context-compiler.ts`) and **only its marker-forging escape is actually enforced** - escaping `[`, `]`,
CR and LF to `%XX` so a file name cannot forge a context marker. DSH does the same in prompt text
(`EXTERNAL_WEB_CONTENT_NOTICE`) and puts enforcement in the sandbox and the UI renderer.

**Consequence for the design**: the places that stop untrusted content are the **entry gate and the
capability scope**, not the context compiler. Marking is orientation.

## 8. A correction to an assumption in the brief

The brief assumed codebase search is embeddings-based. **Cursor's current documentation states it does not
store embeddings of your codebase and does not upload paths or code to build an index** - it ships a local
"Instant Grep". Aider's repo map is a **1,024-token symbol map** (x8 when no files are open), built with
tree-sitter and PageRank over chat files, lazily refreshed once building it costs more than a second, and
explicitly **a handle the model uses to ask for files** rather than a retrieval result.

## 9. The one measurable regression test

The only artefact found whose stated purpose is measuring **what compaction loses** is Anthropic's
`COMPACTION_PROBES` in `claude-cookbooks/tool_use/context_engineering/research_corpus.py`, used to test
which answers survive a summary. Given that "error recording and self-check iteration" is one of the nine
capabilities, this suggests a concrete requirement: **compact a fixed long session, then assert the probe
answers still hold.**

## 10. The sentence I was told not to write

From the agent's caveats, verbatim:

> The headline degradation numbers are retrieval/reasoning proxies, NOT agent task success. I could not find
> ANY published A/B of agent task success with vs without compaction. **Do not write "agents get X% worse at
> N tokens" in the design doc.**

That discipline applies to every number in this directory. The design may cite *mechanisms* and *requirements*;
it may not cite a performance claim nobody has measured.
