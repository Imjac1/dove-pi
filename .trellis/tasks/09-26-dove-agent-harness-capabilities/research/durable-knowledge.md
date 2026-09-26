# Research: durable project knowledge across sessions (how harnesses accumulate it)

- **Query / Scope.** How harnesses accumulate *durable project knowledge* across sessions - as distinct
  from resuming a single run. Mechanisms (memory files, CLAUDE.md hierarchy, Cursor rules, Copilot
  instruction files, Kiro steering, ADRs, code knowledge graphs, `spec/` directories), the retrieval
  problem (what loads per task, measured rather than asserted), decay and contradiction (invalidation of
  stored beliefs), the ETH Zurich AGENTbench negative result read in full, the agent-memory research
  literature with effect sizes, and the write problem (who is allowed to write durable knowledge).
- **Date.** 2026-09-26. All retrievals on this date.
- **Read first, deliberately not repeated:** `research/harness-gates-and-conventions.md`,
  `design-constraints-from-evidence.md`, `two-layers-and-the-seam.md`, `synthesis-two-layers-vs-frontier.md`,
  `cross-cutting-finding.md`, `prd.md`. Those cover: the AGENTS.md/CLAUDE.md/Cursor/Copilot/Kiro *format and
  precedence* question (B1-B4 there), the ETH headline numbers as search snippets, and the local `spec/`
  budget test. This file is what was missing: retrieval, invalidation, the paper's actual measurements, the
  literature's effect sizes, and who writes.
