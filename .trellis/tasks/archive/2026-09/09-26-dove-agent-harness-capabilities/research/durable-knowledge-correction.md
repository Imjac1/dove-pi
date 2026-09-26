# Correction and addition: durable knowledge

- Date: 2026-09-26
- Source: `research/durable-knowledge.md` (~63 KB, arXiv:2602.11988v1 read in **full** from arxiv.org/html)

## 1. A number I recorded wrong, twice

I recorded the ETH Zurich benchmark as "developer-written context files +4%, LLM-generated **-3%**, at 20%+
more cost", and treated it as settled. Reading the full paper changes it:

- The **+4% compares human-written files against no file at all**, not against a baseline.
- The paper's own finding is that human-written files improved performance "for all agents **but Claude
  Code**" - **the agent this project actually uses is the one case where even human files did not help.**
- The abstract's -3% does not reconcile with section 4.2's -0.5% (SWE-bench Lite) and -2% (AGENTbench).
  The absolute resolution rates are only in Figure 3 bar charts and could not be extracted.
- **Treat the effect as approximately zero, small, and conditional - not as "minus three points".**
- It does not measure convention adherence, security, style, or non-summary knowledge, and it is
  Python-only.

**The strongest sub-finding, and the one that inverts the headline**: they repeated the run after deleting
all `.md` and docs, and **the LLM-generated file then improved performance by +2.7% and beat the human
files.** The negative result is **conditional on documentation already existing**. The cause of harm was
**redundancy with existing docs plus added requirements**, not instruction-following failure - the agents
demonstrably obeyed (a named tool was used 1.6x versus <0.01x).

And a measured negative that matters: context files did **not** reduce "steps before touching a relevant
file". **The one retrieval hypothesis everyone writes an overview for is the one that failed.**

## 2. What actually helps, and the only large number found

**A pointer file, not a prose file** - written at a named trigger, path- or task-scoped, containing only
what the agent cannot derive. Claude Code's `/doctor trim` gives the content rule in its own words: it
"cuts content Claude can derive from the codebase (directory layouts, dependency lists, architecture
overviews) and keeps pitfalls, rationale, and conventions that differ from tool defaults".

**The large measured win is a different mechanism entirely.** AWM (arXiv:2409.07429) induces **workflows from
verified successful trajectories** and supplies them selectively: **+24.6% / +51.1% relative** on
Mind2Web and WebArena, and **+8.9 to 14.0 absolute points** on transfer.

> **If this project wants a number, it should build a procedure library from verified episodes, not a notes
> file.**

That also connects directly to M6: trajectories are only worth learning from when something verified them.

## 3. Invalidation mechanisms that exist, and the one nobody ships

| Mechanism | Implementation |
|---|---|
| Don't store it at all | Aider re-reads every in-chat file **from disk every turn** and drops vanished files (`base_coder.py:598-607`) |
| Delete derived beliefs on a schedule | Anthropic SDK `clear_tool_uses_20250919` (newest N, `clear_at_least`, `exclude_tools`), `clear_thinking`, `compact_20260112` with `pause_after_compaction` returning the summary for review |
| **Anchor to a revision** | GitNexus context packs carry `head_commit` + `global_dirty_digest` + per-path digests + a `clean|staged|unstaged|untracked|deleted|renamed|mixed` state, and **"legacy packs are not interpreted as a clean tree"** |
| Propose as a patch | Gemini CLI validates a candidate memory by **dry-run apply**; "patch does not apply cleanly" is a **named rejection** and the candidate is dropped |
| Refer, don't copy | Cursor; and a **harness-owned** timestamp so the model sees the age of what it recalls |

> **Nothing anywhere detects that a rule references a path or command that no longer exists. That is the
> cheapest high-value detector nobody ships.**

## 4. Context versus check - an operational test for this repository

> **If you cannot name the check that fails when the rule is broken, it is context.** If you *can* write the
> check, the knowledge should leave the context budget: the check is deterministic, the file is advisory.

And a gap in this repository's own spec system, stated plainly: **the spec budget test enforces document
*shape*, not content. A spec can pass CI while stating a rule nothing checks.** The concrete fix is to give
each spec section an optional `enforced by:` naming a test, a gate or a hook.

The trap the paper exposes: "always use `uv`" is context, the agent obeys it, and the task gets harder at
+20% tokens for no gain.

## 5. How much is too much

No measured threshold exists. Anthropic's "under 200 lines" is asserted, not demonstrated, in anything
readable. What does exist: this repository's own `tests/spec-context-budget.test.ts` (router ≤8 KiB, routed
spec ≤24 KiB, router may contain only routing structure, and **the exact heading inventory of every routed
spec is asserted**); `config.yaml`'s `max_total_bytes 131,072` with overflow "degrading to index lines";
Claude Code's auto memory loading only the first 200 lines / 25 KB of `MEMORY.md` and **erroring** if the
index exceeds it.

> **The transferable idea is not a number: bound the always-loaded index only, and keep bodies pull-able.**

## 6. The write problem, and the reference implementation

Five shipping answers. **Gemini CLI Auto Memory is the one to copy** (Apache-2.0, source read): background
extraction over idle past sessions, candidates written as unified-diff `.patch` files into a project
**inbox**, target-allowlisted, dry-run validated, **"nothing is auto-applied"**, and the extractor "defaults
to creating no artifacts unless the evidence is strong".

Claude Code writes **directly** - and that is precisely the condition AGENTbench measured as net-negative.

## 7. A local observation worth keeping

This repository's `spec/guides/index.md` already holds a measured, non-derivable fact of exactly the shape
the paper says is worth keeping: **"Budget ~35% false-positive rate for AI reviews"** plus three named
false-positive patterns. That is the right kind of durable knowledge, and it was written by hand.

And the PRD's description of `spec/` understates what is there: the budget test asserts **structure**, and
three tiers already exist with an explicit promotion rule - task, journal (rotating at
`max_journal_lines 2000`) and spec - with `implement.jsonl` rows carrying a `reason`.

## 8. What this adds to the design

The frontier-shaped addition to capabilities 2 and 5, none of which this repository has:

1. A **typed** memory directory, per-repo and machine-local, with an always-loaded index and pull-able typed
   topic files.
2. A **harness-owned age** field.
3. **A review step before the write** - candidates to an inbox, never applied automatically.
4. **Digests or commit anchors**, so a stored belief knows which revision it describes.
5. The detector nobody ships: **a rule that references a path or command that no longer exists**.

And a discipline for the design's own documentation: **every rule stated here should name the check that
fails when it is broken, or be labelled as context.**
