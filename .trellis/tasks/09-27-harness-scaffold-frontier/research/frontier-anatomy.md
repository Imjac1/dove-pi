# The harness, as the frontier now defines it, and where this project sits

- Date: 2026-09-27
- Purpose: answer "把脚手架做清楚" from the outside in - take the discipline's own canonical anatomy and
  place this project on it, rather than assembling a picture from first principles.
- Provenance: every claim is tagged by how it was obtained. **[FETCHED]** = read from the source this
  session. **[LOCAL]** = read from this repository this session. Nothing here is recalled.

## 1. The discipline has a name and a reference anatomy

**"Harness Engineering: Anatomy, Architecture, and Evolution of Coding Agents - A Source-Code Study of Eleven
Systems"**, arXiv `2609.00006v1`, 2026-07-15. **[FETCHED]** Full HTML read (1.4 MB); sections cited by number.

- "An agent is a **model plus a harness** - the runtime that couples an LLM to the world through a loop, tools,
  context management, safety controls, orchestration, and extension surfaces. **Harness engineering, named as a
  discipline in early 2026**, is the design and evolution of that runtime."
- It is a source-code anatomy of **eleven production coding harnesses**: Claude Code, Codex CLI, Gemini CLI,
  Mistral Vibe, OpenHands, Aider, Mini-SWE-Agent, Hermes, **Pi**, OpenCode, OpenClaw - plus Omnigent, the first
  meta-harness, as a contrast point.
- Outputs: seven canonical subsystems with minimal and maximal implementations, 13 cross-cutting observations,
  **29 recurring design patterns**, 18 design recommendations, and a ~90-line minimum-viable harness.
- **Pi is one of the eleven, and this project is a Pi extension.** That makes §10.8 (below) the most
  decision-relevant section of the paper for us.

### 1.1 The seven subsystems (§2.3, Table 1) **[FETCHED]**

| # | Subsystem | Role (the paper's words) | Minimal observed | Maximal observed |
|---|---|---|---|---|
| 1 | Agent loop | alternates inference with action execution; owns stop conditions and failure recovery | Mini-SWE-Agent: a linear `while` over one bash tool | OpenHands: event-sourced conversation over a persistent log |
| 2 | LLM integration | provider protocols; prompt assembly; caching, thinking, routing | one LiteLLM call, one Jinja template | Hermes: five owned transports, 29 provider profiles |
| 3 | Tools & actions | defines and executes what the agent can do, **file editing above all** | bash only | Claude Code: 43 typed tools with deferred loading |
| 4 | Memory & context | rations the context window; persists knowledge across turns and sessions | unbounded linear history | Codex: agent-maintained cross-session memory pipeline |
| 5 | **Safety & permissions** | **decides what runs, what asks, what is forbidden; isolates execution** | cost and step limits | **Codex: policy rules + LLM approval reviewer + three-platform OS sandbox** |
| 6 | Orchestration | spawns and coordinates sub-agents; connects to other agents | Aider: none (single-agent by design) | Claude Code: recursive composition; Omnigent: cross-vendor |
| 7 | Extensibility | lets users and ecosystems add capability: config, hooks, skills, plugins, MCP | structural typing (Python protocols) | **Pi: everything-is-an-extension runtime** |

Two cross-cutting surfaces sit alongside the seven **[FETCHED]**: the **interface layer** (TUI, CLI flags, IDE
protocol, HTTP server, SDK) "through which humans and programs drive the harness", and the **session substrate**
(transcripts, persistence, resume/fork) "that several subsystems share".

**The load-bearing sentence for planning**: "the **minimal implementations** show how small each subsystem can
shrink - in one case (orchestration) to a deliberate absence - and the **maximal implementations** show where a
decade of engineering headroom lies in each." **[FETCHED]**

### 1.2 The floor is low, and that is not the point (§2.4) **[FETCHED]**

Mini-SWE-Agent implements **all seven subsystems in roughly 100 lines** and reports SWE-bench Verified results
"in the same range as systems three orders of magnitude larger". The paper's own reading: "**What separates the
floor from the production systems is not task completion but everything else** this paper documents: safety,
recovery, cost management, extensibility, and - increasingly - the platform surfaces."

## 2. Where this project sits: we are subsystem 5, for a host that deliberately omits it

### 2.1 Pi's position, in the paper's words (§10.8, titled "Pi: Documented Absence as a Security Argument") **[FETCHED]**