- **Fetch methods that worked** (recorded per the brief):
  - `raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>` - primary method for every source read. Reliable;
    occasional transient `fetch failed`, retried 3-4x with backoff (~15% first-attempt failure rate).
  - `cdn.jsdelivr.net/gh/<owner>/<repo>@<ref>/<path>` - verified working mirror (byte-identical to raw at
    the same ref for `aider/repomap.py`).
  - `ungh.cc/repos/<owner>/<repo>` - metadata (`stars`, `pushedAt`, `defaultBranch`, `forks`); **no licence
    field**. `ungh.cc/repos/<o>/<r>/files/<branch>` - full file list, used to find files by name.
    Rate-limits under parallel load; serialise with ~400 ms spacing.
  - `img.shields.io/github/stars|license|last-commit/<o>/<r>.json` - worked; used for licence and as a star
    cross-check.
  - **Doc sites serve clean markdown at `<url>.md`** - confirmed on `code.claude.com/docs/en/*.md`,
    `cursor.com/docs/*.md`, `kiro.dev/docs/*.md`. Each vendor also publishes an `llms.txt` index; the Cursor
    and Kiro indexes list each page's `.md` twin explicitly.
  - `arxiv.org/abs/<id>` and `arxiv.org/html/<id>v1` - both reachable; the HTML full text is what let me read
    AGENTbench properly instead of a snippet.
  - `api.github.com/search/repositories` - worked (2 calls spent: GitNexus, abcoder).
  - **Blocked / unusable:** `docs.claude.com` and `platform.claude.com` (both serve an "App unavailable in
    region" Webflow page for every path, including `/.../memory-tool.md`). Worked around by reading the
    **Anthropic Python SDK type definitions** on GitHub instead - stronger evidence than the docs page.
    `research.trychroma.com` is JS-rendered but the report text is in the HTML payload. One GitNexus
    `README.md` fetch failed 4x.

## Repository metadata read (owner/name, stars, last push, licence, files read)

| Repo | stars | last push | licence | Files read this session |
|---|---|---|---|---|
| `Aider-AI/aider` | 49,203 | 2026-05-22 | Apache-2.0 | `aider/repomap.py` (full, 691 lines), `aider/coders/base_coder.py` (grep + 598-670, 2244-2300), `aider/website/_posts/2023-10-22-repomap.md` |
| `google-gemini/gemini-cli` | 107,164 | 2026-09-26 | Apache-2.0 | `docs/cli/auto-memory.md` (full), `packages/core/src/tools/memoryTool.ts` (full), `packages/core/src/utils/memoryDiscovery.ts` (partial), `packages/core/src/services/memoryService.ts` (grepped, 45 KB), `packages/core/src/services/memoryPatchUtils.ts` (partial), full file list (3,018 paths) |
| `modelcontextprotocol/servers` | 90,605 | 2026-09-22 | not identifiable by GitHub | `src/memory/index.ts` (grepped + sections, 25 KB), `src/memory/README.md` (head only) |
| `anthropics/anthropic-sdk-python` | 3,922 | 2026-09-22 | MIT | `src/anthropic/types/beta/beta_clear_tool_uses_20250919_edit_param.py`, `..._compact_20260112_edit_param.py`, `..._tool_uses_keep_param.py`, `..._input_tokens_clear_at_least_param.py`, `..._memory_tool_20250818_param.py`, `..._context_management_config_param.py` (all full) |
| `adr/madr` | 2,518 | 2026-08-28 (branch `develop`) | not identifiable by GitHub | `template/adr-template.md` (full), `README.md` |
| `npryce/adr-tools` | 5,710 | 2024-04-25 | not identifiable by GitHub | **none** - `src/adr-supersede` and `src/adr-generate` both 404'd; file listing returned empty |
| `abhigyanpatwari/GitNexus` | 47,586 | 2026-09-26 | NOASSERTION | `.claude/skills/gitnexus-plan/references/context-pack.md` (full), `.../context-ledger.md` (full); `README.md` unreachable |
| `anthropics/claude-code` | 148,166 | 2026-09-26 | no licence specified | **no source read** - closed source. Docs at `code.claude.com/docs/en/*.md`: `memory.md` (full, 53 KB), `context-window.md` (full, 62 KB) |
| `agentsmd/agents.md` | 24,619 | 2026-09-10 | MIT | not re-read (covered by prior research) |
| `cloudwego/abcoder` | 391 | 2026-08-31 | Apache-2.0 | **none** - found by API search only |
| `tintinweb/pi-gitnexus` | 208 | 2026-06-23 | MIT | **none** - found by API search only |

Closed-source and therefore documentation-only throughout this file: Claude Code (auto memory, compaction),
Cursor (rules; no memories page exists in its docs index), Kiro (steering), Copilot (instruction files).

---

## What the sources state

### The mechanisms: every product has quietly added a second, narrower tier

The four always-on mechanisms (CLAUDE.md hierarchy, Cursor rules, Copilot instructions, Kiro steering) were
compared for *format and precedence* in `harness-gates-and-conventions.md` and are not repeated here. What
matters for durable knowledge is that each has a second tier with different loading rules, and the tiers exist
because always-on files do not scale:

- **Claude Code** (`code.claude.com/docs/en/memory.md`, documentation-only). Two mechanisms:
  - *CLAUDE.md files* - "instructions **you** write". Load order documented as a table from managed policy ->
    user -> project -> local; **all discovered files are concatenated rather than overriding each other**,
    ordered filesystem root down to the working directory; subdirectory CLAUDE.md files load when Claude reads
    files in that directory, not at launch; `@path` imports are expanded **at launch** ("Imported files are
    expanded and loaded into context at launch alongside the CLAUDE.md that references them") - so imports
    organise but do not save context.
  - *Auto memory* - "notes **Claude writes itself** based on your corrections and preferences". Four typed
    kinds in frontmatter: `user`, `feedback`, `project`, `reference`. Stored per git repository at
    `~/.claude/projects/<project>/memory/`, shared across worktrees, **machine-local**, and excluded from the
    transcript retention sweep. Layout is a `MEMORY.md` **index** ("one line per memory, loaded into every
    session") plus one topic file per memory. **The first 200 lines or 25 KB of `MEMORY.md`, whichever comes
    first, load at the start of every conversation; topic files are not loaded at startup and are read on
    demand with standard file tools.**
  - *Rules* - `.claude/rules/*.md`, discovered recursively; without `paths:` frontmatter they load at launch
    "with the same priority as `.claude/CLAUDE.md`"; with `paths:` they load **when Claude reads a matching
    file**, "not on every tool use".
- **Cursor** (`cursor.com/docs/rules.md`, closed source). Four kinds (Project `.cursor/rules/*.mdc`, User,
  Team, AGENTS.md) and three activation modes: `Always Apply`, `Apply to Specific Files` (globs),
  `Apply Intelligently` ("When Agent decides it's relevant based on description"). Team Rules are the only
  vendored *enforced* rule layer ("Enforce this rule" makes it non-toggleable) - with Cursor's own caveat:
  "AI guidance should not be your only security control."
- **Kiro** (`kiro.dev/docs/steering.md`, closed source, re-confirmed): `inclusion: always` (default) /
  `fileMatch` + `fileMatchPattern` / `manual`; AGENTS.md "do not support inclusion modes and are always
  included".
- **Gemini CLI** (`docs/cli/auto-memory.md`, `utils/memoryDiscovery.ts`, Apache-2.0 - **the only one of these
  I could read as source**): hierarchical `GEMINI.md` discovery with deduplication by **device+inode** rather
  than by path, a project memory directory with its own `MEMORY.md` index, and an import processor with depth
  and cycle handling.

The industry's answer to "always-on files do not scale" is the same in all four and in this repository: **an
index that is always loaded, and bodies pulled on demand keyed by path glob, by description, or by hand.**

### The write problem: five non-equivalent answers

1. **Human writes** - CLAUDE.md, AGENTS.md, most Cursor rules, ADRs. Best-measured band, lowest throughput.
2. **Agent writes directly, no review** - Claude Code auto memory; Cursor's `/create-rule` ("Agent generates
   the rule file with proper frontmatter and saves it to `.cursor/rules`"); the `/init` generation commands
   that Codex, Qwen Code and Claude Code all ship (AGENTbench `2 lists them as the recommended path).
3. **Agent proposes, human commits** - **Gemini CLI Auto Memory** is the clearest implementation found
   anywhere. Background extraction over *past idle* sessions (>= 10 user messages, >= 3 h idle, sub-agent
   sessions ignored, one run at a time via a project lock file and a processed-version state file); candidates
   are written as **unified-diff `.patch` files and `SKILL.md` drafts into a project-local inbox**; "**Auto
   Memory writes candidates to a review inbox. It cannot directly edit active memory files, settings,
   credentials, or project `GEMINI.md` files**"; patches are "parsed, target-allowlisted, and applied
   atomically **only when you approve them**"; the extractor "**defaults to creating no artifacts unless the
   evidence is strong**, so many runs produce no inbox items"; `/memory inbox` promotes, applies or discards.
   Source confirms the last line: "Anything still in `.inbox/` is reviewable; **nothing is auto-applied**"
   (`memoryService.ts`).
4. **Agent writes, harness bounds the write** - Claude Code auto memory (details in "What I read in code").
5. **Model writes, protocol has no opinion** - the MCP reference memory server: `create_entities`,
   `create_relations`, `add_observations`, plus `delete_*` tools, into a JSONL file, with **no timestamp and
   no provenance field in the schema** (`Entity{name,entityType,observations[]}`,
   `Relation{from,to,relationType}`), so a later reader cannot tell when a belief was written or where it came
   from.

### The retrieval problem: what actually decides what loads

Measured or implemented - none of these is "we use RAG":

- **Aider's repo map** (`repomap.py`, read in full - the most explicit retrieval algorithm found in any
  coding harness). tree-sitter tags per file -> a def/ref graph -> `networkx.pagerank` with **personalization
  weights seeded from the files currently in the chat** -> ranked definitions -> rendered to fit a token
  budget by searching how many tags fit. Retrieval is **not** semantic search: it is graph centrality seeded
  by the task's working set, truncated to a budget.
- **Claude Code**: four different load triggers - file read (`paths:` rules), directory read (nested
  CLAUDE.md), invocation (skills), delegation (subagents, which get a fresh window and none of the main
  conversation's auto memory). The `InstructionsLoaded` hook logs "which `CLAUDE.md` and rules files are
  loaded, when they load, and why"; `/context` lists loaded memory files. This is the only vendor mechanism
  found that makes the loading *decision* observable after the fact.
- **This repository**: per-task `implement.jsonl` / `check.jsonl` manifests, one row per file as
  `{"file": "...", "reason": "..."}` - a hand-curated per-task retrieval list **with a stated reason** - plus
  hook-push and agent-pull modes, and `context_injection.max_total_bytes` (default 131,072) capping the
  payload.
- **GitNexus**: retrieval for the executor is an emitted artefact, not a search - the "implementation context
  pack" carries `primary_symbols`, `related_symbols`, `execution_path`, `files_to_modify`, `tests`,
  `verification_commands`, and `pdg_constraints` "only when a slice actually ran".
- **ETH measured the retrieval hypothesis and it failed**: AGENTbench measured "the average number of steps
  before the coding agent interacts with any file modified in the original PR patch", and found "**the
  presence of context files does not meaningfully reduce this metric**" on either dataset, concluding that
  context files "even developer-provided ones, are not effective at providing a repository overview."

### Decay and contradiction

In ascending order of strength:

- Cursor, a *stated* mitigation: "**Reference files instead of copying their contents - this keeps rules short
  and prevents them from becoming stale as code changes.**" A belief that is a pointer cannot go stale about
  content, only about existence.
- Anthropic, a duty on the human: "if two rules contradict each other, Claude may pick one arbitrarily";
  "Review your CLAUDE.md files ... periodically to remove outdated or conflicting instructions";
  `claudeMdExcludes` as the monorepo escape hatch. Copilot, likewise: "Whenever possible, avoid providing
  conflicting sets of instructions." (prior research)
- MADR (`template/adr-template.md`): the invalidation field is typed - `status: "{proposed | rejected |
  accepted | deprecated | ... | superseded by ADR-0123}"`, and `date` is "when the decision was **last
  updated**". An ADR is not edited to say something else; it is superseded, leaving a chain a reader can
  follow. **The same template carries a `## Confirmation` section**: "Describe how the implementation /
  compliance of the ADR can/will be confirmed. Is there any automated or manual fitness function?"
- MCP memory server: deletion is a *model action* (`delete_observations`, `delete_entities`,
  `delete_relations`); nothing invalidates automatically and nothing records when a fact was written.

### The AGENTbench paper, read properly

Gloaguen, Mundler, Muller (LogicStar.ai), Raychev, Vechev - *Evaluating AGENTS.md: Are Repository-Level
Context Files Helpful for Coding Agents?*, arXiv:2602.11988v1 [cs.SE], 12 Feb 2026, CC BY 4.0, **preprint**,
ETH Zurich Department of Computer Science. Read from `arxiv.org/html/2602.11988v1` (full text).

**What was measured.** *Success rate* = fraction of instances where the agent's patch makes a test suite pass.
Benchmark AGENTbench: 138 instances mined from 5,694 PRs across **12 niche Python repositories that already
contained a developer-written context file**. Task descriptions were LLM-standardised from PR + issue + golden
patch (10% hand-checked for solution leakage, none found); **unit tests were LLM-generated** and hand-repaired
where over-specified; the resulting tests cover 75% (mean) of modified code. Three settings: **None**, **LLM**
(context file generated with each agent's own recommended init command/model against the pre-patch tree),
**Human** (the repo's committed file). Each agent evaluated **only in its own harness**: Claude Code +
Sonnet-4.5 (temperature 0), Codex + GPT-5.2 and GPT-5.1-mini (temperature 0), Qwen Code + Qwen3-30B-coder.
One sample per instance. Also run on SWE-bench Lite (300 tasks, 11 popular repos, none with developer context
files). Context-file statistics (Table 1): **mean 641 words / 9.7 sections; min 24 words; max 2,003 words**.

**What it found, as stated.**

- Abstract: "developer-provided files only marginally improve performance ... (**an increase of 4% on
  average**), while LLM-generated context files have a small negative effect ... (**a decrease of 3% on
  average**)", and cost "over 20%".
- Section 4.2: "LLM-generated context files cause performance drops in **5 out of 8 settings** ... the
  average resolution rate is reduced by **0.5% and 2%** on average on SWE-bench Lite and AGENTbench,
  respectively", while steps rise by 2.45 and 3.92 and **cost by 20% and 23%**.
- Human files "improve the performance compared to no context files **for all agents but Claude Code**";
  steps +3.34 on average and cost "at most 19%".
- Reasoning tokens (GPT-5.2 / GPT-5.1-mini): LLM files +22% / +14% on SWE-bench Lite, +14% / +10% on
  AGENTbench; human files +20% / +2%.
- **The behavioural result that matters most here**: "**coding agents tend to respect their instructions**" -
  `uv` is used 1.6x per instance when named in the context file vs fewer than 0.01x when not; repo-specific
  tools 2.5x vs fewer than 0.05x. "This implies that the absence of improvements with context files is **not
  due to a lack of instruction-following**."
- **The redundancy experiment (Figure 5)**: after removing all documentation (files ending `.md`, example
  code, the `docs/` folder) and regenerating, "LLM-generated context files not only consistently improve
  performance by **2.7% on average**, but also **outperform developer-written documentation**". The authors
  suggest this explains anecdotal reports of improvement, "since many less popular repositories contain little
  to no documentation".
- Ablations: a stronger generator model (GPT-5.2 instead of the agent's own) improved SWE-bench Lite (+2%)
  but **degraded** AGENTbench (-3%); swapping generator prompts (Codex vs Claude Code) had no consistent
  effect.
- Conclusion: "context files have only marginal effect on agent behavior, and are likely only desirable when
  manually written"; recommendation "**including only minimal requirements** (e.g., specific tooling to use
  with this repository)".

**What it does NOT show** (the part the headline hides):

- It does not show machine-written knowledge is harmful in general. It shows that *a prose repository summary
  generated by the agent itself, on top of documentation that already exists*, is a net negative for
  **issue-resolution success on Python tasks**.
- It does not measure convention adherence, security, style, review quality or maintainability - Section 5
  says so ("Context files beyond task resolution").
- It does not test durable knowledge that is *not* the agent's own summary: no experiment on path-scoped
  rules, on pointers, on verified post-mortems, or on knowledge induced from *successful* trajectories
  (contrast AWM below).
- Python-only, and the paper flags that models' strong parametric knowledge of Python may nullify the effect
  of repository specifics.
- The benchmark is LLM-generated in two places (task descriptions, tests); mitigated by hand-sampling, not by
  independent annotation.
- Absolute resolution rates live only in Figure 3's bar charts; I could not extract them from the HTML text,
  and the abstract's "-3%" does not reconcile with Section 4.2's "-0.5% / -2%" in prose. **Treat the effect as
  small and near zero, not "minus 3 points".**

### The memory literature, with the effect sizes it actually reports

| Paper | Reported result | What it is / caveats |
|---|---|---|
| **Agent Workflow Memory**, arXiv:2409.07429 | **+24.6% and +51.1% relative** success on Mind2Web and WebArena, fewer steps; **+8.9 to +14.0 absolute points** as train-test distribution gaps widen | The strongest positive for *agent-written* durable knowledge: workflows induced from **past successful trajectories** and **selectively provided** per query. Web navigation, not code. |
| **ExpeL**, arXiv:2308.10144 (AAAI-24) | "a consistent enhancement in its performance as it accumulates experiences" - **no number in the abstract** | An example of claims outrunning the abstract's evidence. |
| **Mem0**, arXiv:2504.19413 | **26% relative** improvement over OpenAI memory on LOCOMO (LLM-as-judge); graph variant ~2% higher; **91% lower p95 latency, >90% token savings** | Self-authored benchmark, judge metric, vendor paper. Not task success. |
| **Zep/Graphiti**, arXiv:2501.13956 | **DMR 94.8% vs MemGPT 93.4%** (a **1.4-point** margin); "up to 18.5%" on LongMemEval; 90% latency reduction | Self-evaluation on the competitor's benchmark (DMR is essentially deep memory retrieval). Temporal knowledge graph with historical relationships. |
| **LongMemEval**, arXiv:2410.10813 (ICLR'25) | Commercial chat assistants and long-context LLMs show a **30% accuracy drop** memorising information across sustained interactions; the paper's own gains come from **indexing/retrieval design** (session decomposition, fact-augmented keys, time-aware query expansion) | The most useful benchmark-scale negative: bigger windows and memory features do not fix cross-session recall. |
| **LoCoMo**, arXiv:2402.17753 | Long-context LLMs and RAG "offer improvements but these models still **substantially lag behind human performance**" | 300 turns / 9K tokens / up to 35 sessions, human-verified. |
| **Generative Agents**, arXiv:2304.03442 | Retrieval score = recency + importance + relevance; ablation: observation, planning and reflection "each contribute critically" | Believability rated by humans, not task success; **no effect size in the abstract**. |
| **MemoryBank**, arXiv:2305.10250 | Forgetting inspired by the **Ebbinghaus forgetting curve** - decay by elapsed time and relative significance | The only design found that *decays* memory explicitly. Evaluation qualitative + simulated dialogs; no effect size. |
| **MemGPT**, arXiv:2310.08560 | Virtual context management with self-editing memory tiers; no headline effect size in the abstract | System paper. |
| **CoALA**, arXiv:2309.02427 | Taxonomy: working / episodic / semantic / procedural memory, structured action space | No measurement. |
| **Lost in the Middle**, arXiv:2307.03172 (TACL) | Performance highest when relevant information is at the **beginning or end**; "significantly degrades" in the middle, "even for explicitly long-context models" | Position, not size. |
| **Context Rot**, Chroma technical report, 14 Jul 2025 | 18 models (GPT-4.1, Claude 4, Gemini 2.5, Qwen3, ...); performance degrades **as input length grows** while task complexity is held constant, on tasks as trivial as repeating words | **Vendor report (vector-database vendor), so "use retrieval" is in its commercial interest**; the design (vary length, fix difficulty) is the valuable part. It notes NIAH overstates ability and cites NoLiMa for large drops with non-lexical matches. |

**Where the field's claims outrun its evidence**: almost every positive number above is (a) about
*conversational* recall rather than a coding harness's project knowledge; (b) judged by an LLM on a benchmark
the system's own authors authored or chose; and (c) reported as a *relative* gain on a small base. The one
study that measures the thing this project cares about - does durable project knowledge make a coding agent
solve repository tasks more often - is **negative for the machine-written case and ~zero for the human-written
case**.

---

## What I read in code

Everything below is source read this session, at the named paths. [CODE] = code read; [DOC] = vendor
documentation (closed source, documentation-only).

### 1. Aider: retrieval as a budgeted, task-personalised graph slice - and no durable summary at all

`aider/repomap.py` (691 lines). [CODE]
- `get_ranked_tags(fnames, mentioned_fnames, mentioned_idents)` builds a definition/reference graph over
  tree-sitter tags and runs `nx.pagerank(G, weight="weight", **pers_args)` with
  `personalize = 100 / len(fnames)` (lines 382-386) applied to the **chat file names** - the working set *is*
  the query. Rank is then distributed across out-edges to score definitions (lines 533-572), so what surfaces
  is "definitions this task's files actually use".
- `max_map_tokens` (default `map_tokens=1024`, line 49) bounds the map; the renderer searches for how many
  ranked tags fit (`get_ranked_tags_map_uncached`, lines 629-700, `middle = min(int(max_map_tokens // 25),
  num_tags)` and a ~5% acceptance error). Actual size is reported to the user:
  `Repo-map: {num_tokens / 1024:.1f} k-tokens` (lines 152-153).
- **Invalidation is mtime-keyed at the tag level.** `get_tags()` compares `os.path.getmtime(fname)` against
  the cached value and re-parses only on change (lines 227-262); the cache lives in
  `.aider.tags.cache.v{CACHE_VERSION}` (line 43) - a versioned directory, so a schema change invalidates the
  whole cache by construction. `to_tree()` keys its cache on `(rel_fname, lines-of-interest, mtime)`
  (lines 708-745). Refresh policy is explicit: `--map-refresh` auto / files / manual / always, with `auto`
  recomputing only when a previous build took more than 1.0 s (lines 592-613).

`aider/coders/base_coder.py`. [CODE] **Aider stores no belief about file contents.** `get_abs_fnames_content()`
re-reads every in-chat file from disk on **every turn** and, if the read returns `None`, prints
"Dropping {file} from the chat" and removes it from the set (lines 598-607). Nothing needs invalidating
because nothing is remembered. The only guard against too much context is a *measured* heuristic:
`check_added_files()` warns only when **>= 4 files AND >= 20*1024 tokens** are in the chat - "Warning: it's
best to only add files that need changes to the chat" (lines 2244-2266).
The published repo-map post marks the honest boundary: the artefact is derived from source on every run and
never written down, and "automatically identify which parts of the code will need changes" is listed as
**future work** (`aider/website/_posts/2023-10-22-repomap.md`). I looked for a quantitative repo-map ablation
in the post and in `docs/` and **found none**.

### 2. Claude Code: auto memory as index + pull-able topic files, with a harness-owned write bound

[DOC] `code.claude.com/docs/en/memory.md`, read in full. The load-bearing text:
- "The first 200 lines of `MEMORY.md`, or the first 25KB, whichever comes first, are loaded at the start of
  every conversation. Content beyond that threshold is not loaded at session start."
- "After Claude writes to `MEMORY.md`, Claude Code measures the file against the 200-line and 25KB read
  limits. If the file is near a limit, Claude Code reminds Claude to shorten it: keep one line per entry,
  move detail into topic files, and merge or drop stale entries. **If the file is over a limit, the write
  still succeeds, but Claude Code returns an error telling Claude to rewrite the index, because everything
  past the limit is dropped on the next load.**"
- "When Claude writes a memory file that begins with YAML frontmatter, **Claude Code records the write time in
  a `modified` frontmatter field** as an ISO 8601 timestamp. The timestamp shows how current the fact is,
  **both to you and to Claude when it reads the memory back.**" The harness, not the model, timestamps the
  belief, and the model sees its age on recall.
- "Claude Code doesn't load topic files such as `user_role.md` ... at startup. Claude reads them on demand
  using its standard file tools when it needs the information."
- "Claude skips anything it can derive from the codebase, such as architecture, file paths, or debugging
  fixes. It also skips anything your CLAUDE.md files already say."
- Subagents: "The main conversation's auto memory isn't loaded into subagents ... A subagent's own auto
  memory, enabled with the subagent `memory` field, is a separate directory."
- Size discipline on humans too: "target **under 200 lines** per CLAUDE.md file. Longer files consume more
  context and **reduce adherence**"; a file over 4 MiB is skipped; a startup and `/status` warning fires when
  one file exceeds the recommendation **or when several within-length files together exceed a combined
  limit**; and **`/doctor` "proposes trims for a checked-in CLAUDE.md: it cuts content Claude can derive from
  the codebase, such as directory layouts, dependency lists, and architecture overviews, and keeps pitfalls,
  rationale, and conventions that differ from tool defaults."** That sentence is the product-level form of the
  AGENTbench finding.
- Dead-file hazard, documented first-party: "**Not read**: `AGENTS.local.md`, `AGENTS.override.md`, or anything
  under a `.agents/` directory"; Claude reads `AGENTS.md` only when there is no CLAUDE.md in the working
  directory or above it.
- Contradiction has no mechanism, only advice: "if two rules contradict each other, Claude may pick one
  arbitrarily"; review periodically.

[DOC] `code.claude.com/docs/en/context-window.md`, "What survives compaction":

| Mechanism | After compaction |
|---|---|
| Project-root CLAUDE.md and unscoped rules | **Re-injected from disk** |
| Auto memory | **Re-injected from disk** |
| Git status snapshot | **"Claude Code reads a fresh one from your repository"** |
| Plan written in plan mode | Re-injected from disk |
| Rules with `paths:` frontmatter | Reloaded **as Claude reads files they match** |
| Nested CLAUDE.md in subdirectories | Reloaded as Claude reads files in that subdirectory |
| Files Claude read or edited | **"Claude Code re-reads up to five, most recently modified first"** |
| Invoked skill bodies | Re-injected, capped at 5,000 tokens/skill and 25,000 total; oldest dropped first |
| Background commands and subagents | Keep running; Claude is reminded "so it doesn't start a duplicate" |
| Context that hooks added earlier | Summarized with the rest of the conversation |

Underneath it: "Right after compaction, Claude Code re-reads up to five of the files Claude has read or
edited in the session, choosing the ones modified most recently. **A file over 5,000 tokens comes back as a
path reference without its content.**" Plus the documented decay mode and its fix: "Path-scoped rules and
nested CLAUDE.md files load into message history when their trigger file is read, **so compaction summarizes
them away with everything else. If a rule must persist across compaction, drop the `paths:` frontmatter or
move it to the project-root CLAUDE.md.**" Skills likewise: "Truncation keeps the start of the file, so put the
most important instructions near the top of `SKILL.md`."

### 3. Anthropic API: derived beliefs are cleared on a schedule, and compaction can pause for review

[CODE] `anthropics/anthropic-sdk-python`, `src/anthropic/types/beta/`:
- `beta_context_management_config_param.py` - the edits are a typed union:
  `clear_tool_uses_20250919 | clear_thinking_20251015 | compact_20260112`. This is the API-level
  implementation of "delete the derived belief and force re-derivation": it operates on **tool results**, not
  on turns.
- `beta_clear_tool_uses_20250919_edit_param.py` - `keep: {type: "tool_uses", value: N}` ("Number of tool uses
  to retain in the conversation"), `clear_at_least: {type: "input_tokens", value: N}` ("Context will only be
  modified if at least this many tokens can be removed"), `clear_tool_inputs: bool | list`, `exclude_tools`,
  `trigger`. Keep the newest N; only clear when it buys something; never clear named tools.
- `beta_compact_20260112_edit_param.py` - `trigger` "Defaults to **150000 input tokens**", `instructions` for
  the summariser, and **`pause_after_compaction: bool` - "Whether to pause after compaction and return the
  compaction block to the user."** A derived belief (the summary) can be handed back for review rather than
  trusted silently. This is the only API-level *review step on machine-written knowledge* found.
- `beta_memory_tool_20250818_param.py` - the memory tool is an ordinary tool with `defer_loading` ("If true,
  tool will not be included in initial system prompt") and `allowed_callers` - harness-controlled, and not
  loaded unless something asks for it.

### 4. Gemini CLI Auto Memory: the review-step design, in source

[CODE] `packages/core/src/services/memoryService.ts` (45 KB, grepped), `memoryPatchUtils.ts`,
`tools/memoryTool.ts`, `utils/memoryDiscovery.ts`; [DOC] `docs/cli/auto-memory.md`.
- `memoryTool.ts` exports `PROJECT_MEMORY_INDEX_FILENAME = 'MEMORY.md'` and `getProjectMemoryIndexFilePath` -
  the same index-plus-topic-files shape as Claude Code, arrived at independently.
- `memoryService.ts:1371`: `// Anything still in .inbox/ is reviewable; nothing is auto-applied.`
- Validation before surfacing (`validatePatches`, lines 856-918): dry-run apply; named rejections -
  `missing target file path in patch header`, `target file is outside skill roots`, `new file target already
  exists`, `target file not found`, **`patch does not apply cleanly`**.
- `memoryPatchUtils.ts`: allowed roots resolved with `fs.realpath` over existing ancestors and compared with
  `isSubpath` (symlink-escape defence); `GIT_DIFF_PREFIX_RE` strips `a/`/`b/` prefixes so LLM-formatted patches
  still validate, and logs a warning "so we can track LLM formatting issues".
- `memoryDiscovery.ts`: `deduplicatePathsByFileIdentity` - "Deduplicates file paths by **file identity
  (device + inode)** rather than string path ... necessary on case-insensitive filesystems where different
  case variants of the same filename resolve to the same physical file". Plus `findProjectRoot` with a `.git`
  boundary marker and a path-traversal guard on configured filenames.

**The invalidation mechanism is the patch itself**: a candidate belief is stored as a diff against the file as
it was, and is applied only if it still applies cleanly against the file as it is. A belief whose subject
changed is dropped, with a named reason.

### 5. MCP reference memory server: a knowledge graph with no time and no provenance

[CODE] `src/memory/index.ts` (~730 lines, grepped; `README.md` head only). Schema as implemented:
`Entity{name, entityType, observations[]}`, `Relation{from, to, relationType}`; storage is a JSONL file
(default `memory.jsonl` beside the server, overridable), loaded fully per operation and written back
atomically (temp file + `rename`, with an explicit comment that `writeFile` would truncate; lines 178-196).
Tool surface: `create_entities`, `create_relations`, `add_observations`, `delete_entities`,
`delete_observations`, `delete_relations`, `search_nodes` ("Very basic search function" - lowercase substring
over name, type and observations), `read_graph`, and a resource returning the whole graph. Multi-client safety
is a comment, not a design: lines 91-93 explain that two clients would otherwise "independently load the
graph, mutate their own [copy], and overwrite the other's changes". **No timestamp, no source/provenance, no
confidence, no invalidation, no size bound.** As a reference implementation it is a competent answer to the
*format* question and a non-answer to every question this research was asked.

### 6. GitNexus: a context pack that names its commit and digests every cited path

[CODE] `abhigyanpatwari/GitNexus`, `.claude/skills/gitnexus-plan/references/context-pack.md` and
`context-ledger.md`. This is the strongest invalidation design found in the survey.
- The artefact is an "implementation context pack", consumed by a follow-up executor "to start work **without
  repeating the investigation**". Fields: `task_summary`, `acceptance_criteria`, `evidence_provenance`,
  `primary_symbols`, `related_symbols`, `execution_path`, `pdg_constraints`, `architectural_patterns`,
  `files_to_modify`, `tests`, `verification_commands`, `risks`, `assumptions`, `open_questions`, `avoid`.
- **Provenance is mandatory** and is a versioned snapshot: `head_commit` ("full commit SHA that source
  citations pin to"), `global_dirty_digest` (SHA-256 over NUL-framed records for **every** dirty path, states
  `clean|staged|unstaged|untracked|deleted|renamed|mixed`), and a sorted `cited_path_manifest` carrying
  `head_digest`, `index_digest`, `worktree_digest`, `untracked_digest` and an `object_kind` per layer
  (regular | symlink | gitlink | directory | absent) - with "**never confuse an absent layer with an empty
  file**" and "if a cited path cannot be classified or read, the plan must mark the evidence unavailable
  instead of emitting a digest it did not prove."
- **Unknown provenance fails closed**: "Legacy packs that lack it or use schema 1 require a conservative
  schema-2 re-anchor; **they are not interpreted as a clean tree.**"
- **It has an explicit content budget** - a "Must not contain" list: "full files; the repository-wide raw
  dirty-path manifest ...; large raw GitNexus responses; unfiltered PDG dumps; duplicate code excerpts (cite
  `file:line`, don't re-quote); speculative implementation details presented as facts."
- **Beliefs carry their own re-verification procedure**: "`assumptions` ... each entry names **WHAT to check
  and HOW** - gitnexus-work re-verifies them before executing"; `avoid` entries are "hard constraints",
  including "Do not repeat full repository discovery".
- `context-ledger.md` is the scratch tier: "the ledger is gitnexus-plan's working memory ... **before every
  GitNexus call and every repo file read, check it**"; it is "never published verbatim"; `symbols` carry a
  `source_verified` flag "flipped in Phase 4; required before naming in Proposed Changes"; and the ledger
  tracks an `index_refresh` budget ("one refresh plus at most one Phase 3 --pdg upgrade per session").

Caveat: GitNexus's README was unreachable, so I read its skill reference documents, not its engine. The claim
that it builds a code knowledge graph rests on its repo description ("The Zero-Server Code Intelligence
Engine" - its own marketing line), its file tree (`gitnexus-pdg-query`, `gitnexus-taint-analysis` skills), and
nothing I executed.

### 7. This repository: three tiers with a promotion rule, and budgets enforced by tests

Files read: `.agents/skills/trellis-meta/references/local-architecture/context-injection.md`,
`.../workspace-memory.md`, `.agents/skills/trellis-update-spec/SKILL.md`, `.trellis/config.yaml`,
`.trellis/scripts/common/task_context.py`, `tests/spec-context-budget.test.ts`,
`.trellis/spec/backend/index.md`, `.trellis/spec/guides/index.md`.
- **Three tiers with an explicit promotion rule** (`workspace-memory.md`): tasks (this task only) / journal
  (what happened this session) / spec ("if information should be followed every time code is written in the
  future, put it in spec"). Journal rotates at `max_journal_lines: 2000` (`config.yaml:15`).
- **Budgets are enforced, not advised** - `tests/spec-context-budget.test.ts`: the runtime router must be
  **<= 8,192 bytes** and each routed spec **<= 24,576 bytes**, measured as `\r\n`-normalised UTF-8 bytes
  (with a test that the *measurement* is line-ending-independent); the router must contain **only** routing
  structure (exact `##` heading list, **no `###` headings, no code fences**); and every routed spec's complete
  `##` heading inventory is asserted **exactly**, so adding a contract section without updating the test
  fails. This is the only place in the whole survey where the *shape* of a durable knowledge document is a
  test.
- **The injection budget degrades instead of truncating blindly** (`config.yaml:133-146`,
  `task_context.py:281-288`): `context_injection.max_total_bytes` default 131,072 and `max_file_bytes`;
  "Oversized files are truncated with a notice; **once the total payload cap is reached, remaining files
  degrade to index lines (path + reason + size) instead of being inlined**"; the JSONL validator emits a
  non-blocking warning for an over-size entry and for entries that "look like code files rather than
  spec/research docs".
- **The retrieval list is curated per task with a stated reason**: `{"file": ".trellis/spec/backend/index.md",
  "reason": "Backend rules"}` in `implement.jsonl` / `check.jsonl`, with hook-push and agent-pull modes, and
  the instruction to include only spec/research files - "**not pre-register code files that will be
  modified**".
- **Writes go through named triggers, not background inference**: `trellis-update-spec` is invoked "after
  completing a task, fixing a bug, or discovering a new pattern" and forces a classification decision - "how
  to **write** the code" -> spec layer; "what to **consider** before writing" -> guide. Its seven-section
  mandatory template (Scope/Trigger, Signatures, Contracts, Validation & Error Matrix, Good/Base/Bad Cases,
  Tests Required, Wrong vs Correct) is the strongest write-side discipline found in this survey.
- **Accumulated, quantified experience lives in a guide**: `spec/guides/index.md` contains "**Budget ~35%
  false-positive rate for AI reviews**" plus three named false-positive patterns - a number produced by this
  project's own error-recording loop, stored where the agent reads it before reviewing. That is exactly the
  shape ETH says is worth keeping: measured, non-derivable, task-relevant, and not a repository overview.

### 8. What nobody has: contradiction and staleness detection

Across every product read, the answer to "two durable rules disagree" and "this rule's subject changed" is a
human reviewing periodically - plus, in Claude Code, an `InstructionsLoaded` logging hook, a `/context`
listing and a `/doctor` trim proposal. No product found *detects* a stale rule, a rule whose referenced path
no longer exists, or two rules in contradiction. Cursor's advice ("reference files instead of copying")
prevents one failure class by construction; GitNexus's digests detect drift in the evidence a plan was built
from; Gemini's patch validation drops a belief that no longer applies. Those three are the entire mechanism
inventory. Everything else is prose telling the human to be careful.

---

## What is transferable to a harness

**T1. Separate the always-loaded index from the pulled bodies, and make the index the only sized thing.**
Implementations: Claude Code `MEMORY.md` (200 lines / 25 KB) + topic files on demand; Gemini CLI's
`MEMORY.md` index + topic files; GitNexus's context pack emitted for the executor while the ledger is never
published; this repo's `spec/` router (<= 8 KiB, routing structure only) over routed specs. The rule to take:
**the index is a load table, not a summary** - enforced by test here, which is stronger than either vendor.

**T2. Refer, do not copy - then the belief cannot rot, only the pointer can.** Cursor states it; GitNexus
enforces it with a "must not contain" list ("cite `file:line`, don't re-quote"); Claude Code's `/doctor` trim
does it retroactively. Cheapest invalidation strategy that exists, and every product that mentions staleness
arrives at it independently.

**T3. Store the commit and the digests alongside any fact derived from code.** GitNexus is the reference
implementation: `head_commit` + per-cited-path `head/index/worktree/untracked` digests + a state enum, with
**unknown provenance failing closed** rather than being treated as clean. For a harness whose facts are about
a moving tree, this is the difference between "the note is about the code" and "the note is about *which
revision* of the code, and whether the working tree has moved since".

**T4. Give the belief an age, owned by the harness, visible at read time.** Claude Code's `modified`
frontmatter is set by the harness and shown to the model on recall - the model cannot fake freshness.
MemoryBank's Ebbinghaus decay is the research-side version. Neither is sophisticated; the point is that the
age is present at the moment of use.

**T5. Validate a proposed belief against the thing it describes before accepting it.** Gemini CLI's unified
diff is the pattern: a candidate is a patch against a specific file state, and "patch does not apply cleanly"
is a named rejection. A harness can adopt this without a review UI: **a memory write that cannot be re-anchored
to the current artefact is not a memory, it is a guess.**

**T6. Cap the injection, and degrade to index lines rather than truncating.** This repo's
`context_injection.max_total_bytes` + "degrade to index lines (path + reason + size)" is better than both
extremes found elsewhere (Claude Code's 4 MiB skip; Aider's warning). The reader still learns *that* the
document exists and why it was registered.

**T7. Treat "the model followed the instruction" as orthogonal to "the task was solved".** AGENTbench shows
agents obey context files (1.6x vs <0.01x use of a named tool) and still do slightly worse at 20%+ more cost,
because the extra instructions made the task harder and the overview did not speed up navigation. Corollary:
**do not measure a durable-knowledge mechanism by whether the agent cited it.**

**T8. The gate/context boundary applied to knowledge.** From this repo's own finding plus three shipping
statements: Claude Code ("Claude treats them as **context, not enforced configuration** ... To block an action
regardless of what Claude decides, use a PreToolUse hook instead"; "If the instruction is something that must
run at a specific point ... write it as a hook instead"), Cursor ("AI guidance should not be your only
security control"), MADR's `## Confirmation` ("Is there any automated or manual fitness function?"). The
operational test: **if you cannot name the check that fails when the rule is broken, the rule is context** -
and a rule that *can* be checked should move into the check, out of the context budget, which is the only way
to make the durable file smaller without losing the knowledge.

**T9. Review before commit is what the negative result points to - not "no machine writing".** Gemini CLI's
inbox ("nothing is auto-applied", target-allowlisted, dry-run validated, default no-artefact) and Anthropic's
`pause_after_compaction` are both cheap review steps. AGENTbench's finding is about *unreviewed agent-written
prose about a repository that already has documentation*; the paper's own Figure 5 shows the same artefact
becomes the best available source of truth when it is the **only** documentation. Condition the write on
(a) whether the fact is already derivable and (b) whether it is verified - not on a blanket ban.

**T10. Keep an episodic tier separate from a semantic one, and rotate it.** Journal (what happened, ~2000
lines then rotate) vs spec (what to do every time), with an explicit promotion rule, already exists here and
matches CoALA's separation and MemGPT's tiers. Episodic knowledge should never load by default; it should be
*searchable* - this repo's `trellis mem` over raw platform transcripts, deliberately kept out of the journal
("Raw cross-session dialogue is **not** stored here").

---

## Answers to the four must-answer questions

**1. What is the smallest durable-knowledge mechanism that measurably helps, given that machine-written
context files can hurt?**

A **pointer file, not a prose file - written at a named trigger, sized to a budget, loaded by path or by
task, containing only what the agent cannot derive.** Concretely, the smallest version that is consistent
with every piece of evidence here:

- *Content:* non-default commands that actually exist, pitfalls, and rationale. Claude Code's `/doctor` trim
  is the reference definition - "it cuts content Claude can derive from the codebase, such as directory
  layouts, dependency lists, and architecture overviews, and **keeps pitfalls, rationale, and conventions
  that differ from tool defaults**." This is the content rule the AGENTbench result supports: what hurt was
  the redundant overview plus extra requirements, not instruction-following (agents obeyed, and still did
  worse).
- *Form:* `file:line` pointers and named checks, never copied excerpts (Cursor, GitNexus). Pointers cannot go
  stale about content, only about existence - which is a much smaller failure.
- *Scope:* loaded by path glob or by explicit per-task registration with a reason (Claude Code `paths:`,
  Cursor globs, this repo's `{"file","reason"}` JSONL). Not always-on.
- *Size:* bounded, because every measured source agrees bigger is worse: 200 lines (Anthropic), 500 lines
  (Cursor), 20 K tokens of chat files (Aider), 8 KiB router / 24 KiB document (this repo's test). The honest
  position on the *number* is in Caveat 4 - none of these is experimentally derived, so pick one, enforce it
  in a test, and treat it as a budget rather than a truth.
- *Write path:* human, or agent-with-review. Gemini CLI's inbox is the shipping pattern; `trellis-update-spec`
  is the local one.
- *What this buys, honestly:* AGENTbench says the human-written version of this is worth about **+4%
  relative, at +19% cost** - marginal. The mechanism's real justification is not that it raises the success
  rate; it is that it **stops the agent from re-deriving non-obvious facts and from re-making recorded
  mistakes**, which AGENTbench did not measure at all. Do not sell it as a performance win.
- *The one mechanism with a large measured win* is different in kind: AWM induces **workflows from verified
  successful trajectories** and supplies them selectively (+24.6%/+51.1% relative, web navigation). If this
  harness wants a large number, the thing to build is not a notes file - it is a **procedure library written
  from episodes that were verified to succeed**, which is also what `spec/guides/index.md`'s
  "~35% false-positive rate for AI reviews" already is, in miniature.

**2. How do you invalidate a stored belief when the thing it describes changes? Name implementations.**

Ranked by how much of the problem they actually solve, with the implementation named:

| Mechanism | Implementation read | What it detects |
|---|---|---|
| **Don't store the belief; re-derive it** | Aider re-reads every in-chat file from disk each turn and drops files that vanished (`base_coder.py:598-607`); Aider's repo map tags are cached on **mtime** and rebuilt on change (`repomap.py:227-262`, `--map-refresh` auto / files / manual / always) | Content changes; deleted files |
| **Delete derived beliefs on a schedule, force re-derivation** | Anthropic `clear_tool_uses_20250919` (`keep` newest N, `clear_at_least` tokens, `exclude_tools`), `clear_thinking_20251015`; Claude Code re-reads up to 5 most-recently-modified files after compaction and returns >5,000-token files as **path references only**; CLAUDE.md, auto memory and git status are re-read from disk after compaction | Stale tool results and stale file content in context |
| **Anchor the belief to a revision and digest every cited path** | GitNexus `evidence_provenance`: `head_commit` + `global_dirty_digest` + per-path `head/index/worktree/untracked` digests + `state` enum; **unknown provenance fails closed** ("not interpreted as a clean tree") | Commit drift *and* dirty/staged/untracked/deleted/renamed/mixed working-tree state |
| **Store a proposal as a patch against the current artefact; refuse to apply if it no longer applies** | Gemini CLI auto memory: candidates are `.patch` files, validated with dry-run apply and target allowlist; failure reason `patch does not apply cleanly` drops the candidate (`memoryService.ts:856-918`) | Any change to the target between proposal and acceptance |
| **Make the belief a pointer** | Cursor: "Reference files instead of copying their contents ... prevents them from becoming stale as code changes"; GitNexus "must not contain full files ... cite `file:line`, don't re-quote" | Content drift (not existence) |
| **Timestamp the belief, owned by the harness** | Claude Code writes `modified` (ISO 8601) into frontmatter and shows it to the model on read-back; MemoryBank decays by elapsed time * signficance | Age, not correctness |
| **Supersede rather than edit** | MADR `status: "superseded by ADR-0123"`; `date` = "when the decision was last updated" | Nothing automatically - but a reader sees the chain |
| **Over-limit write is an error, not a warning** | Claude Code: over 200 lines / 25 KB, "the write still succeeds, but Claude Code returns an error telling Claude to rewrite the index, because everything past the limit is dropped on the next load" | Unbounded growth |
| **Nothing** | MCP reference memory server (delete is a model decision, no timestamps, no provenance); every AGENTS.md/CLAUDE.md/Cursor/Copilot/Kiro contradiction rule ("the closest wins", "avoid conflicting sets", "Claude may pick one arbitrarily") | - |

**Notably absent everywhere: existence checks.** No product found notices that a rule references a path, file
or command that no longer exists. A harness can do this cheaply (`referenced path resolves?`, `named command
still exists?`) and it is the single highest-value detector this survey found nobody shipping.

**3. Knowledge for context versus knowledge for a check.**

Apply this project's own rule - a convention is context, a gate is enforcement - to durable knowledge:

- **Belongs in a check** if a machine can decide whether the artefact satisfies it, without the model's
  cooperation. Corollary: if you *can* write the check, the knowledge should leave the context budget
  entirely, because the check is deterministic and the file is advisory. Examples from this survey: the local
  `spec-context-budget.test.ts` (router <= 8 KiB, exact heading inventory, no `###` in the router, no code
  fences) - a rule about documentation shape that is enforced by CI; MADR's `## Confirmation` section, which
  asks the ADR author to name "any automated or manual fitness function"; a "run `npm test` before
  committing" rule, which belongs in a hook, not a CLAUDE.md.
- **Belongs in context** if it changes judgement and cannot be decided from the artefact: why a design was
  rejected, which of two similar-looking modules is the live one, an owner, a non-obvious environment
  constraint, a measured false-positive rate to apply when reading a review.
- **The trap AGENTbench exposes**: the instruction "always use `uv`" is context, the agent follows it, and the
  task gets harder. If the point is that the tool must be used, that is a check on the build command, not a
  sentence. **Writing an enforceable rule as prose converts a deterministic property into a probabilistic
  one, and the measured cost is ~20% more tokens for no gain.**
- **Concrete test to apply per knowledge item**: (a) can a script decide it? -> check, and remove it from the
  conventions file. (b) if not, does it change what the agent would do? -> context. (c) if not, it is a
  journal entry, and it belongs in the episodic tier where it is searchable but never loaded.
- **Amplifier for this repo's finding**: almost all of `spec/` is context. The budget test enforces its
  *shape*, not its *content*, so a spec can satisfy CI while stating a rule nothing checks. The cheapest
  upgrade is to give every spec section an optional "enforced by:" field naming a test, gate or hook, and
  fail the budget test when a section claims enforcement and no such test exists - same instinct as the
  `InstructionsLoaded` logging hook (make the loading decision observable) applied to enforcement.

**4. Is there evidence about how much durable knowledge is too much?**

Evidence, in order of strength, and none of it is a threshold experiment:

- **Closest to evidence (benchmark-scale):** AGENTbench - context files averaged **641 words / 9.7 sections**
  (max 2,003 words) and were still net-negative when machine-written; more content *within that range* cost
  ~20-23% more for a small loss. So the "too much" boundary is well below "large", and the failure is not only
  size - it is redundancy with existing documentation.
- **LongMemEval:** commercial assistants and long-context LLMs show a **30% accuracy drop** on cross-session
  memory even with memory features; more stored context did not fix it. The gains came from indexing and
  retrieval design.
- **Chroma Context Rot:** 18 models degrade on trivial tasks as input length alone grows, with difficulty
  held constant. **Lost in the Middle:** position matters - the middle is worst. These bound how much *loaded*
  context is safe, not how much *stored* knowledge is useful.
- **Product constants (stated, not measured):** Anthropic "target under 200 lines per CLAUDE.md file. Longer
  files consume more context and reduce adherence"; hard skip at 4 MiB; warning when several within-limit
  files together exceed a combined limit; auto memory 200 lines / 25 KB loaded and an **error** when the index
  exceeds it; skill bodies 5,000 tokens each / 25,000 total, oldest dropped first. Cursor: "Keep rules under
  500 lines". Aider: warn at >= 4 files and >= 20 K tokens. This repo: router <= 8 KiB, routed spec <= 24 KiB,
  journal rotation at 2,000 lines, injection payload 128 KiB with degradation to index lines.
- **The one design idea that is better than a number**: bound the *always-loaded* tier and let the rest be
  pulled. Every product converged on this; it makes the question "how much is too much" apply to the index
  only. This repo's router test - routing structure only, no code fences, exact heading inventory - is the
  strictest instantiation found anywhere.
- **Answer to the question as asked:** the only *measured* claim is that machine-written repository summaries
  of ~640 words were too much in the sense of being net-negative *when documentation already existed*; there
  is **no experiment** establishing 200 lines (or any other figure) as the point where adherence degrades.
  Anthropic's sentence - "longer files consume more context and reduce adherence" - is asserted, not
  demonstrated, in everything I could read. Treat every threshold in this file as a budget with a comment
  explaining that it is a convention.

---

## Could not verify

- **AGENTbench's absolute resolution rates** - only in Figure 3's bar charts; the HTML text has the steps/cost
  table and the deltas, not the rates. The abstract's "-3%" and Section 4.2's "-0.5% / -2%" do not reconcile
  in prose, so I cannot say whether the headline is percentage points or a relative change. **Do not quote
  "-3%" as an absolute drop.**
- **Anthropic's memory-tool and context-editing documentation** (`docs.claude.com`, `platform.claude.com`) is
  region-blocked from this environment. I substituted the **SDK type definitions**, which give field names,
  defaults and doc comments - but not the surrounding guidance (e.g. exactly which tool results
  `clear_tool_uses` clears in practice, or whether the harness re-reads files itself).
- **Claude Code auto memory in practice** - closed source. Everything about it, including the 200-line/25 KB
  load window and the over-limit error, is **documentation-only**.
- **Cursor memories.** No memories page exists in Cursor's published docs index (`cursor.com/docs/llms.txt`
  lists only `rules`, `skills`, `subagents`, `hooks`, `plugins` under "customizing"), so I did **not** cover
  Cursor memories and make no claim about them. Everything Cursor-related here is rules-only and
  documentation-only.
- **Kiro steering** is documentation-only and closed source; I re-confirmed the `inclusion` modes exist and
  added nothing beyond prior research.
- **`npryce/adr-tools` source** - `src/adr-supersede` and `src/adr-generate` both returned 404 and the file
  listing came back empty, so supersession is documented here (MADR's status field and template) but not read
  as code.
- **GitNexus's engine** - README unreachable in four attempts; I read two skill reference documents, not the
  graph builder or the PDG slicer.
- **`cloudwego/abcoder`** (391 stars, Apache-2.0, "deep, reliable and confidential coding-context") and
  `tintinweb/pi-gitnexus` were found by API search and **not read**. The repo's own skills reference ABCoder;
  I flag it as a gap rather than describe it.
- **Sourcegraph** - not fetched at all. The brief named it (SCIP/commit-pinned indexes) and I have nothing.
- **Aider's repo-map ablation numbers.** The published post has no quantitative comparison and I did not
  retrieve the benchmark JSON, so I cannot say what the repo map is worth beyond its author's claim that it
  replaced ctags and is a "key enabler".
- **Any measurement of a harness's retrieval policy** (path-glob rules, descriptions, skills) against a
  baseline. None exists in the sources read. `InstructionsLoaded` is logging, not evaluation.
- **I ran no code.** Every code claim is a read, not an execution.

## Caveats / Not Found

1. **The strongest "durable knowledge helps" number in this file is from web navigation, not code.** AWM's
   +24.6%/+51.1% is about workflows induced from **successful trajectories** and supplied selectively. Nothing
   in the literature measured that for a coding harness; the one measured coding result is the ETH negative.
   Treat any transfer as a hypothesis.
2. **Four of the five memory-system papers use benchmarks their own authors authored or chose, and all use
   LLM judges.** Mem0's "26%", Zep's "94.8 vs 93.4", ExpeL's "consistent enhancement" are self-reported.
   Rank them as author/vendor claims, not independent measurements.
3. **Chroma's Context Rot is a vector-database vendor's technical report.** Its design is sound and its
   finding is consistent with *Lost in the Middle*, but its conclusion ("retrieval matters") aligns with its
   product.
4. **"Under 200 lines" is a product constant, not a measured threshold.** The only nearby measurements:
   AGENTbench's real context files averaged 641 words / 9.7 sections (already inside the guidance, still
   net-negative when machine-written); Aider warns at >= 4 files and >= 20 K tokens; Cursor says under 500
   lines; Claude Code's hard skip is 4 MiB and its auto-memory window is 200 lines / 25 KB; this repo's router
   is 8 KiB and routed specs 24 KiB. **No experiment sits behind any of these numbers.**
5. **The ETH result is narrow and conditional, and the paper says so.** Python-only; task resolution only;
   each agent only in its own harness; 138 instances; one sample per instance; LLM-generated task descriptions
   and tests; effect reverses when documentation is removed. Two corrections to the framing this task
   inherited: the "+4%" is human files *versus no file at all* (not a baseline comparison), and **Claude Code
   was the one agent for which even human-written context files did not improve performance.**
6. **The paper's one retrieval measurement is negative for the mechanism everyone writes overviews for**:
   context files did not reduce the number of steps before touching a relevant file.
7. **Local correction to the PRD's framing of `spec/`**: the enforced budget is real and stronger than
   "an enforced context budget" suggests - `tests/spec-context-budget.test.ts` asserts router <= 8 KiB,
   per-spec <= 24 KiB, line-ending-independent measurement, router-contains-only-routing-structure, **and the
   exact `##` heading inventory of every routed spec**. It is a shape contract, not only a size one.
8. **Marked as vendor marketing, not evidence:** GitNexus "The Zero-Server Code Intelligence Engine"; Cursor's
   "Apply Intelligently"; Kiro/AWS statements about steering; Chroma's framing of its own report; and the MCP
   memory server's README claim that it "lets Claude remember information about the user across chats" (the
   README is a claim; `index.ts` is the evidence, and it has no timestamps).
