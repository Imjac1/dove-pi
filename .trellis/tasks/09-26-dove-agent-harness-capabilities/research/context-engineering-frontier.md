# Research: context engineering as currently practised

- **Query:** How do shipping harnesses actually do *context engineering* — concretely: (1) compaction and
  what survives it, (2) context isolation vs context injection, (3) the file system as external memory,
  (4) measured degradation of long context, (5) who filters tool output before the model sees it.
- **Scope:** Claude Code (docs + observable behaviour; closed source), OpenAI Codex (source), Aider
  (source), Cline (source, partial), OpenHands SDK (source), Manus (named-engineer post), Anthropic
  engineering posts, 12-factor-agents, and the long-context literature (Lost-in-the-Middle, RULER,
  LongBench, Chroma *Context Rot*, Du et al. 2025, LIMBO). Cursor was attempted and **failed**.
- **Date:** 2026-09-26.
- **Fetch methods used** (recorded because the previous wave reported a different environment):
  - `raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>` — **primary**; worked for every source file
    below. All reads are branch `main` at fetch time, so **no SHA is pinned** — line numbers will drift.
  - `ungh.cc/repos/<owner>/<repo>` and `/files/<branch>` — metadata and file lists. The file list is
    truncated at 100 000 chars, so large monorepos are only partly enumerable this way.
  - `img.shields.io/github/license/<owner>/<repo>.json` and `.../stars/...` — licence and stars.
  - `api.github.com` — directory listings only; **exhausted its 60/hr unauthenticated budget** during this
    session (used on trees/contents).
  - `code.claude.com/docs/en/<page>.md` — the `.md` twin; real content, unlike the JS-rendered HTML.
  - `arxiv.org/abs/<id>` — abstracts via the `citation_abstract` meta tag.
  - `read_page` (JS-rendering reader) — required for `anthropic.com`, `research.trychroma.com`,
    `manus.im`; their HTML is JS-rendered and near-empty when fetched raw.
  - **Failed / not usable:** `cdn.jsdelivr.net` (`fetch failed`); `web_search` (every engine down —
    "firecrawl request failed"); `docs.cursor.com` and `cursor.com/docs` (cross-origin redirect not
    followed; the resolved page is a Next.js error shell); `platform.claude.com/docs/**/*.md`
    (cross-origin redirect to `anthropic.com`; the rendered page is **region-blocked**, "App unavailable").

Labels: **[SOURCE]** what a source states · **[CODE]** what I read in source code · **[VENDOR]** vendor
marketing or a vendor-internal eval, named as such · **[PRIOR]** read by a sibling sub-agent, not
re-fetched by me · **[INFERENCE]** / **[OPINION]** mine.

---

## Repositories read