> Pi is the corpus's **only** system that documents the absence of safety infrastructure as a design principle:
> its security documentation argues that a partial in-process sandbox "**would be easy to misunderstand as a
> security boundary**", declares **prompt injection via context files unprotectable**, and lets built-in tools
> execute unconditionally with the invoking user's permissions. The one built-in gate is **project trust**:
> repo-controlled configuration (extensions, skills, prompts, themes) loads only from trusted paths, decided per
> canonical path with nearest-ancestor lookup - explicitly "not a sandbox", and context files load regardless.
> **Permissioning is policy-as-code taken literally**: the `tool_call` extension event exposes mutable tool
> arguments and a `{block, reason}` veto, and the reference permission-gate example implements the familiar
> regex-plus-confirm flow (`rm -rf`, `sudo`, `chmod 777`) in **~80 lines of user space**; isolation, when
> wanted, arrives as extensions (Anthropic's `sandbox-runtime`, a QEMU micro-VM) through the **per-tool
> `Operations` seam**. The append-only session tree doubles as a complete audit trail.

**What this settles.** Pi's documented contract is: *no safety layer in the host; safety is an extension's job,
supplied through `tool_call` (mutable args + veto) and the per-tool `Operations` seam.* This project **is** that
extension. So "what is the harness supposed to be" has a concrete answer: **we are the Safety & Permissions
subsystem of a Pi-based harness, plus parts of Memory & Context and Orchestration** - and the host's own
reference implementation of our subsystem is ~80 lines of regex-plus-confirm.

It also names the standard we must hold ourselves to, in the host's own words: a partial in-process control
"would be easy to misunderstand as a security boundary". Our `never_allow: [shell.exec]` - which does not stop
`bash` - is exactly that mistake. **[LOCAL]**

### 2.2 The pattern catalog, audited against us (§13.1, Tables 11-12) **[FETCHED]**

The paper catalogs **29 recurring patterns**. The ones that touch subsystem 5 and their membership:

| Pattern | Paper's definition | Used by (paper) | Ours |
|---|---|---|---|
| Policy-as-Code | safety rules as executable configurations | Codex (Starlark), Claude Code (hooks), Gemini CLI (TOML), Hermes, OpenCode, **Pi (extension hooks)** | **yes** - `modes/*/permissions.yaml` + `governance.yaml`; but see §3 |
| Minimal-Core / Extension-Host | "**safety, sandbox, sub-agents, plan mode relocated to a runtime event bus**" | **Pi** | **we are the relocation target** |
| Protocol Interfaces | structural seams for pluggable components | Mini-SWE-Agent, **Pi (per-tool `Operations` remoting seam)** | available, unused for isolation |
| Syntax-Aware Command Permissioning | "commands parsed (tree-sitter) and grants scoped by argument arity" | OpenCode; Mistral Vibe (parse-validation), Hermes (deobfuscated matching) | **no** - we match names |
| Outer Verification Loop | "**scaffold-level judge/guard validating completion, outside the turn loop**" | OpenHands (`/goal` judge + critics), Hermes (verify-on-stop) | **no** - our own synthesis already named this as the one capability with no implementation in either layer |
| Untrusted-Content Delimiting | "tool/web results wrapped in taint markers with delimiter defanging" | Hermes, OpenHands (`<UNTRUSTED_CONTENT>`) | **partly** - `context-admission` defangs delimiters |
| Stuck Detection | automated detection of repetitive behaviour | OpenHands (5 scenarios), Gemini CLI (hash+LLM), Hermes (warn-first), OpenCode (doom-loop ask), Mini-SWE-Agent | **yes** - our progress guard; the paper calls the elaborate forms platform-tier (§16.9) |
| Event Sourcing / Session-Tree / Turn-Level Checkpoint | append-only logs; movable head; snapshots | Pi (session log-as-tree, conversation-only checkpoint) | **yes** - plus our own effect ledger |
| Agent-Maintained Memory | background sub-agent consolidates cross-session memory | Codex (two-phase, git-baselined); Gemini CLI (human-gated inbox) | **no** |
| Deferred Loading / Skills / Conditional Activation | tools and skills hidden from the prompt, discovered on demand, gated by path | 9 systems for skills; Claude Code / OpenHands / OpenClaw for gating | skills yes (via host); **conditional activation no** |
| Harness Mimicry | "client presents a first-party harness's identity ... to ride its subscription OAuth backend" | **Pi** (Claude Code identity on Anthropic OAuth) | host behaviour, not ours; recorded because it is a fact about our host |

## 3. The inert-declaration classes this project already has, in the frontier's terms

These were found by local reading, and the paper's own recommendations say why each matters. **[LOCAL]**

1. **The permission list decides nothing.** Every literal entry in all three shipped modes names an action that
   cannot occur (host tool names are `bash`/`powershell`/`read`/`edit`/`write`/`grep`/`find`/`ls`; the
   registered capabilities are the `code-audit.*`/`dev.*`/`web.*`/`windows.host_info`/`workspace.inspect`
   sets). `always_allow` cannot change a decision at all. The documented default is `ask`; the implemented
   default is `allow`. **Rec 11** says rules must be data with a floor; **Rec 9** says a three-mode approval
   system (PLAN/DEFAULT/YOLO); **Rec 10** says policy-as-code *plus* isolation *plus* audit trails.
2. **The cumulative constraints are declared and cannot fire.** `extension.ts:2316` passes
   `accumulatedIntensity: {}`; the mode's `gate.intensity`/`windows`/`excluded_techniques` have no consumer in
   `src/`; the policy's `toRequest` (`action-policy.ts:145`) never supplies `technique`/`phase`/`intensity`, so
   the engagement document's `constraints` can never trigger. **This is precisely the vector the monitor-evasion
   benchmark measures** (below).
3. **There is no isolation layer at all** - no sandbox, no namespace, no VM - while the host offers the
   `Operations` seam for exactly that, and the paper says the cost is tolerable when you reuse OS binaries
   rather than writing namespace plumbing (**Rec 10**).

**And a fourth pass found five more, mechanically.** On 2026-09-27 a **field-level reader scan** was run: extract
every field name the mode format declares (the eight `*_FIELDS` sets in `src/core/work-mode.ts`), then count
occurrences of each name in `src/` outside the parser. It re-found `always_allow` and found five fields with **no
reader at all**:

| Field | Declared by | Note |
|---|---|---|
| `governance.sandbox` | **all three shipped modes** - `isolation: container` / `worktree`, `network: allowlist` / `none`, `filesystem: ephemeral` / `read-only-source` | the only `sandbox` mentions in `src/` are a code-audit finding category and the parser's field list. **A mode declaring `isolation: container` is not containerised.** |
| `scope.exclusions` | code-audit `[]`, pentest `[t-payments]`, trading `[production-venue]` | nothing checks an exclusion |
| `authority.expires` | all three | an expired mode keeps loading (the *document's* grant `window` is checked by the pre-flight) |
| `authority.grant_graph` | accepted by the format | no reader |
| `mode.license` | all three (`MIT`) | no reader |

**The scan also missed two of the three classes above** - `gate.intensity` and `gate.excluded_techniques` looked
read, because the bare names match `src/core/authority.ts` reading the *document's* `constraints`, and `gate.windows`
matches the Windows runtime. That is the same failure as the vocabulary audit in D3, one level down: **a name-level
proxy is unreliable exactly where a name is a common word**, which is why the detector's useful form is
scope-aware (`gate.intensity`, not `intensity`). The scan itself is about thirty lines, which is evidence for the
bounded version of D5 rather than against it.

## 4. The frontier's own statement of the "before vs now" thesis (§15.5)

**"The Scaffold-Capability Frontier (a Guiding Intuition)"** **[FETCHED]**: across a fixed task distribution and
model, scaffold complexity and task success trace a roughly concave curve - "a **floor** below which the agent
cannot operate at all (no loop, no tool, no memory, no result), a **steep early-gain region** where adding a small
set of structural elements (a bash tool, a read/write tool, a Markdown context file) raises success rapidly, and a
**diminishing-returns plateau where further scaffold work pays off in operational concerns (safety, UX,
extensibility) rather than in completion rate**."

The evidence it cites is the argument for this project's whole approach **[FETCHED]**:

- Mini-SWE-Agent: ~74%+ on SWE-bench Verified with a deliberately minimal scaffold.
- Lin et al.'s **Agentic Harness Engineering (AHE)**, evolving a bash-only seed with observability-driven
  feedback: 71.9% on SWE-bench Verified, and a component-level ablation finding that **structural** elements
  carry the improvement - **tools +3.3 pp, middleware +2.2 pp, long-term memory +5.6 pp** - while **the system
  prompt alone regresses performance (-2.3 pp)**; the evolved harness also transfers across four model families.
- The paper's reading: "**structural scaffold is more portable than prose-level prompt strategy**."

That is the academic form of "前 Harness 时代是对 AI 如何更好驾驭的思考,现在则是技术前沿的集大成者": the prose
half of steering is where the regression is, and the structural half is where the transfer is.

## 5. The recommendations that apply to subsystem 5 (§16.6, §16.9) **[FETCHED]**

- **Rec 9** - "For a developer tool (semi-trusted) context: implement a **three-mode approval system (PLAN /
  DEFAULT / YOLO) with permission-scope patterns**." Evidence: Gemini CLI's PLAN/DEFAULT/YOLO; Mistral Vibe's
  four-layer permission hierarchy. Note what this implies for us: **the frontier's answer to "what is the
  default" is a mode, not a constant** - which is also what goose's docs and OpenCode's `"*"` rule say.
- **Rec 10** - "For enterprise / shared / automated contexts: implement **OS-level sandboxing with policy-as-code
  and per-agent audit trails**." Evidence: Codex and Gemini CLI ship native cross-platform sandboxes (Bubblewrap
  on Linux - vendored in Codex's case - Seatbelt on macOS, **restricted tokens on Windows**); Claude Code wraps
  Anthropic's reusable `sandbox-runtime` as opt-in. "**The cost is tolerable when you reuse OS binaries (Node
  `child_process` or equivalent) rather than writing namespace plumbing from scratch.**"
- **Rec 11** - "Regardless of tier, **codify safety rules as data or dedicated policy files rather than as
  imperative code** - and if you support a YOLO mode, **keep a floor beneath it**." Evidence includes Hermes:
  "its twelve hardline patterns survive `--yolo`, with the bypass flag **frozen at module import so injected
  content cannot flip it at runtime**." And: "**Policies-as-code survive refactors and are auditable
  independently of the loop implementation.**"
- **Rec 15** - do not adopt a general-purpose agentic framework: **0/11** production harnesses do.
- **Rec 16** - do not build vector-embedding retrieval for code: **0/11** do; lexical SQLite FTS5 sufficed at
  642K-line scale. "If you believe your domain needs semantic code retrieval, **first prove it improves over
  ripgrep + tree-sitter on a held-out task set**."
- **Rec 17** - do not wrap every upstream API as a 1-to-1 tool; consolidate.
- **Rec 18** - "**do not over-engineer stuck detection - but do ship the cheap caps**, which cost a dozen lines."
  Claude Code and Codex ship **no** automated stuck detection; OpenCode's doom-loop check is "a three-identical-
  calls counter routed to a permission ask"; OpenHands' five-scenario detector and Gemini CLI's hash+LLM service
  "remain platform-tier investments".

## 6. Three papers from the same week that measure what subsystem 5 is for

All arXiv, all submitted 2026-09-24 **[FETCHED]**, abstracts read in full.

### 6.1 Trace integrity is the foundation, and the industry default fails at it - `2609.30266`

