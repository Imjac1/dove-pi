# Design constraints the evidence actually establishes

- Date: 2026-09-26
- Sources: all files in this directory. Every constraint below is marked with how it was established, because
  the difference between "a CVE says so" and "a vendor says so" is the whole point of this project.

## C1. A gate must cover the harness's own subprocesses, not only the model's tool calls

**Established by CVEs, not by opinion.** Six named bypasses share one shape:

| Case | What the gate covered | What it did not |
|---|---|---|
| CVE-2026-55607 (Claude Code) | the model's tool calls | the harness's own `git`, run outside the sandbox; `.git` hardening covered only the root |
| CVE-2025-59532 (Codex CLI, <0.39.0) | the sandbox root it was told | that the root was a **model-generated** path |
| Overpatch (Codex `apply_patch`) | the patch to write | that "parent folder of each path" made `/tmp` grant `/`, with no prompt |
| Heapjack (Codex `node_repl`) | the sandbox boundary | that trusted and untrusted JS **share one V8 heap**, readable via heap snapshot |
| Beltdown2 (Cursor CLI) | the shell tool | the harness's internal `git`, unsandboxed, honouring `core.fsmonitor` |

Three rules follow, and they are design requirements rather than warnings:

1. **The gate's coverage must include every process the harness itself starts.** Git indexing, patch
   application and any REPL parent are inside the boundary or the boundary is decorative.
2. **No model-influenced value may be consumed as trusted configuration.** A cwd, a path list, a patch
   target: these are inputs to be checked, never the frame the checking happens in.
3. **The permit for one operation must not widen another.** "Grants write access to the parent folder" is a
   scope bug even though the operation itself was checked.

## C2. Fail closed or ask; never fail open - and the default is currently the opposite

The most useful single artefact in the research, because shipping products disagree and the disagreement is
documented:

| Product | On hook timeout / crash | Verdict |
|---|---|---|
| Claude Code `PreToolUse` command/http hooks | "the action proceeds"; malformed stdout is a "non-blocking error" | **fail open** |
| Claude Code Agent SDK callback hooks | blocks | fail closed |
| Cursor | crash/timeout/non-zero exit fail open **by default**; fail-closed is per-hook opt-in | **fail open** |
| Codex `GranularApprovalConfig` | a category set false is **auto-rejected, not queued**; `approval=Never` "never escalates" | **fail closed** |

And two first-party admissions that the gate is off the path when it matters:

- Cursor: "Hooks do not run during those turns" (cloud agents' read-only exploratory turns).
- GitHub Copilot: the firewall "only applies to processes started by the agent via its Bash tool. It does
  not apply directly to MCP server processes or processes started in configured setup steps."
- Anthropic, in its own docs: "don't count on a stalled hook to act as a gate."

**Requirement**: a gate that cannot evaluate **fails closed or asks**. Codex's auto-reject is the shipping
precedent to copy. A gate whose absence is indistinguishable from its approval is not a gate.

## C3. Deny must not be overridable by the allow channel

Claude Code states it plainly: "Deny rules block in every mode, including `bypassPermissions`", and
"Exit 2's block is the one outcome JSON can't override". Codex orders them: "**deny beats write, write beats
read**".

**Counter-example to design against**, from the same product: `EndConversation` **skips** `PreToolUse` and
`PostToolUse` entirely, and deny/ask rules do not apply to it. So even the best-documented gate has an
action that routes around it.

**Requirement**: denial is evaluated independently of, and after, any allowance; and every action class must
be shown to pass through the same evaluation - "this one skips the gate" is the bug, not a design choice.

## C4. A control that runs concurrently with the effect is not a control

OpenAI's Agents SDK ships input guardrails with `run_in_parallel` defaulting to **True**, and its own docs
say a triggered tripwire means "the agent **may have already consumed tokens and executed tools** before
being cancelled". `ToolGuardrailFunctionOutput.behavior` defaults to `AllowBehavior`. Input guardrails run
only for the **first** agent in a chain.

**Requirement**: a check that is intended to prevent must complete before the effect it prevents. Anything
that runs in parallel is detection, and must be named as detection.

## C5. A model grading itself is not a check

OpenHands: "The LLM can **annotate actions with security risk levels during generation**, which the analyzer
then uses to make security decisions" - with `UNKNOWN` ("could not be determined") and no documented
fallback. This is the same shape as the audit vertical's finding that agents reported success in 90% of
episodes where they had duplicated an effect, and as Reflexion's ablation where reflection **without** an
execution signal fell below baseline.

**Requirement**: whatever decides "this is safe" or "this is done" must not be the thing that produced it,
or must be shown to be independent. This is the one capability **neither layer of this repository has
attempted**, so there is no local precedent to lean on.

## C6. A convention is not a check, and the benchmark says LLM-written ones cost more than they give

AGENTS.md has converged on **filename and discovery**, not on **format**: four incompatible encodings are in
current use (Cursor `.mdc` - a plain `.md` "is ignored by the rules system"; Copilot's two file shapes;
Kiro's `inclusion:` front matter; Claude's `.claude/rules/`). Every vendor answers "what if they conflict?"
with prose.

The only benchmark found - arXiv 2602.11988v1, *Evaluating AGENTS.md* (ETH Zurich / LogicStar.ai, preprint):
138 instances, 12 repositories, developer-written context files. **See the correction in `durable-knowledge.md` - these figures were
recorded wrong here.** The authors recommend minimal requirements, matching Anthropic's own
"target under 200 lines".

**No product checks agent output against its conventions.** The nearest are Spec Kit's agent-judged converge
loop and Anthropic's own advice: "To block an action regardless of what Claude decides, use a PreToolUse hook
instead."

**Requirement**: conventions are context, not enforcement, and this repository already demonstrates the
difference **inside itself** - `.trellis/agents/*.md` carry no tool list, so the git-commit ban is prose,
while `.codex/agents/*.toml` carry `sandbox_mode` which the host enforces. State which of the two each rule
is.

## C7. Nothing in the protocol obliges an approval boundary

Checked against the normative specification rather than a README: MCP's tools specification states "there
**SHOULD** always be a human in the loop with the ability to deny tool invocations", and "the protocol itself
does not mandate any specific user interaction model". The words **approval, permission and consent do not
appear** in that document at all. Elicitation is server-initiated data collection, not an approval verb.

**Requirement**: any approval boundary in this harness is **ours**, not inherited from the protocol. That
means it must be designed, tested against its own bypasses, and not described as "the protocol handles it".

## What none of this establishes

- That these bypasses are the whole set. They are the published ones.
- That copying Codex's fail-closed default is sufficient. It is the best precedent found for the *default*;
  nothing here shows its coverage is complete.
- That the benchmark generalises. It is a 2026 preprint over 12 repositories, and the authors' own advice is
  conservative.
- Any claim about Devin (nothing fetchable) or Zed (client-rendered docs).