| owner/name | stars | last commit (pushedAt) | licence | files I actually read |
|---|---|---|---|---|
| `openai/codex` | 126 560 | 2026-09-26 | Apache-2.0 | `codex-rs/core/src/compact.rs`, `compact_token_budget.rs`, `context_manager/{mod,history}.rs`, `session/token_budget.rs`, `prompts/src/compact.rs`, `prompts/templates/compact/{prompt,summary_prefix}.md`, `utils/output-truncation/src/lib.rs` |
| `Aider-AI/aider` | 49 203 | 2026-05-22 | Apache-2.0 | `aider/history.py`, `aider/models.py`, `aider/coders/base_coder.py`, `aider/prompts.py` |
| `cline/cline` | 69 367 | 2026-09-26 | Apache-2.0 | `apps/cli/src/runtime/interactive/compaction.ts` (only the CLI wrapper; core in `@cline/core` **not read**) |
| `OpenHands/software-agent-sdk` | 1 172 | 2026-09-26 | MIT | `openhands-sdk/openhands/sdk/context/condenser/{base,llm_summarizing_condenser,pipeline_condenser,utils}.py`, `.../condenser/prompts/summarizing_prompt.j2`, `.../context/view/view.py`, `.../context/view/properties/tool_loop_atomicity.py`, `.../context/memory.py` |
| `OpenHands/OpenHands` | 89 166 | 2026-09-25 | MIT | metadata only (the SDK is the live condenser home; the monorepo's `openhands/memory/condenser/*` paths 404 now) |
| `humanlayer/12-factor-agents` | 26 394 | 2025-09-21 | "not identifiable by github" | `README.md`, `content/factor-03-own-your-context-window.md` |

Stars/last-commit from `ungh.cc`; licences from `shields.io` (rounded values, not SHAs).

---

## What the sources state

### 1. Compaction, concretely — thresholds and survivorship

**Claude Code** ([SOURCE] — `code.claude.com/docs/en/context-window.md`, `how-claude-code-works.md`,
`model-config.md`, `memory.md`, `troubleshooting.md`, all fetched 2026-09-26).

- Definition: "/compact … replaces the conversation with a structured summary" (`context-window.md`,
  interactive simulation). Auto-compaction runs "as you approach the limit".
  `how-claude-code-works.md`: "It **clears older tool outputs first, then summarizes** the conversation
  if needed. Your requests and key code snippets are preserved; **detailed instructions from early in the
  conversation may be lost**."
- **What survives compaction** — a table with per-mechanism survivorship (`context-window.md`, section
  "What survives compaction"):
  - System prompt + output style → stay.
  - Project-root `CLAUDE.md`, unscoped rules, auto memory, git status snapshot, and the plan-mode plan →
    **re-injected from disk**.
  - Rules with `paths:` frontmatter and nested subdirectory `CLAUDE.md` → **summarized away**; reloaded
    lazily only when a matching file is read later.
  - **Files read/edited → Claude Code re-reads up to five, most recently modified first.** A re-read file
    **over 5,000 tokens comes back as a path reference without its content** ("Referenced file").
  - Invoked skill bodies → re-injected, **capped at 5,000 tokens per skill and 25,000 total, oldest
    dropped first**; truncation keeps the *start* of the file.
  - The **skill *listing* is not re-injected after /compact** (only skills actually invoked are preserved).
  - Background commands/subagents keep running, and Claude Code "reminds Claude which ones are still
    running so it doesn't start a duplicate".
  - Context added by hooks earlier → summarized with everything else; but `SessionStart` hooks matching
    source `compact` re-run and re-inject.
- **Thresholds** (`model-config.md`, "Default auto-compact thresholds"): by default it compacts at the
  model's context limit; exceptions include Opus 4.6/Sonnet 4.6 (no extended context) compacting at the
  **200K boundary**, and native-1M models compacting "at about **967K tokens** by default". Users can
  move it earlier with `/autocompact 500k`. (That doc page was returned truncated at exactly 100 000
  chars by the fetch tool.)
- **Failure mode** (`troubleshooting.md`): "`Autocompact is thrashing: the context refilled to the
  limit…`" — Claude Code "stops retrying to avoid wasting API calls on a loop that isn't making
  progress". Recovery: chunk the file, /compact with a focus, move the work to a subagent, or /clear.

**OpenAI Codex** ([CODE] — `openai/codex`, `main`). Two distinct compaction strategies:

- **Summarization compaction** (`codex-rs/core/src/compact.rs`): on compaction it does **not** re-use the
  whole history. It collects **user messages only** (`compacted_user_message`, l.558; summary messages are
  excluded by `is_summary_message`, l.576), walking **most-recent-first** until
  `COMPACT_USER_MESSAGE_MAX_TOKENS = 20_000` (l.54) is spent (`build_compacted_history_with_limit`,
  l.661–744). Assistant turns, tool calls and tool results are dropped. It then appends the model-generated
  summary as a final `CompactionSummary` (`build_compacted_history`, l.648). If the compaction request
  itself overflows, it calls `history.remove_first_item()` — "Trim from the beginning to preserve cache
  (prefix-based) and keep recent messages intact" (l.312).
- The summary prompt is short and handoff-shaped (`codex-rs/prompts/templates/compact/prompt.md`): "You are
  performing a CONTEXT CHECKPOINT COMPACTION. Create a handoff summary for another LLM that will resume the
  task." — progress, constraints, next steps, critical data. `summary_prefix.md` is prepended, and it
  **tells the next model context was lost**: "Another language model started to solve this problem and
  produced a summary … You also have access to the state of the tools … avoid duplicating work."
- **Token-budget compaction** (`compact_token_budget.rs`) is a *second* strategy that "**skips model/
  server summarization and installs a fresh context window instead**", still modelled as compaction so
  pre/post-compact hooks fire. So Codex can either summarize or hard-reset.
- Codex emits a user-visible warning on compaction (`compact.rs` ~l.397): "Heads up: **Long threads and
  multiple compactions can cause the model to be less accurate.** Start a new thread when possible…".

**Aider** ([CODE] — `aider/history.py`, `aider/models.py`, `aider/coders/base_coder.py`):

- Threshold is *derived from the model window*, not a fixed number (`models.py` l.355–357):
  `max_chat_history_tokens = min(max(max_input_tokens / 16, 1024), 8192)`; default 1024 when the window is
  unknown (l.338).
- `ChatSummary.summarize_real` (`history.py`): if total tokens ≤ budget, no-op. Otherwise it keeps a
  **tail** of recent messages up to ~half the budget, ensures the head ends on an assistant message, and
  **LLM-summarizes the head only**, then returns `summary + tail`. If summary+tail still doesn't fit it
  **recurses** (depth ≤ 3), and past that or with ≤ 4 messages it collapses everything via
  `summarize_all` into a **single user message** prefixed with `summary_prefix`.
- Summarization runs on a **background thread** started at the top of a turn (`summarize_start`, l.1001;
  `summarize_worker`, l.1013) — i.e. it overlaps with the user's next interaction rather than blocking.
- The summary prompt (`prompts.py`) is explicit about survivorship: "Include **less detail about older
  parts and more detail about the most recent messages**"; it must name function names, packages and
  referenced filenames but **must not include code fences**; the summary is written in the user's first
  person and starts "I asked you…".

**Cline** ([CODE] — `apps/cli/src/runtime/interactive/compaction.ts`): the CLI wrapper imports
`createContextCompactionPrepareTurn` **from `@cline/core`** (I could not read that package — see
Could-not-verify). It defines `FALLBACK_MANUAL_COMPACTION_MAX_INPUT_TOKENS = 64_000` for models with
unknown limits, and — a concrete survivorship decision — **manual /compact intentionally re-summarizes the
full canonical transcript rather than reusing a prior sidecar summary**, "which avoids
**summary-of-summary drift** across repeated /compact calls". Auto- and manual compaction share the path;
compaction emits telemetry (`task.compaction_executed` / `…skipped`).

**OpenHands SDK** ([CODE] — `openhands-sdk/openhands/sdk/context/condenser/`): the cleanest published
design. A `CondenserBase.condense(view, agent_llm) -> View | Condensation` interface, composed by a
`PipelineCondenser`. The default `LLMSummarizingCondenser` (`llm_summarizing_condenser.py`):

- Config: `keep_first = 2` (first N events never condensed), `max_size = 240` **events**,
  `max_tokens: int | None`, `minimum_progress = 0.1`.
- Trigger reasons: `REQUEST` (explicit), `TOKENS` (**hard** requirement — "sending the next request can
  fail before the recovery path has a chance to run"), `EVENTS` (**soft** — the event count is "only a
  history-management heuristic"). Any `REQUEST` is hard.
- Forgetting rule: it computes how many **tail** events to keep (≈ half of `max_size`, or half the token
  budget), then **summarizes the middle** — the range between the protected prefix and the kept tail. It
  always protects the leading `SystemPromptEvent` so a condensed view cannot open with a non-system
  message (`_leading_system_prompt_index`).
- **Atomic boundaries:** the start/end of the forgotten range are snapped to `view.manipulation_indices`,
  the intersection of property-derived index sets — `tool_call_matching`, `observation_uniqueness`,
  `tool_loop_atomicity`, `batch_atomicity` (`context/view/properties/*`). `tool_loop_atomicity.py` explains
  why: for Anthropic models with thinking enabled, "they expect the first element of such a tool loop to
  have a thinking block, and use some checksums… if we remove any element of the tool loop we have to
  remove the whole thing."
- Summarization prompt (`prompts/summarizing_prompt.j2`) requires a **TASK_TRACKING section preserving
  exact task IDs and statuses**, plus `USER_CONTEXT / COMPLETED / PENDING / CURRENT_STATE`, and for code
  work `CODE_STATE / TESTS / CHANGES / DEPS / VERSION_CONTROL_STATUS`.
- Fallback: `hard_context_reset` summarizes the whole view, and on failure **retries by shrinking the
  per-event string cap by ×0.8** up to 5 times. A failed condensation raises
  `NoCondensationAvailableException` and the agent falls back to the uncondensed view.

**Cursor:** not obtained (see Could-not-verify).

### 2. Context isolation as the frontier answer

- **Anthropic, *Effective context engineering for AI agents*** (Sep 29 2025, Applied AI team; [SOURCE],
  fetched via `read_page`): "Rather than pre-processing all relevant data up front, agents built with the
  'just in time' approach **maintain lightweight identifiers (file paths, stored queries, web links)** and
  use these references to dynamically load data into context at runtime." Sub-agent architectures: "each
  subagent might explore extensively, using tens of thousands of tokens or more, but **returns only a
  condensed, distilled summary of its work (often 1,000–2,000 tokens)**." Compaction "distills the contents
  of a context window… The model preserves architectural decisions, unresolved bugs, and implementation
  details while discarding redundant tool outputs or messages. The agent can then continue with this
  compressed context **plus the five most recently accessed files**" — matching the Claude Code behaviour
  in §1.
- **Claude Code sub-agents** ([SOURCE] `code.claude.com/docs/en/sub-agents.md`, `agent-sdk/subagents.md`):
  "Each subagent runs in its **own context window**… the subagent does that work in its own context and
  **returns only the summary**." A "fork" variant instead starts the subagent with a copy of the current
  conversation. Subagents can have persistent memory of their own.
- **Anthropic, *How we built our multi-agent research system*** ([VENDOR] — Engineering blog, fetched via
  `read_page`): multi-agent (Opus 4 lead + Sonnet 4 subagents) "outperformed single-agent Claude Opus 4 by
  **90.2%** on our internal research eval". The mechanism is stated plainly: "Multi-agent systems work
  mainly because they help **spend enough tokens** to solve the problem… **token usage by itself explains
  80% of the variance**" on BrowseComp (three factors → 95%). Cost: "agents typically use about **4×** more
  tokens than chat interactions, and multi-agent systems use about **15×**". And a design constraint that
  is really a compaction fact: the lead "**saving its plan to Memory to persist the context, since if the
  context window exceeds 200,000 tokens it will be truncated**".
- The direction of this evidence is subtle and worth stating: isolation raises *task* performance by
  spending more tokens across *smaller* windows; the degradation literature (§4) says a *single* large
  window is worse. Both are consistent only if you read "context length" as *per-window* length.

### 3. File system as external memory

- **Claude Code** ([SOURCE] `memory.md`): two systems, both loaded at every session start —
  human-written `CLAUDE.md` (or an existing `AGENTS.md`) and machine-written **auto memory**. Auto memory is
  "**Loaded into: Every session (first 200 lines or 25KB)**". "Claude treats them as context, not enforced
  configuration."
- **Codex** ([CODE]): `codex-rs/core/src/agents_md.rs` (20 KB) implements AGENTS.md discovery/merging;
  `session/token_budget.rs` has a `use_history_notes_extension` flag — a token-budget-driven "history
  notes" memory extension (I read the flag, not the implementation).
- **OpenHands SDK** ([CODE] `context/memory.py`): a **two-tier** persistent memory — user tier
  `~/.openhands/memory/MEMORY.md` and project tier `<workspace>/.openhands/memory/MEMORY.md` — loaded into
  the prompt with `MEMORY_CHAR_BUDGET = 6000` chars and **line-wise truncation from the top** so the most
  recent tail survives ("`[earlier memory truncated]`"). Daily logs (`YYYY-MM-DD.md`) are **deliberately not
  loaded**; the agent reads them on demand. That is the handles-vs-content split: an index in context,
  payloads behind a path.
- **Anthropic** ([SOURCE] context-engineering post + news post): "your custom agent maintaining a
  **NOTES.md** file"; the Claude Developer Platform **memory tool** is "a file-based system" where Claude
  creates/reads/updates/deletes files in a dedicated memory directory, **client-side, with the developer
  owning the storage backend**.
- **Manus** ([SOURCE] Yichao 'Peak' Ji, *Context Engineering for AI Agents: Lessons from Building Manus*,
  2025-07-18; partial read — see gaps): the first lesson is "**Design Around the KV-Cache**": "the **KV-cache
  hit rate is the single most important metric** for a production-stage AI agent"; average input:output
  token ratio ≈ **100:1**; cached input on Claude Sonnet costs \$0.30/MTok vs \$3/MTok uncached. Practices:
  keep the prompt prefix byte-stable (no second-precision timestamps), keep context **append-only**,
  deterministic serialization, explicit cache breakpoints. Second lesson: "**Mask, Don't Remove**" —
  "unless absolutely necessary, **avoid dynamically adding or removing tools mid-iteration**", because it
  invalidates the KV-cache and leaves prior actions referring to undefined tools; Manus masks logits
  instead. (The later lessons — file system as context, recitation, keeping errors — were beyond the
  fetch truncation.)
- **12-factor-agents** (Dex Horthy et al.; [SOURCE] `content/factor-03-own-your-context-window.md`):
  Factor 3 — "Everything is context engineering… you want the flexibility to be able to try EVERYTHING",
  including non-standard context formats packed into one user message. This is the *injection-era* framing
  the isolation literature supersedes.

### 4. Measured degradation

Capacity ≠ retrieval quality is the recurring theme; read each number against *what it measured*.

- **Lost in the Middle** (Liu et al., arXiv:2307.03172; [SOURCE] abstract): on multi-document QA and
  key-value retrieval, "performance is often highest when relevant information occurs at the **beginning
  or end** of the input context, and significantly degrades… **in the middle**". **Measures retrieval
  position sensitivity, not agent task success.**
- **RULER** (NVIDIA, arXiv:2404.06654; [SOURCE] abstract): a synthetic long-context benchmark extending
  NIAH with multi-hop tracing and aggregation. "Despite achieving nearly perfect accuracy in the vanilla
  NIAH test, **almost all models exhibit large performance drops as the context length increases**. While
  these models all claim context sizes of 32K tokens or greater, **only half of them can maintain
  satisfactory performance at the length of 32K**." This is the origin of the **effective context length**
  idea. **Measures synthetic retrieval/reasoning, not agent tasks.**
- **LongBench** (arXiv:2308.14508; [SOURCE] abstract): first bilingual multi-task long-context benchmark
  (21 datasets, 6 categories, ~6.7k words avg). Found GPT-3.5-Turbo-16k "still struggles on longer
  contexts". **Measures long-context understanding tasks.**
- **Chroma, *Context Rot*** (Hong, Troynikov, Huber, July 14 2025; [SOURCE] technical report, fetched via
  `read_page`): 18 LLMs incl. GPT-4.1, Claude 4, Gemini 2.5, Qwen3. "**model performance consistently
  degrades with increasing input length**" — and non-uniformly. Findings: lower needle–question *semantic*
  similarity degrades faster with length; "**even a single distractor reduces performance** relative to the
  baseline… adding four distractors compounds this"; haystack *structure* (shuffled vs ordered) matters;
  needle *position* showed no notable variation in their specific NIAH task. **Measures retrieval/QA, not
  agent task success** — but it holds task complexity fixed and varies only length, which is the rigorous
  way to isolate the variable.
- **Du et al., *Context Length Alone Hurts LLM Performance Despite Perfect Retrieval*** (arXiv:2510.05381,
  EMNLP 2025 Findings; [SOURCE] abstract): across 5 open/closed models on **math, question answering, and
  coding**, "even when models can **perfectly retrieve** all relevant information, their performance still
  degrades substantially (**13.9%–85%**) as input length increases but remains well within the models'
  claimed lengths". The failure persists with minimally-distracting whitespace and even when irrelevant
  tokens are masked. Mitigation: "**transform a long-context task into a short-context one by prompting the
  model to recite the retrieved evidence before attempting to solve**"; on RULER, GPT-4o +up to 4%. **This
  is the closest thing to a task (not retrieval) measurement.**
- **Anthropic multi-agent** ([VENDOR]): token usage explains 80% of BrowseComp variance (positive
  direction). **Vendor-internal eval, not reproducible.**
- **Claude Developer Platform context management** ([VENDOR] — anthropic.com/news/context-management, Sep
  29 2025): on an internal agentic-search eval, "**memory tool + context editing improved performance by
  39%** over baseline; **context editing alone 29%**"; in a 100-turn web-search eval, context editing cut
  **token consumption by 84%**. **Vendor-internal, unnamed eval.**

### 5. The admission question — who filters tool output before the model sees it

- **Codex has an actual admission function.** `codex-rs/utils/output-truncation/src/lib.rs`:
  `TruncationPolicy::Bytes(n) | Tokens(n)`; `truncate_text` truncates the **middle** (`truncate_middle_chars`
  / `truncate_middle_with_token_budget`). `formatted_truncate_text` prepends a digest header: "**Warning:
  truncated output (original token count: {n}) Total output lines: {m}**".
  `with_serialization_allowance` multiplies the budget by **1.2** for serialization/headers. The policy
  comes from the model's `model_info().truncation_policy` (seen in `compact.rs`), i.e. **per-model, not
  global**. Image/audio content items are carried through untruncated while text is collapsed.
- **Claude Code** ([SOURCE] `mcp.md`): "Claude Code displays a warning when **MCP tool output exceeds
  10,000 tokens and limits output to 25,000 tokens by default**. To raise the limit, set
  `MAX_MCP_OUTPUT_TOKENS`". Per-tool override `anthropic/maxResultSizeChars`. MCP **tool schemas are
  deferred by default** (tool search): "only tool names and server instructions consume context until
  Claude uses a specific tool". And the docs hand the general admission job to *hooks* (`costs.md`):
  "Instead of Claude reading a 10,000-line log file to find errors, **a hook can grep for ERROR and return
  only matching lines**, reducing context from tens of thousands of tokens to hundreds." **[OPINION]** That
  is admission delegated to user configuration — the harness provides the boundary but not the policy.
- **OpenHands** ([CODE]): the condenser is admission for history; `maybe_truncate` (`utils.py`) caps each
  *forgotten* event string before it is fed to the summarizer; and `get_shortest_prefix_above_token_count`
  binary-searches how many events to drop to hit half the token budget.
- **Manus** ([SOURCE]): "mask, don't remove" — availability is enforced by masking action logits rather
  than editing the tool list, to keep the prefix (and thus the KV-cache) stable.

---

## What I read in code (the [CODE] claims, restated with provenance)

- Codex compaction *keeps user messages, drops assistant/tool turns, appends a summary*:
  `codex-rs/core/src/compact.rs`, `compacted_user_message` l.558, `build_compacted_history` l.648,
  `build_compacted_history_with_limit` l.661–744, `COMPACT_USER_MESSAGE_MAX_TOKENS`=20 000 l.54,
  `remove_first_item` l.312, warning l.~397. Handoff prompt at
  `codex-rs/prompts/templates/compact/prompt.md`; disavowal-of-context prefix at `summary_prefix.md`.
- Codex has a *second, non-summarizing* compaction: `codex-rs/core/src/compact_token_budget.rs`.
- Codex admission/truncation: `codex-rs/utils/output-truncation/src/lib.rs` (middle-truncation + digest +
  1.2× allowance).
- Codex token reminders/fallback and a history-notes memory flag: `codex-rs/core/src/session/token_budget.rs`.
- Aider threshold arithmetic and head/tail recursive summarizer: `aider/models.py` l.338 & 355–357;
  `aider/history.py` (`ChatSummary.summarize_real`, `summarize_all`); background trigger
  `aider/coders/base_coder.py` l.1001/1013; summary prompt `aider/prompts.py`.
- Cline re-summarizes the canonical transcript to avoid summary-of-summary drift:
  `apps/cli/src/runtime/interactive/compaction.ts`.
- OpenHands condenser config/trigger/forgetting/atomicity: `context/condenser/base.py`,
  `llm_summarizing_condenser.py`, `pipeline_condenser.py`, `utils.py`; `context/view/view.py`
  (`manipulation_indices`), `context/view/properties/tool_loop_atomicity.py`; summarization template
  `context/condenser/prompts/summarizing_prompt.j2`; memory `context/memory.py` (`MEMORY_CHAR_BUDGET = 6000`).

I did **not** read any Claude Code or Cursor source — both are closed/minified. Every Claude Code claim
above rests on its docs, not code, and is marked [SOURCE].

---

## Must-answer questions

### (a) What is the *measured* relationship between context length and agent task success?

**Name the benchmark — honestly, there isn't one clean one.** No widely-used benchmark plots *real agent
task success* against context length on agent traces. What exists, in ascending proximity to the question:

1. **RULER** (synthetic long-context): near-perfect NIAH accuracy collapses; "only half… maintain
   satisfactory performance at 32K" despite claiming ≥32K. This is the standard "effective context length"
   reference.
2. **Chroma *Context Rot*** (18 models, retrieval/QA, length-only variable): performance degrades
   non-uniformly with length; distractors and low needle–question similarity accelerate it.
3. **Du et al. 2025** (math/QA/**coding**): **13.9%–85% degradation despite perfect retrieval** — the
   cleanest demonstration that length alone costs task quality, and the only one here on coding tasks.
4. **Anthropic multi-agent** (BrowseComp, vendor-internal): token usage explains **80%** of variance —
   *positive*, because more tokens are spent across *isolated* windows.

[Caveat, per your instruction] "1M token context" is a **capacity** claim. Every number above measures
**retrieval or task quality at increasing length**, never capacity. RULER and Context Rot measure
*retrieval*; Du et al. measures *task* performance with retrieval held at ceiling; Anthropic measures task
success against *spent tokens*, not window size. [INFERENCE] The defensible reading: within one window,
more tokens degrade quality (retrieval and task); across windows, more tokens help. That is the empirical
argument for **isolation over injection**.

### (b) What do the best harnesses do that a naive one does not? (implementable)

1. **Budget the whole window, not the last message.** Derive the compaction threshold from the model
   window (Codex: per-model `truncation_policy`; OpenHands: `min(max_tokens, agent_llm.effective_max_input_tokens)`;
   Aider: `window/16`). Thresholds are *fractions or event counts*, not constants (Codex 20k user-token
   cap; OpenHands 240 events; Claude Code "compact at ~967K of 1M").
2. **Compaction has an explicit survivorship contract.** Codex keeps *user messages* (≤20k tokens) +
   summary; Anthropic/Claude Code keep *root CLAUDE.md, auto memory, git status, the plan* re-injected from
   disk, re-read ≤5 recent files, cap skill bodies 5k/25k. The naive harness keeps "the summary" and
   silently loses all of this.
3. **Re-inject from disk; never trust the summary for durable facts.** Path-scoped rules and nested
   CLAUDE.md are *deliberately* summarized away and lazily reloaded. Persistent rules belong in a file the
   harness re-reads, not in the conversation.
4. **Clear tool results first, summarize second.** Claude Code: "clears older tool outputs first, then
   summarizes"; Anthropic recommends tool-result clearing as "the safest, lightest-touch form of
   compaction". This is the cheapest win and it is separable from summarization.
5. **Truncate the *middle* of oversized tool output and attach a digest.** Codex's `formatted_truncate_text`
   prints original token count and line count — a handle plus the fact that content was dropped. Aligns
   with Lost-in-the-Middle (keep head + tail).
6. **Snapshot-consistency for context edits.** OpenHands snaps forgotten ranges to `manipulation_indices`
   so tool-call/observation pairs and Anthropic thinking-block checksums stay intact. A naive harness
   drops half a tool loop and produces an API-invalid or incoherent context.
7. **Idempotent re-summarization (Cline) or depth-limited recursion (Aider).** Cline re-summarizes the
   canonical transcript (no summary-of-summary drift); Aider forbids summaries-of-summaries past depth 3.
   Naive chat-history compaction degrades each round.
8. **Isolate rather than inject.** Subagents return 1–2k-token summaries; the parent never sees the file
   reads.
9. **Keep the prefix stable for prompt caching.** Manus: prefix stability, append-only context, no
   mid-iteration tool churn. Codex's `remove_first_item` comment ("preserve cache (prefix-based)").
10. **Guard the failure mode.** Claude Code stops auto-compacting after repeated "thrashing" and errors
    instead of looping; OpenHands raises `NoCondensationAvailableException` and falls back to the
    uncondensed view. A naive loop either loops forever or silently degrades.
11. **Keep an index in context, payloads behind a path.** OpenHands `MEMORY.md` (6 000-char budget, top
    truncated, daily logs read on demand); Claude Code auto memory (200 lines / 25 KB).

### (c) Is there evidence that an agent *knows* it has lost context?

**No — and there is positive evidence that it does not.** Three strands:

- **Direct evidence of not knowing (strongest):** *Where Does Exactly-Once Live?* (arXiv:2609.29095, LIMBO
  sandbox, 25 930 episodes, 9 models, 3 harnesses; [SOURCE], I fetched the abstract myself; also [PRIOR] in
  `research/harness-resumption-and-self-check.md`): "**agents reported success in 90% of the episodes in
  which they had duplicated an effect**." An agent that has lost (or never received) its acknowledgement
  *claims success*. This is the empirical answer to (c) for the effect-state case.
- **The harness tells the model; the model doesn't detect:** Codex prepends `summary_prefix.md` ("Another
  language model started to solve this problem… avoid duplicating work"); Claude Code — "Claude sees the
  call marked as **cut off** before its result was recorded and is **told to check** whether it took effect
  before running it again" (`sessions.md`). The recovery behaviour is *prompted*, not self-generated.
- **A capacity-vs-awareness caveat:** Anthropic states Claude Sonnet 4.5 ships "built-in **context
  awareness** — tracking available tokens throughout conversations" ([VENDOR],
  news/context-management). That is awareness of *how full the window is*, not of *what was dropped*. I
  found **no benchmark measuring an agent's ability to detect its own context loss**.

[INFERENCE] **Resumption must not depend on the agent's self-report.** The safe design is what the sources
do: re-inject durable state from disk, mark interrupted effects as cut-off, and require the model to
*verify before re-executing* — because the model will otherwise report success. The 90% false-success rate
also means a transcript is not the safeguard; an **effect ledger** is.

---

## What is transferable to a harness

- **A single admission boundary that every tool result passes through**, with (a) a per-model token/byte
  budget, (b) middle-truncation, and (c) a machine-readable digest header (original size, lines, whether
  media survived). Codex's `truncate_text` + `formatted_truncate_text` is a ~200-line reference. Claude
  Code's 25 000-token MCP cap and `anthropic/maxResultSizeChars` show the per-tool escape hatch.
- **Two-stage context management, in this order: (1) clear/summarize tool results, (2) compact the
  conversation.** They are separable levers; the cheap one is stage 1.
- **An explicit, declarative survivorship contract** per context source: {re-inject-from-disk,
  re-read-recent-files(N, max-tokens), keep-as-path-handle, re-summarize}. This is the single most
  reusable artefact — Claude Code's survivorship table is the template.
- **Atomicity-aware context editing.** Port OpenHands' `manipulation_indices` idea: context edits must
  snap to boundaries where the message sequence stays API-valid (tool call/result pairing; provider
  thinking-block checksums). This is a correctness requirement, not a nicety.
- **An index-plus-payload memory split** (OpenHands `MEMORY.md` 6k chars; Claude Code auto memory 200
  lines/25 KB) with the *index* in context and *daily logs / payload files* behind a path the agent reads
  on demand.
- **Idempotent, non-recursive compaction.** Re-summarize from the canonical transcript (Cline) or cap
  recursion depth (Aider ≥3) so repeated compaction cannot drift.
- **A thrashing guard.** Cap consecutive compaction attempts and surface an error (Claude Code), rather
  than looping.
- **Separate "isolation" from "compaction" in the design vocabulary.** Subagents (small windows, summary
  return) and compaction (same window, summarized) are different answers to the same pressure; a harness
  needs both and should choose per task shape (Anthropic: compaction for back-and-forth, note-taking for
  milestones, multi-agent for parallel research).
- **Do not gate a resume on what the model says happened.** Mark interrupted effects, re-inject state from
  files, and force verification-before-re-execution. (LIMBO: 90% false-success.)

---

## Could not verify

- **Cursor's compaction** — not researched. `docs.cursor.com` cross-origin-redirects to `cursor.com`, whose
  `/docs/context` page returned a Next.js error shell. **No Cursor claim appears in this document.**
- **Cline's actual compaction algorithm** — the implementation lives in the `@cline/core` package;
  `api.github.com` rate-limited before I could enumerate it, and the ungh file list truncates before the
  package tree. I read only the CLI wrapper (`apps/cli/.../compaction.ts`) — the 64 000-token fallback and
  the "re-summarize the whole transcript" comment.
- **Manus lessons 3–6** (file system as context, recitation, keeping errors, few-shot traps) — the raw HTML
  is truncated at 100 000 chars and JS-rendered; I read lessons 1 (KV-cache) and 2 (mask, don't remove)
  only.
- **Anthropic platform docs for context editing / memory tool / tool context** —
  `platform.claude.com/docs/**/*.md` redirects to `anthropic.com`, and the rendered page is region-blocked
  ("App unavailable"). Claims about those features come only from the engineering post and the product news
  post.
- **Whether any model can detect its own context loss** — no benchmark found. The Sonnet 4.5 "context
  awareness" claim is token-budget awareness (vendor), not loss detection.
- **A per-agent, real-trajectory "task success vs context length" curve** — not found.

## Caveats / Not Found

- **[VENDOR] markers matter here.** Anthropic's "90.2%", "+39%/+29%", "84% token reduction" and "subagents
  return 1–2k tokens" come from Anthropic's own blog and product announcements and vendor-internal evals
  with unnamed sets. "Context rot" itself is *Chroma's* independent technical report (18 models) and is the
  strongest of the degradation citations; Anthropic merely popularised the term.
- **Capacity ≠ retrieval quality ≠ agent quality.** State which a source measures; each §4 entry is
  labelled. No source I read demonstrated an agent scoring *worse on a real task* because of a long window,
  except Du et al.'s coding/math/QA tasks under perfect retrieval.
- **Branch, not SHA.** All raw code reads are `main` at 2026-09-26; line numbers will drift. The Codex
  compaction code is under active churn (three compaction modules; a "remote v2" implementation I did not
  read).
- **Claude Code and Cursor are not code-verified.** Everything about Claude Code is from its docs. If a
  claim must be code-verified, it cannot be a Claude Code claim.
- **GitHub API exhausted (60/hr).** Tree enumeration for large repos was incomplete; some monorepo paths
  were guessed from known layouts.
- **`web_search` was entirely unavailable** this session (all engines failed), so discovery was via known
  URLs, repo file lists, and doc `.md` twins rather than search.
- **Line-reference convention:** file paths are relative to each repo root; line numbers are from the
  `main` revision fetched on 2026-09-26.