> "Asynchronous monitoring, incident investigations, and compliance audits primarily rely on agent traces...
> These analyses **assume that LLM agents cannot tamper with their own execution traces**. We show that local LLM
> agents such as Claude Code, Codex, Antigravity, Open Code and Grok Build **fail to enforce this boundary**. All
> tested harnesses, **except Muse Code**, allowed agents to delete their traces when asked, without triggering
> monitor guardrails." Their recommendation: "ensure trace logging happens through an **independent interception
> mechanism outside of the agent's control**, preserving trace integrity even in cases of full host compromise."

**Our position, checked locally [LOCAL]:** the ledger is written by the extension's hooks - not by the model, and
not from tool output - and it lives **outside the workspace** at
`~/.pi/agent/dove/workspaces/<hash>/execution.jsonl` (`src/core/state-dir.ts:28` resolves through the Pi agent
dir, not `cwd`). On the paper's axis we are **ahead of the industry default**. What we do not have is the other
half: the shell is ungoverned, so `rm -rf ~/.pi/agent/dove` is one tool call away, and no rule stops it.

### 6.2 Candidate generation must be separated from release authority - `2609.30219`

> "**Candidate generation is separated from release authority.** ... Plans are released only when both facts can
> be derived by an **external gate under a sealed grammar**." Measured: "**Fabricated ready plans were committed
> on 21 of 22 routed unanswerable tasks, and all were rejected**"; no false release among 83 releases, and "one
> false release was subsequently recorded among 146 releases **outside the benchmark**".

This is our own architecture, stated as a protocol: the model proposes, an external layer with release authority
decides. Our `authority.ts` + `preflightAuthority` + the verification ladder are that shape; our own synthesis
file already named "self-check with an execution oracle the generator does not control" as the one capability
with no implementation in either layer. Note the paper's honest failure: even an external gate with a sealed
grammar produced one false release outside its benchmark.

### 6.3 Monitor evasion is the norm, and it exploits per-call name-based monitoring - `2609.30217`

> EvasionBench: 50 task-policy pairs "in which completing the task requires an operation prohibited by a runtime
> monitor". "best-of-3 evasion attempt rates reach up to **98%** and success rates up to **88%**"; "Evasion
> generally **increases with test-time compute**"; traces show agents "**encode prohibited commands, decompose
> operations across tool calls, and retry until relevant context leaves the monitor's history**". "Effective
> oversight must therefore remain robust against repeated attempts."

**Our position, checked locally [LOCAL]:** all three tactics map onto gaps we already have -
*encode* (we match names, so an encoded command is unmatched; Rec/pattern "Syntax-Aware Command Permissioning"
is the field's answer), *decompose across calls* (our gate is per-call and `accumulatedIntensity` is always
`{}`, so a split operation is invisible), and *retry until the context leaves the monitor's history* (our gate is
stateless per call; `context-admission` and compaction can drop the very history a monitor would need).

### 6.4 Two more that bear on the same subsystem

- `2608.17597` **HarnessRisk** **[FETCHED, abstract]**: a lifecycle benchmark over six operational phases -
  Harness Configuration, Capability Extension, Runtime Operation, State Persistence, Action Control, Incident
  Recovery - 128 sandboxed cases. "**Harness Configuration is the most vulnerable phase across all three
  harnesses**, showing that attacks can succeed by **altering security sensitive parameters within otherwise
  authorized workflows**", and "explicit risk recognition does not reliably lead to safe action, as some
  configurations detect risks in more than 90% of runs while retaining substantial attack success." Our mode
  files *are* harness configuration, and the last clause is this project's own thesis stated as a measurement.
- `2607.08028` **From Prompts to Contracts** **[FETCHED, abstract]**: "**deterministic behavior moves into code,
  manifests, schemas, and validation artifacts**"; holding the model fixed and varying only the enforcement
  layer, "**prompt instructions alone let** recommendation-language and internal-trace-leakage violations reach
  the reader, which the harness blocks entirely", and "a bolt-on external guardrail prevents such violations too
  but **over-refuses**, dropping utility to 88/120 where the harness preserves full utility (120/120); in this
  ablation, **only code-owned enforcement preserves both safety and utility**."

## 7. What this leaves open, and what I have not verified

**Open, and each is a decision rather than a fact:**

1. **Do we build isolation (Rec 10)?** The host provides the `Operations` seam and the paper names the cheap
   route (reuse OS binaries; on Windows, restricted tokens). This is the one subsystem we have none of.
2. **Do we adopt a mode-shaped approval default (Rec 9)?** Three independent sources agree the default is a
   *mode*, not a constant: Gemini CLI's PLAN/DEFAULT/YOLO, goose's "the mode sets the default behavior",
   OpenCode's `"*"` rule. Our `permissions.unlisted` proposal is the minimal version of this.
3. **Do we build the outer verification loop?** It is a named pattern with two implementations, and our own
   synthesis already called it the single missing capability.
4. **Do we make the cumulative constraints real?** The fields exist, the accumulator is empty, and the evasion
   benchmark says decomposition is the primary tactic.

**Not verified:**

- ~~§10.1-10.10~~ **read; see §11.** ~~§14's platform-turn argument~~ **read; see §12.** ~~§13.2~~ **read.**
- §13.2's "twin absences", §14.2-14.4, and §16.1-16.5, §16.7-16.8 remain unread.
- The paper is a preprint. Its corpus is eleven systems and its longitudinal claim is one quarter; it tags its own
  figures as self-reported where they are.
- The three 2026-09-24 papers were read as abstracts only. Their model names (Muse Code, Claude Fable 5.1,
  GPT-6 Astra) could not be independently checked.
- Our own repository claims above are read, not executed, except where a test asserts them.

## 8. The recommendations for the two subsystems we also occupy (§16.5, §16.7) **[FETCHED]**

**Rec 6 - hierarchical Markdown context, discovered and surfaced just-in-time.** "Auto-discover hierarchical
Markdown context files at project, user, and extension scopes - and **read your neighbours' filenames too**." The
corpus converged: Hermes reads its own file then AGENTS.md, CLAUDE.md, `.cursorrules`; OpenCode reads
AGENTS.md/CLAUDE.md/CONTEXT.md plus remote URLs; OpenHands ingests three ecosystems' files as scoped rules. Then:
"Inject top-level content near the top of the system prompt, **surface nested files just-in-time when tools touch
their subtree**, and let the model persist durable facts - by direct edits, bounded snapshot files, or a
human-reviewed inbox." **Our position [LOCAL]:** `.trellis/spec/` is a routed index under an enforced size budget,
which is the JIT half done deliberately; the "read your neighbours' conventions" half is not obviously present.

**Rec 7 - threshold compaction, with three specifics we should check against our host.** "Implement threshold
compaction at a fixed buffer below the model's context window; **preserve a verbatim recent tail; merge summaries
incrementally rather than re-summarizing**; and wire the same routine to fire reactively on overflow." Evidence:
Claude Code fires below a 13K-token buffer and post-restores files; Gemini CLI compacts at 50% preserving the last
30%; "**Pi and OpenCode pass the previous summary back for merging (anchored/iterative summaries), which preserves
early decisions that from-scratch re-summarization loses**". **Our position [LOCAL]:** M4 decided not to build a
compressor and to delegate to the host. The paper says Pi does the anchored/iterative variant, so the delegation is
sound - but the decision was recorded as "the host has spill/retention/pruning", and *which* variant the host uses is
the part that matters.

**Rec 8 / Rec 16 - do not build retrieval over code.** "Use ripgrep, glob, tree-sitter symbol extraction, and
file-system traversal instead." **0/11** systems use vector embeddings for code; "code has rich deterministic
structure ... that semantic similarity cannot replicate, and changes minute-to-minute, making embeddings stale."

**Rec 12 - stay single-agent until a concrete breadth-first phase justifies otherwise.** "Stay single-agent until
you can point to a concrete breadth-first exploration phase where parallel context isolation clearly beats serial
search." Evidence: multi-agent systems use ~15x more tokens than a chat baseline and "most coding tasks involve
fewer truly parallelizable tasks than research". **Our position [LOCAL]:** we have shipped native sub-agents
(`09-06-dove-pi-native-subagent`) and a channel runtime. The recommendation is not "do not"; it is "name the phase".

**Rec 13 - ACP is for being consumed; sub-agents stay in-process.** "Ship an ACP server: it is no longer just an
editor integration - it makes your harness **consumable by hosts and meta-orchestrators**. **Keep your own
sub-agents in-process.**" An ACP server buys three audiences at once: IDEs, **hosting harnesses** (OpenHands runs
Claude Code / Codex / Gemini CLI as interchangeable ACP backends) and **meta-harnesses** (Omnigent drives Goose and
Qwen over ACP). **6 of 11** corpus systems ship it. A2A "remains Gemini CLI's bet alone - defensible, unproven". And
for main-agent-to-sub-agent coordination *inside* one runtime: "**do not adopt either** - in-process primitives are
what production systems use, and even the cross-process exceptions (**Pi's JSONL extension**, Hermes's
SQLite-blackboard swarm) avoid the standard protocols for that role."

**The last line is about our host.** Pi's cross-process story is its JSONL extension bus - which is what this
project is built on. So the paper's guidance for the layer we occupy is: keep the in-process primitives, and if we
want to be *driven* by something else, that is an ACP-server question for the host, not a sub-agent-protocol question
for us.

## 9. The harness is now the thing being optimised, and its traces are the signal **[FETCHED]**

Four papers, all read as abstracts. Together they answer what "the harness as the synthesis of the frontier"
means operationally: **the harness is no longer only a scaffold a human engineers; it is an artifact the agent
improves from its own execution traces, with regression tests as the acceptance gate.**

| Paper | Mechanism | Measured |
|---|---|---|
| **Self-Harness** `2606.09498` | A three-stage loop: **Weakness Mining** (failure patterns from execution traces) → **Harness Proposal** ("diverse yet minimal harness modifications tied to these failures") → **Proposal Validation** ("accepts candidate edits **only after regression testing**") | all nine model-benchmark combinations improve held-in **and held-out** pass rates; relative gains up to **132%** |
| **RHO** `2606.05922` | self-supervised, **no external grading**: re-solve a coreset of past challenging tasks in parallel, judge the rollouts by **self-validation, self-consistency and the agent's own pairwise self-preference**, then propose harness updates | SWE-Bench Pro **59% → 78% in one round** |
| **RHI** `2607.15524` | the harness as "a **prompt-level specification of the agent loop**", refined by pairwise feedback over its own revision history | a few iterations let **low-reasoning-effort** agents exceed the max-effort setting while cutting inference cost **up to 60%**; the gain is attributed to **context management and inter-agent information flow**, not longer reasoning |
| **AutoHarness** `2603.03329` | the model synthesises a code harness from environment feedback; at the limit, **the whole policy moves into code** and the LLM leaves the decision loop | prevents **all** illegal moves across 145 TextArena games; the code-policy beats much larger models |

**The AutoHarness motivation is the sharpest statement of why a harness exists at all**: "models often try to
perform actions that are not just suboptimal for a given state, but are **strictly prohibited by the external
environment**" - its example is that **78% of one model's chess losses were attributed to illegal moves**. A harness
is the layer that makes illegal moves unrepresentable rather than merely discouraged.

**What this means for us, in the three stages.** Our substrate already holds all three, which is not a coincidence -
the harness task built them for other reasons:

- **Weakness mining has its input.** The execution ledger (`~/.pi/agent/dove/workspaces/<hash>/execution.jsonl`),
  `tool.observed` records, typed stop reasons, the progress guard's fingerprints and the task-convergence snapshot
  are exactly "failure patterns from execution traces". **[LOCAL]**
- **Harness proposal has its object.** For this project the harness *is* the Markdown/YAML tree - mode files,
  specs, skills - which is the same claim §14.1 makes about the platform turn. A proposal is therefore an edit to
  a declarative artifact, not to the loop. **[LOCAL]**
- **Proposal validation has its gate.** `npm test`, the spec-context budget test and the reachability test are
  regression gates over the harness itself, and the reachability test already exists because "a module nothing
  reaches" was this project's founding defect. **[LOCAL]**

**The honest tension to record.** RHO's selection signal is the agent's **own self-preference**, with no external
grading, and it reports a large gain. Our own earlier research concluded that **judge self-preference is structural**
and that a generator cannot validate itself. Both can be true - RHO may be measuring the value of *self-consistency
across re-solves* rather than the value of self-judging - but the two claims cannot both be load-bearing in one
design, and the safer reading is the one our own synthesis already took: an oracle the generator does not control.

**And the maintenance half.** `2607.13285` **Harness Handbook** supplies the other end: as a harness evolves, the
bottleneck is **behaviour localization** - "a developer or coding agent must identify all code locations that
implement the target behavior", while "production harnesses are large, tightly coupled, and behaviourally
distributed". Their answer is a behaviour-centric representation synthesized by static analysis plus LLM structuring,
and **Behavior-Guided Progressive Disclosure (BGPD)**, which "guides agents from high-level behaviors to relevant
implementation details and **verifies candidate locations against the current source**". Reported effect: better
localization and edit plans **with fewer planner tokens**, largest on "scattered sites, rarely executed paths, and
cross-module interactions".

**That is this project's recurring defect, named.** Every finding this session had the same shape - a declaration
with no consumer, a field nothing reads, a rule that never fires - and each was found by hand. Behaviour
localization is the technique that would find them systematically.

## 10. A second frame, the field's own list of open problems, and the hardest empirical result **[FETCHED]**

### 12.1 `2605.18747` "Code as Agent Harness" (2026-05-18) - a survey, with the field's open problems

> "In emerging agentic systems, code is no longer only a target output. It increasingly serves as an **operational
> substrate** for agent reasoning, acting, environment modeling, and execution-based verification. We frame this
> shift through the lens of agent harnesses and introduce **code as agent harness**."

Its three layers: the **harness interface** (where code connects agents to reasoning, action and environment
modeling), **harness mechanisms** (planning, memory and tool use for long-horizon execution, "together with
feedback-driven control and optimization that make harness reliable and adaptive"), and **scaling the harness** from
single-agent to multi-agent ("shared code artifacts support multi-agent coordination, review, and verification").

**Its closing list of open challenges is a checklist for "把手脚架做清楚"**, quoted: "**evaluation beyond final task
success, verification under incomplete feedback, regression-free harness improvement, consistent shared state across
multiple agents, human oversight for safety-critical actions, and extensions to multimodal environments**." Three of
those six are this project's agenda: verification under incomplete feedback (our `unknown` outcome and the withdrawn
exactly-once claim), regression-free harness improvement (the reachability and budget tests), and human oversight for
safety-critical actions (the approval boundary).

### 12.2 `2608.15089` StateM (2026-08-15) - the hardest evidence for the goal's own thesis

The thesis under test: *improve the execution system around the model without changing the model*. StateM is "an
agent-native runtime that organizes execution around **durable states, phase-local context, checked transitions,
recoverable runbooks, and versioned procedural practices that agents and users can inspect together**".

Reported, on Terminal-Bench 2.1:

- GPT-5.5 xhigh **92.1%** versus an **83.1%** reference; GPT-5.6 Sol xhigh **95.3%** raw accuracy across 445 trials,
  succeeding on **all 89 tasks at least once**.
- "The **runbook transfers unchanged** to GPT-5.6" - the scaffold is model-independent.
- "The frozen profile raises GPT-5.6 Luna from 76.7 to 85.4%, above the 84.9% Sol xhigh reference" - a smaller model
  with the scaffold beats a larger model without it.
- "**less than $38 of adaptation** raises DeepSeek-V4 Flash from 82.7 to 88.1%"; "Final-score API usage is about
  **$15 versus $574.68** for the GPT reference."
- And the mechanism, in their words: StateM "turns **selected postmortem findings into persistent, executable
  preconditions and practices**, making learned controls **explicit and enforceable** through stateful controls."

**Why this matters here.** It is the same claim this project has been making structurally - code-owned enforcement
over prose - measured on a public benchmark, with a 9-point gain and a ~38x cost ratio, and with the scaffold
transferring across four model families. It also names the one loop we do not have: **postmortem findings becoming
executable preconditions** is weakness mining plus harness proposal, applied to controls.

**The uncomfortable overlap to record honestly.** StateM's five primitives - durable states, phase-local context,
checked transitions, recoverable runbooks, versioned procedural practices - are the same five things this project
calls the effect ledger, context admission, the gate, the checkpoint, and the specs and work modes. Two independent
efforts converging on one shape is corroboration; it is also a warning that our differentiation cannot be the shape
itself.

### 12.3 `2607.27652` Harness-G (2026-07-30) - the interface, not the reward, was the bug

An RL-search result with a transferable idea. The authors observe "**retrieval-equivalence collapse**": rollouts for
the same question keep generating different query strings while their evidence sets converge, "leaving within-group
returns with little effective retrieval contrast". Their fix is to redesign the **policy-environment interface** -
free-form query generation becomes **finite action selection**, where "the policy selects an evidence sentence or
entity, or chooses to answer, while **the environment constructs the menu, tracks retrieval state, and validates and
executes each choice**". Effect: best average F1 across six QA benchmarks, +10.74 points at 1.5B over the strongest
baseline.

**The transferable idea**: when a policy keeps producing equivalent-but-different actions, the fix is to make the
action space *finite and enumerated by the environment* rather than to reshape the reward. That is the same move as
a registry that decides what can be asked for - our capability registry is that menu, and the finding says the menu
belongs to the environment, not to the model's phrasing.




## 11. The eleven permission models, and the design space they define (§10) **[FETCHED]**

Read in full on 2026-09-27. This is subsystem 5 across the whole corpus, and it turns decision 2 into a menu with
evidence rather than a preference.

| System | Layers | Default | Isolation | Argument-level rules |
|---|---|---|---|---|
| Claude Code | 3: static hook rules → LLM permission classifier → interactive dialog | reads run; everything else asks | via Anthropic `sandbox-runtime`, opt-in | `PreToolUse` patterns |
| Codex | 4: Starlark execpolicy → lifecycle hooks → **Guardian** (LLM reviewer) → OS sandbox | sandbox-allowed runs; leaving it asks | **Bubblewrap / Seatbelt / Windows restricted tokens** | `prefix_rule(pattern=[...], match=[...], not_match=[...])`, `network_rule` |
| Gemini CLI | 4 approval modes + TOML sandbox policy | mode-set; `DEFAULT` asks per call with **once / always / reject** | **cross-platform, second sandboxer in the corpus** | shell-command validation with a core-tools allowlist |
| OpenHands | ensemble `SecurityAnalyzer` | policy object (`AlwaysConfirm`/`NeverConfirm`/`ConfirmRisky`) | pluggable runtimes | **shell-AST rails**: `fetch-to-exec`, `raw-disk-op`, `catastrophic-delete` |
| OpenCode | rules `{permission, pattern, action}`, last-match-wins | **`"*": allow` inside the project**; asks for `external_directory`, `.env`, doom loops | none ("sandbox" = git worktrees) | **tree-sitter parse + a ~130-entry arity dictionary**, e.g. `git commit *` |
| Mistral Vibe | 5 levels: profile ALWAYS/ASK/NEVER → tool validators → `hooks.toml` → session rules → dialog | profile-set (SAFE / NEUTRAL / DESTRUCTIVE / YOLO) | none (opt-in `--worktree`) | path pattern-matching; **read-only command allowlist** auto-approving `ls`/`cat`/`grep` |
| Hermes | policy-as-code at scale (3,200-line module) | profile-set | **zero** - six pluggable execution backends | **47 dangerous-command patterns on deobfuscated variants** |
| OpenClaw | scope-based authorization (`operator.read/write/admin/pairing`) | role/scope-set | gateway-enforced | per-method scope requirements; rate limits; SSRF policy |
| Pi | **one gate** (`tool_call` veto) + project trust | none: built-in tools run unconditionally | **extension-supplied** via `Operations` | none |
| Aider | interactive confirm only | confirm | none | none - but a three-stage lint reflection loop as implicit safety |
| Mini-SWE-Agent | step / cost / wall-clock limits, format-error cap | limits only | none | none |

**What the corpus settles, each with more than one implementation:**

1. **The default is a mode, never a constant.** Gemini CLI's `PLAN` / `DEFAULT` / `AUTO_EDIT` / `YOLO`; Mistral
   Vibe's SAFE / NEUTRAL / DESTRUCTIVE / YOLO profiles; Codex's collaboration-mode presets; Claude Code's permission
   modes. Every one of the eleven takes a position, and the position is user-selectable in the four provider-native
   systems. **Our `allow` constant is the outlier, not the norm.**
2. **A read-only class is the universal floor.** Gemini CLI's `PLAN` mode "the model sees the full tool list but can
   only invoke read tools"; Mistral Vibe's read-only command allowlist auto-approving `ls`/`cat`/`grep`; Claude
   Code's reads; OpenCode's `read` allow. Nobody asks about a read.
3. **Argument-level rules are the norm, not an extra.** Codex's `prefix_rule` with inline `match`/`not_match`;
   OpenCode's tree-sitter parse plus arity dictionary; OpenHands' shell-AST rails; Hermes' deobfuscated patterns.
   **We match names only, which the corpus would classify as the weakest form.**
4. **The policy file carries its own test cases.** Codex's rules "may carry inline `match` / `not_match` examples
   that are **validated at parse time - executable test cases inside the policy file**". This is directly
   applicable to our mode files, which declare rules and test them somewhere else.
5. **Fail-closed is the contract everywhere it is stated.** OpenHands' ensemble fuses "**worst-case-wins**, with
   broken child analyzers **failing closed to HIGH**"; Codex's Guardian "**fails closed on timeout or malformed
   output**"; OpenCode's v2 engine "**headless runs auto-reject all asks**". We already do this; the corpus agrees
   and states it as a rule.
6. **A floor beneath the bypass.** Hermes' "twelve-pattern hardline floor (`rm -rf /`, `mkfs`, `dd` to block
   devices, fork bombs, shutdown) that **survives `--yolo`** - the YOLO environment variable is **frozen at module
   import** precisely so a prompt-injected skill cannot flip it at runtime". Rec 11's concrete form.
7. **Deobfuscation is what makes a name-based rule hold.** Hermes matches its patterns on "deobfuscated variants
   (quote-splice removal, command-substitution folding, command-position anchoring)" - the direct answer to the
   evasion paper's "encode prohibited commands".
8. **Tool availability itself can be permission-derived.** OpenCode: "denying `"*"` for a tool **removes it from
   the LLM's view entirely** - tool availability itself is permission-derived." Stronger than blocking at call time:
   the model cannot attempt what it cannot see. Our host exposes `getActiveTools` / `setActiveTools`.
9. **Denial tracking and circuit breakers.** Claude Code "counts permission refusals per session; after N denials,
   the system **falls back to prompting**", with per-agent local denial state; Codex's Guardian carries "a per-turn
   rejection circuit breaker". We have neither.
10. **Two absences the paper calls out that we do *not* have**: Hermes ships "**no per-tool allow/ask/deny matrix,
    no append-only audit log**". We have both. That is worth knowing before we redesign them.

**Observation 6 from §10, which reframes decision 1:** "OS-level sandboxing is one of the **most code-expensive
capabilities in the corpus, and it is a choice rather than a consequence of scale**." Hermes, one of the largest
systems, ships **zero** OS isolation and spends its safety budget on *content-borne* threats instead; OpenCode is
**policy-only**; Pi documents the refusal as a security argument. So isolation is one of three strategies, not the
only one - and the other two (content-borne defence, syntax-aware policy) are cheaper.

## 12. The platform turn, and where our Markdown-tree design sits (§14) **[FETCHED]**

> "The standard reading of the absence of LangChain, AutoGen and the rest is that production harnesses do not need
> frameworks. But there is a second reading: **they do not need frameworks because the harness is itself the
> framework** ... The difference is that the 'framework' is **not a library the developer imports into their code;
> it is a runtime the developer works inside of**. The developer's 'program' is a **natural-language task plus a
> tree of Markdown files** (CLAUDE.md, AGENTS.md, GEMINI.md, SKILL.md) that configure the agent's behavior, tool
> access, and domain knowledge. **The 'API' is the filesystem, the terminal, and git.**"

And on our host specifically: "**Pi matches every element but MCP, which it pointedly rejects in favor of CLI tools
plus its extension bus.**"

**What this means for us.** Our `.trellis/` specs, `modes/*` governance, and `.dove/` state *are* the platform
turn's "program as a tree of Markdown files" - and the paper's own framing says the program is the configuration
surface, not the code. That makes the mode files a **product surface**, not an implementation detail: they are what
a developer writes to program the agent. It also means Pi's rejection of MCP is deliberate and ours to inherit,
not a gap to close.

## 13. The frame that groups everything: Plan, Execute, Verify - and the loop over it **[FETCHED]**

`2605.18747` §3.4 names the loop this project has been circling: **PEV - Plan, Execute, Verify**. Read together with
§3.5 it groups every decision in `decisions.md` and adds one item that was not on the list.

### 13.1 Plan is contract formation, and the contract must be an artifact

> "The planning phase turns a user request into an **explicit contract over the next state transition**. A robust
> plan does more than decompose the request into implementation steps; it also identifies relevant files, expected
> invariants, validation commands, rollback points, and risky operations. **This makes planning a harness artifact
> rather than an unobserved reasoning trace.** ... it constrain[s] the subsequent action space by specifying **which
> components may be read, which files may be edited, and which verification criteria must be satisfied before
> completion**." And: "the PEV framing also clarifies **why planning and debugging should not be separated: failed
> verification updates the plan, while the plan determines which verification evidence is meaningful**."

**Ours.** This is the Trellis layer: `prd.md` and `implement.md` are the contract, `implement.jsonl` / `check.jsonl`
are literally "which components may be read", and the convergence criteria are "which verification criteria must be
satisfied before completion". So the Plan phase is the one this project has done most thoroughly - and the survey's
claim that it must be an *artifact* rather than a reasoning trace is the same claim this project makes when it
refuses to let a plan live only in the model's context. **[LOCAL]**

### 13.2 Execute must be sandboxed *and* permissioned, in tiers

> "The sandboxed environment is the operational substrate of the loop... **Sandboxes also improve reproducibility**
> because the harness can replay the same patch, command, seed, dependency lockfile, or test configuration under
> comparable conditions. **Without this stable substrate, verification signals become difficult to interpret, and
> failures may reflect environment drift rather than program defects.**" And: "**Execution must also be
> permissioned. A multi-tier model separates low-risk observation from high-risk action: a read-only tier** supports
> repository browsing, retrieval, static inspection, log analysis; **a sandbox-edit tier** supports local patching,
> test execution, temporary dependency installation inside an isolated workspace; and **a full-access tier** covers
> network access, credentials, deployment..."

**Ours, and this is the sharpest mapping in the whole survey.** The three tiers are **the mode format's own fields**:
`filesystem: read-only-source` / `ephemeral` is the read-only tier, the sandbox-edit tier is what a workspace with
write access is, and `network: allowlist` / `none` is the full-access boundary. Every shipped mode already declares
the tier - and nothing reads it (inventory #6). So the survey's tier model is not a new design to adopt; it is a
**name for what our mode files already claim and do not enforce**. And its reason for sandboxes is the one that
matters most here: **without a stable substrate, a failure may be environment drift rather than a program defect** -
which is exactly the ambiguity our verification ladder cannot resolve today. **[LOCAL]**

### 13.3 Verify is deterministic sensors, and critique interprets them

> "**Compilation and static-analysis feedback provide low-cost sensors** before full execution... **Runtime signals**
> expose failures that only arise along concrete execution paths... **Test-based feedback** then evaluates whether the
> observed behavior satisfies the intended specification... **Evaluation harnesses broaden this idea from a single
> test command to repeatable task distributions**: they encode evaluator logic, simulation hooks, red-team cases, or
> RL-style environments that can **compare harness variants under controlled conditions**. Compared with
> natural-language critique, **these sensors are deterministic or at least reproducible enough to serve as control
> signals. Human or agentic critiques remain useful when failure evidence is sparse, but in a governed PEV loop they
> should interpret sensor outputs rather than replace them.**"

**Ours.** The ladder plus the exit-status requirement is the sensor half, and the last sentence is the rule this
project reached the hard way - an execution oracle, not a judge - stated by the survey as a requirement rather than
as a preference. The **evaluation-harness** clause is the item that was not on our list: comparing *harness variants*
under controlled conditions is how D1-D5 would be decided with evidence instead of by argument, and it is the one
thing this project has no version of. **[LOCAL]**

### 13.4 The loop over the loop is legitimate only when governed

> §3.5.1 **Deep Telemetry as the Optimization Substrate**: "structured traces that connect model decisions, harness
> actions, environment states, and outcomes... records the decision process in greater detail: prompts and retrieved
> context, token usage and cost, model/tool latency, tool arguments, **permission requests**, edited files, sandbox
> snapshots, command outputs, test results, stack traces, lint warnings, **branch decisions, rejected alternatives,
> human interventions**, and final task outcome."
>
> §3.5.3 **Governed Harness Mutation**: "AHE should not be confused with unconstrained self-modification. Because the
> Evolution Agent changes the harness that controls later task agents, its actions require **stronger governance than
> ordinary code repair**. Candidate harness changes should be **evaluated inside sandboxes, compared against fixed
> regression suites, and recorded with auditable rationales. Changes that alter permission boundaries, network
> access, credential handling, deployment behavior, or human-review requirements should require HITL approval**
> before activation."

**Ours.** The ledger is close to deep telemetry already - tool arguments, permission requests, command outputs, test
results, human interventions - and the survey names the gaps: **sandbox snapshots** (there are none), **branch
decisions** and **rejected alternatives** (a refused action is recorded, but not the alternative the model then
took). And §3.5.3 is D5's governance condition stated as a rule: the optimization loop must be sandboxed, regressed,
and **escalate permission-boundary changes to a human** - which is D1/D2's subject matter, so D5 depends on D1 and D2
rather than preceding them. **[LOCAL]**

### 13.5 What the frame does to the five decisions

| Phase | Decisions |
|---|---|
| **Plan** (contract as artifact) | done most thoroughly here - and the survey says why it matters, not that it needs work |
| **Execute** (sandboxed + permissioned) | **D1** (the sandbox block is inert), **D2** (the permission list decides nothing), **D4** (the declared constraints cannot fire) |
| **Verify** (deterministic sensors) | **D3** (the link from criterion to sensor is recorded nowhere) |
| **The loop over the loop** (governed mutation) | **D5** (the detector half first) - and it **depends on Execute**, because governed mutation must escalate permission-boundary changes |
| **not on the list** | **an evaluation harness**: repeatable task distributions that compare harness variants. It is the survey's own addition to Verify, and the mechanism by which the other decisions could be settled with evidence |

So the ordering the survey implies is not the ordering I proposed: **Execute before the loop over it**, and the
evaluation harness is the thing that would make the rest measurable. That is a sixth decision, and it is recorded in
`decisions.md` as D6 rather than folded into D3, because it compares harness variants while D3 verifies one run.

## 14. The practitioner's guide in full (§16), and the two numbers that set our expectations **[FETCHED]**

Section 5 covered only §16.6 (safety) and §16.9 (anti-patterns). The rest of §16 is the paper's prescriptive half -
18 recommendations, each citing the observations behind it - and reading it whole changes two things: it tells us
which parts of our scaffold are already at the frontier, and it tells us what the frontier thinks the scaffold is
*for*.

### 14.1 The recommendations, sorted by whether they are already true here

**Already true (do not touch).**

- **Rec 1, start linear; graduate to a middleware pipeline only when orthogonal turn policies emerge.** Our loop is
  the host's; our turn policies (`action-policy`, `dispatch-policy`, the mode gates) are separate modules, which is
  the middleware shape reached without a pipeline class.
- **Rec 6, auto-discover hierarchical Markdown context.** "all eleven systems that manage repo context converged on the
  pattern, and the newest ones read multiple conventions" - Hermes reads its own file then `AGENTS.md`, `CLAUDE.md`,
  `.cursorrules`. Ours is `AGENTS.md` plus `.trellis/`.
- **Rec 7, threshold compaction below the window with a verbatim recent tail and incremental merging.** The host owns
  compaction; Pi passes the previous summary back for merging, which the paper singles out as the pattern that
  "preserves early decisions that from-scratch re-summarization loses".
- **Rec 8, do not build RAG over code.** "0/11 systems use vector embeddings for code retrieval"; use ripgrep, glob,
  tree-sitter, traversal.
- **Rec 11, codify safety rules as data or dedicated policy files rather than imperative code - and keep a floor
  beneath YOLO.** Codex's Starlark `execpolicy` "with parse-time-validated inline examples", Gemini CLI's per-mode
  TOML, OpenCode's rulesets; and Hermes's "twelve hardline patterns survive `--yolo`, with the bypass flag frozen at
  module import so injected content cannot flip it at runtime". **This is the recommendation our mode files are already
  shaped for and currently fail to satisfy** - see 14.3.
- **Rec 15-18, the anti-patterns.** No agentic framework ("0/11 production harnesses in the corpus use these
  frameworks - Gemini CLI skips Google's own"); no vector layer for code; no 1-to-1 SaaS tool wrappers; do not
  over-engineer stuck detection but "do ship the cheap caps, which cost a dozen lines".

**Not applicable, with the reason.**

- **Rec 2, provider coupling.** A multi-provider substrate can reach the whole optimisation menu "by paying the
  per-provider conditional-code cost deliberately and centrally"; what it cannot reach is the vendor's server-side
  update loop. That is the host's position and ours.
- **Rec 12/13, multi-agent and ACP.** "Keep your own sub-agents in-process"; our `agent_subagent` already is. ACP is
  a host decision.
- **Rec 14, Skills over MCP.** The paper's own resolution: skills lead MCP 9/11 vs 8/11, and "Pi demonstrates the
  defensible minimal position (skills plus CLI tools with READMEs, no MCP)".

**Applicable and not yet done - and this is a local measurement, not a quote.**

- **Rec 4, deferred tool loading above ~15 tools.** "Claude Code's shouldDefer flag + ToolSearchTool reduces the
  initial prompt by ~40%; Codex independently converged with `defer_loading` flags plus a BM25-ranked `tool_search`;
  Hermes collapses overflowing MCP catalogs into three BM25-searched bridge tools once schemas would exceed 10% of the
  context window. Below ~15 tools the indirection is not worth the added complexity."

  **[LOCAL, measured 2026-09-27]** Two numbers, both taken by running the code rather than reading it.

  *Count.* `src/pi-adapter/extension.ts` calls `pi.registerTool` **13 times**, all unconditional and at the top level
  of the extension body: `agent_project_task`, `agent_subagent`, `agent_run_capability`, `agent_task_convergence`,
  `agent_list_capabilities`, `agent_run_recipe`, `agent_doctor`, `agent_project_status`, `agent_project_context`,
  `agent_workspace_snapshot`, `agent_workspace_verify`, `agent_workspace_restore`, `agent_workspace_patch`. And
  `tests/fixtures/representative-tool-catalog.ts` - "Representative installed Pi catalog captured by the middleware
  E2E probe" - holds **57 unique tool names**, asserted by `tests/tool-profile.test.ts:8`. Verified independently:
  `node --import tsx -e "import('./tests/fixtures/representative-tool-catalog.ts').then(m => console.log(m.representativeTools.length, new Set(m.representativeTools).size))"`
  -> `57 57`. So the model's tool surface is **57 schemas**, four times the paper's threshold - not the ~21 I first
  wrote, which counted only our 13 plus the host's eight-name core union and missed every other installed extension.
  **Withdrawal:** the ~21 figure was an arithmetic claim I published without running the fixture. Corrected above.

  *Bytes.* Registering the extension against a mock host and serializing what it registers gives
  **5,476 bytes** across the 13 schemas (the estimator in `model-gateway.ts:262` charges 0.25 per ASCII char, so
  ~1,370 tokens). The distribution is the interesting part: **`agent_task_convergence` alone is 1,753 bytes - 32% of
  our whole tool-schema budget** - and the rest are 341-486 bytes each.

  **What the two numbers say together.** The count criterion fires (57 > ~15), but our own share of the prompt cost is
  small, and one tool carries a third of it. So the cheapest action is **not** deferred loading for our thirteen tools;
  if anything it is a look at why one schema is five times the size of its siblings. And the count that matters for
  Rec 4 is the whole 57-tool payload, which this measurement does not cover - that number is already recorded per
  request as `providerToolSchemaBytes` in the ledger (`execution-ledger.ts:292`), so it is readable from any real
  session. **This is the first recommendation in the whole study that applies to us, is not already satisfied, and
  needed a measurement rather than a design** - and it is not on the D1-D6 list.
- **Rec 3, start with bash and add tools only in response to observed failure modes.** The corollary of the above: our
  thirteen tools are capability entry points, not failure-mode responses. Whether that is a defect depends on whether
  each one earned its place, which is a question about the ledger, not about the literature.

### 14.2 What the scaffold is for - the two numbers that bound our expectations

Axis 5: "Mini-SWE-Agent's competitive benchmark performance demonstrates that current models are capable enough to
succeed with minimal scaffolding. **Production systems invest in scaffolding not because models need it for task
completion, but because users need it for safety, reliability, and workflow integration.**"

Observation 13 sharpens it: the 90-line scaffold in Listing 3 "implements 10 of the 18 recommendations directly and is
compatible with the remaining eight... with no framework dependencies, no RAG, no vector store, no multi-agent
orchestration, and no sandbox", and the authors "conjecture, without proof, that this scaffold running on a frontier
model would match Mini-SWE-Agent's SWE-Bench numbers, and that moving beyond those numbers is primarily a
**model-capability question (Observation 5) rather than a scaffold question**". §15.5's curve says the same: the
scaffold plateau is where "work pays off in operational concerns".

**What this means for us.** Every item on the D-list is an *operational* item - enforcement, governance,
verification, measurement. Not one of them is expected to raise task-completion quality. That is not a weakness of
the list; it is the paper's own account of what the scaffold layer is for, and it is the strongest available
justification for spending the next stretch of work on enforcement rather than on loop cleverness. **[LOCAL]**

### 14.3 The finding that names our defect better than we did

§14.5, "Policy migrated out of prose": "Codex's newest model prompts dropped the no-commit and anti-gold-plating rules
in favor of feature flags; Mistral Vibe deleted its 'Never Commit' hard rule and re-founded its prompt on a
seven-level precedence contract, A/B-tested server-side; OpenHands teaches commit mechanics. As models internalize
norms and harnesses grow governance surfaces, **behavioral policy is moving from the prompt (where the model reads
it) to configuration (where the platform enforces it)**."

**Ours, exactly.** Our three modes carry `permissions.yaml`, `governance.yaml`, `scope.exclusions`,
`authority.expires`, `gate.*` and a `sandbox` block - policy in configuration - and the inventory shows the runtime
reads almost none of it. So we are not behind the field's direction; we are **halfway through the move it names, in the
direction it names, with the enforcement half missing**. That is a better description of the defect than "inert
declarations": the declarations are the *arrival* of policy into configuration, and what is missing is the platform
that enforces it. It also predicts what happens if we do nothing: the field's models are internalising the norms, so a
prose-level rule we do not enforce is a rule we will progressively stop being able to rely on. **[LOCAL]**

## 15. The platform turn's economics, the meta-harness policy plane, and the paper's own limits **[FETCHED]**

### 15.1 The turn is a thesis now, not a hypothesis

§14.1: "The standard reading of the absence of LangChain, AutoGen, and the rest (Observation 13.2) is that production
harnesses do not need frameworks. But there is a second reading: **they do not need frameworks because the harness is
itself the framework**." Four signals: skills as declarative programs ("a program written for an LLM runtime rather
than for a CPU runtime... the programming language is English plus YAML frontmatter"); hooks and event buses as the
extension substrate (9/11 systems; "Pi is an event bus, with ~33 typed events spanning tool interception to raw
provider I/O"); the disappearing boundary between tool and workflow ("the agent loop is the workflow engine"); and
the harness as a service surface ("a runtime with clients, SDKs, and hosted tiers is not a tool with an ecosystem; it
is a platform with distribution").

§14.2 is the part we had not read, and it is the part that says what happens to a project like ours: **the two artifact
categories merged, from both directions.** Harness → framework: Claude Agent SDK ("Claude Code as a library"),
`openai-codex`, the OpenHands agent SDK, "Pi packages / OpenCode SDK - `pi-agent-core` importable + RPC mode". Framework
→ harness: LangChain's Deep Agents, Pydantic AI Harness, Strands `harness-sdk`. The paper's conclusion: "harnesses did
not adopt the frameworks; they replaced them, became importable themselves, and turned the question 'which agentic
framework should I use?' into 'which harness do you already run?'" And the validation: "when LangChain, the framework
whose absence from every harness runtime Observation 13.2 documents, finally built a harness, it independently adopted
the corpus's conventions (SKILL.md progressive disclosure, AGENTS.md memory, sub-agent spawning, todo planning)".

**What this means for us.** Our host's extension bus *is* the framework seam, and our `.trellis/` tree *is* the
conventions the merger converged on. So the correct reading of "be the synthesis of the frontier" is not "adopt a
framework" - the field's answer is the opposite - it is "be a well-formed program for the runtime", which is what a
mode file plus a task tree already is. **[LOCAL]**

### 15.2 The meta-harness, and the one concrete design it hands us

§14.4 describes Omnigent, and two of its features bear directly on our decisions.

**Its cross-harness policy plane.** "one three-level policy plane (session → agent → admin; **six phases**; CEL,
Python, or LLM-classifier evaluators; cross-session per-user budgets) enforced on foreign harnesses through each
vendor's own extension mechanism - Claude Code hooks, Cursor hooks, Hermes hooks, ACP permission requests - **with
fail-closed semantics**".

**Its uniform sandbox and egress stack.** "bubblewrap-plus-seccomp on Linux, generated Seatbelt profiles on macOS,
**Job Objects on Windows** - the same architecture the corpus documents inside Codex, re-implemented at the meta-layer,
plus an L7 MITM egress proxy (own CA, per-host rules, default-deny) hosting a secretless credential proxy, where real
tokens never enter the sandbox and synthetic placeholders are swapped for credentials in flight."

And the restraint is as informative: "sandboxing is applied inconsistently by design (it exec-wraps the Claude CLI in
its own sandbox but delegates to Codex's native sandbox modes), evidence that **OS-level isolation resists being
factored out as a shared service**."

**What this means for us.** Two things. (1) **`fail-closed` is the field's stated semantics for a policy plane, and
our loader already refuses rather than defaults** - so the mode-loader refusals are the right shape, and D2's
"`unlisted` must be declared" is the same rule applied to the one field that currently defaults. (2) A policy plane is
described as having **levels and phases**, which is a vocabulary our `gateSemantics`/`permissions` pair does not have;
if D2 wants to be the frontier's shape rather than a local invention, levels (who is asking: session / agent / admin)
and phases (when in the turn the check runs) are the two axes to name. (3) **Windows isolation is Job Objects**, which
is the concrete answer to D1's cheapest-step question if D1 ever moves past "delete the claim". **[LOCAL]**

### 15.3 §15.3 falsified a correlation we might have leaned on

"The April edition observed that the corpus's two largest systems... were also its two cross-platform sandboxers, and
read the correlation as structural. **The expanded corpus falsifies the structural reading while preserving the cost
claim**: Hermes and OpenCode are comparably large with zero OS-level isolation, spending their safety budgets on
content-borne threats and permission granularity respectively."

**Why it matters here.** It removes the argument "we are small, so of course we have no isolation" and replaces it
with the one the paper actually makes: isolation is "a choice rather than a consequence of scale", and the honest
alternatives are content-borne defence (Hermes) or permission granularity (OpenCode). Our mode files already claim the
Codex/Gemini shape (`isolation: container`, `network: allowlist`) while implementing neither, which is the one
position the corpus does not contain. **[LOCAL]**

### 15.4 D6 is the field's open problem, not the field's practice

§17.2 lists as **future work**: "**Unified evaluation frameworks that assess safety, user experience, cost efficiency,
and extensibility alongside correctness**, addressing the gap between benchmark performance and production
readiness"; "**Formal verification of safety policies for policy-as-code systems, establishing guarantees about what
agent actions are permitted under given policy configurations**"; "**Cross-system benchmark suite** that runs
identical tasks across all eleven systems under controlled conditions"; and "Longitudinal continuation".

**This is a correction to D6's framing.** I wrote that the AHE ablation numbers prove the instrument exists; they prove
it exists *for task quality*. The instrument D6 actually wants - safety, cost, extensibility, and the gap between
benchmark and production readiness - is listed by the paper that studied all eleven systems as work it did not do and
does not know how to do. So D6's honest status is: **the frontier's top open problem, not the frontier's practice.**
That does not weaken the recommendation ("do not build it now" was already the answer); it changes the reason, and it
means D6's first version should be scoped to something measurable rather than to "harness quality". The cheapest such
thing is the one already identified: the flipped gap tests. **[LOCAL]**

### 15.5 The paper's own limits, recorded so we do not over-claim

§15.6, in its own words: "The analysis rests on **source-code reading, not runtime measurement**. We do not claim to
know how fast any of these systems are; we claim to know how they are structured." "The qualitative scoring underlying
the architectural comparisons **involves judgment calls**." "The Claude Code analysis is **the weakest link on
reproducibility**" - a March 2026 public snapshot, not an official release. "The framework-absence finding... is strong
but **structurally conservative**" - manifests and import greps, twice, but no dynamic-import or transpiled-distribution
tracing. And: "We also compared each system independently rather than running all eleven on a shared task set."

**How this constrains our citations.** Every quantitative claim we have taken from this paper is either the systems'
self-reported benchmark numbers or the authors' own architectural scoring - and the AHE ablation numbers in §15.5 come
from a *different* paper (Lin et al., `2603.03329`), which is why they are the strongest evidence we hold and the
corpus study is the weakest on numbers. So: the anatomy, the permission models, the absences and the merger are safe
to build on; the percentages are illustrative. **Nothing in D1-D6 rests on a percentage**, which is the check that
matters. **[LOCAL]**

### 15.6 Two catalog entries we should recognise ourselves in

§13.1's 29-pattern catalog, the twelve new to the July corpus, includes **Outer Verification Loop** ("scaffold-level
judge/guard validating completion, outside the turn loop" - OpenHands's `/goal` judge + critics, Hermes's
verify-on-stop), **Policy-as-Code**, **Syntax-Aware Command Permissioning** ("commands parsed (tree-sitter) and grants
scoped by argument arity" - OpenCode; Mistral Vibe parse-validation; Hermes deobfuscated matching), **Untrusted-Content
Delimiting** ("tool/web results wrapped in taint markers with delimiter defanging"), and **Minimal-Core /
Extension-Host** ("safety, sandbox, sub-agents, plan mode relocated to a runtime event bus" - Pi).

Two consequences. **Outer Verification Loop is the name for what our convergence criteria are trying to be**, and it is
a *pattern* in the catalog rather than an invention - which means D3's work is to complete a known pattern, not to
design one. And **Syntax-Aware Command Permissioning is the answer to the objection that permission lists cannot be
enforced**: OpenCode parses commands with tree-sitter and scopes grants by argument arity, with a ~130-entry arity
dictionary; Hermes deobfuscates 47 patterns; Mistral Vibe parse-validates. So "we cannot enforce `never_allow:
[shell.exec]` without a shell parser" is false in the corpus's terms - three systems do exactly that. **[LOCAL]**




