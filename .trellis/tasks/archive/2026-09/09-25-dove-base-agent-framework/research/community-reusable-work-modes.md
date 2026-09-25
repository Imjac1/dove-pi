# Reusable agent work modes in the wild (GitHub-first survey)

- **Query**: How are reusable agent "working modes" actually packaged, versioned, and shared?
  What is the smallest reusable artifact, what pinning mechanisms exist, and does sharing
  actually produce reuse or just forks?
- **Scope**: GitHub as primary source. Declarative agent-definition formats (Claude Code
  subagents/skills/commands/plugins, OpenAI Agents SDK, Google ADK, LangGraph, CrewAI, Agno,
  Mastra, Pydantic-AI), awesome-list catalogues, versioning/sharing mechanisms, and failure-mode
  issues/discussions.
- **Date**: 2026-09-25. All repos cloned or fetched at HEAD on this date.
- **Method**: `web_search` was unavailable for the whole session (Firecrawl keyless tier returned
  HTTP 429 on every engine), so discovery ran through the GitHub REST search API
  (`/search/repositories`, `/search/issues`), `raw.githubusercontent.com`, and shallow clones of
  the corpora, which were then parsed locally with Node. Claude Code facts come from
  `code.claude.com/docs/*.md` (the mintlify markdown endpoints) fetched directly.
  Claimed behavior is cited to a URL or to a file that was actually parsed; anything else is
  labelled unverified.

---

## 1. Declarative agent-definition formats that real projects use

### 1.1 Claude Code subagents — `.claude/agents/*.md` (also plugin `agents/*.md`)

Source: https://code.claude.com/docs/en/sub-agents.md (v2.1.x docs, fetched 2026-09-25).
Verbatim from the *Frontmatter reference* section: "Only `name` and `description` are required.
Multi-word field names use camelCase ... Claude Code ignores a field it doesn't recognize without
reporting an error."

| Field | Required | Meaning |
|---|---|---|
| `name` | yes | unique id; filename need not match; cannot contain `:` (reserved for `plugin:agent`) |
| `description` | yes | when Claude should delegate to it; this is the text that costs context on every session |
| `tools` | no | comma-separated string or YAML list; omitted = inherit everything subagents can use |
| `disallowedTools` | no | deny list, removed from inherited/specified list |
| `model` | no | `sonnet` / `opus` / `haiku` / `fable` / full id / `inherit` |
| `permissionMode` | no | `default` / `acceptEdits` / `auto` / `dontAsk` / `bypassPermissions` / `plan` / `manual` |
| `maxTurns` | no | turn budget; on hit, output is marked partial and can be resumed |
| `skills` | no | skills preloaded into the subagent's context at startup (full body, not just description) |
| `mcpServers` | no | server names or inline configs; ignored for plugin subagents |
| `hooks` | no | lifecycle hooks scoped to the subagent; ignored for plugin subagents |
| `memory` | no | `user` / `project` / `local` — cross-session learning |
| `background` | no | force background execution |
| `omitClaudeMd` | no | skip user/project/local CLAUDE.md |
| `effort` | no | `low` / `medium` / `high` / `xhigh` / `max` |
| `isolation` | no | `worktree` — run in a temporary git worktree |
| `color` | no | UI only |
| `initialPrompt` | no | auto-submitted first user turn when the agent is the main session agent |
| `experimental.cacheTtl` | no | `5m` / `1h` prompt-cache lifetime |

Loading rules that matter for reuse: a file with no `name` is treated as documentation and
silently skipped; `---` must be the first line; an unparseable frontmatter skips the file and only
logs to the debug log. Plugin subagents with no `name` still load under their filename.

Real file (wshobson/agents, `plugins/operating-kit/agents/code-review-preshipment.md`):

```yaml
---
name: code-review-preshipment
description: Comprehensive pre-ship review of all changes since the last deploy or a specified
  commit. ... Ends with a SHIP / SHIP WITH FIXES / DO NOT SHIP verdict.
model: sonnet
tools: Bash, Read, Glob, Grep
---
You are this project's pre-ship code reviewer. ...
```

Real file (VoltAgent/awesome-claude-code-subagents, `categories/04-quality-security/security-auditor.md`):

```yaml
---
name: security-auditor
description: "Use this agent when conducting comprehensive security audits, compliance
  assessments, or risk evaluations ..."
tools: Read, Grep, Glob
model: inherit
---
```

### 1.2 Agent Skills — `SKILL.md` (the only cross-vendor standard)

Spec: https://agentskills.io/specification (markdown endpoint `/specification.md`; the
`anthropics/skills` repo's `spec/agent-skills-spec.md` now just links here).

| Field | Required | Constraints |
|---|---|---|
| `name` | yes | <=64 chars, lowercase/digits/hyphens, no leading/trailing/double hyphen, **must equal the parent directory name** |
| `description` | yes | <=1024 chars, must say what it does *and* when to use it |
| `license` | no | name or reference to a bundled license file |
| `compatibility` | no | <=500 chars, environment requirements |
| `metadata` | no | string-to-string map, free-form (this is where third parties put `version`) |
| `allowed-tools` | no | space-separated pre-approved tools, marked **experimental** |

Directory convention: `SKILL.md` + optional `scripts/`, `references/`, `assets/`. Progressive
disclosure is part of the spec: metadata (~100 tokens) always loaded, body (<5000 tokens
recommended, <500 lines) on activation, resources on demand. Validation via `skills-ref validate`.

Claude Code extends the standard (https://code.claude.com/docs/en/skills.md) with:
`when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`,
`disallowed-tools`, `model`, `effort`, `context: fork`, `agent`, `background`, `hooks`,
`paths`, `shell`. Note the docs statement that a field name "must match the table exactly,
hyphens included: Claude Code ignores a field it doesn't recognize without reporting an error."

Real file (anthropics/skills, `skills/webapp-testing/SKILL.md`):

```yaml
---
name: webapp-testing
description: Toolkit for interacting with and testing local web applications using Playwright.
  Supports verifying frontend functionality, debugging UI behavior, ...
license: Complete terms in LICENSE.txt
---
```

### 1.3 Slash commands — effectively merged into skills

Claude Code docs: "**Custom commands have been merged into skills.** A file at
`.claude/commands/deploy.md` and a skill at `.claude/skills/deploy/SKILL.md` both create
`/deploy` ... A command file in `.claude/commands/` accepts the same fields except `name` and
`paths`." Command files are the older format; skills supersede them.

### 1.4 Plugins and marketplaces — the packaging/versioning layer

- `plugin.json` (https://code.claude.com/docs/en/plugins/manifest-reference.md): **only `name`
  is required.** Full field list includes `displayName`, `version`, `description`, `author`,
  `homepage`, `repository`, `license`, `keywords`, `defaultEnabled`, `dependencies`,
  `metadata`, plus component keys `skills`, `commands`, `agents`, `hooks`, `mcpServers`,
  `lspServers`, `outputStyles`, `userConfig`, `experimental`. Unknown top-level keys are
  stripped with a warning; unknown keys inside strict objects are hard errors.
- `marketplace.json` (https://code.claude.com/docs/en/plugins/marketplace-reference.md): root
  `name`, `owner`, `description`, `allowCrossMarketplaceDependenciesOn`, `renames`, and
  `plugins[]` where each entry carries `name`, `source`, `description`, `version`, `author`,
  `category`, `keywords`, `dependencies`.
- Real marketplace entry with a **pinned source** (Anthropic's official marketplace,
  `anthropics/claude-plugins-official`, `.claude-plugin/marketplace.json`):

```json
{
  "name": "42crunch-api-security-testing",
  "category": "security",
  "source": {
    "source": "git-subdir",
    "url": "https://github.com/42Crunch-AI/claude-plugins.git",
    "path": "plugins/api-security-testing",
    "ref": "v1.5.5",
    "sha": "faf5305385de8afed9468904e8639be737aff39e"
  }
}
```

  Key-frequency across that one file (truncated at 100 KB by the fetcher, so counts are
  lower bounds): `source` 306, `name` 298, `description` 171, `category` 161, `homepage` 160,
  `sha` 137, `author` 126, `path` 51, `ref` 50, `version` 7. **The pin is the SHA, not the
  version string.**
- The same file carries a top-level `renames` map (`{"adlc": "agentforce-adlc", "convex-backend":
  "convex", ...}`) — an explicit acknowledgement that renaming a plugin is a breaking change.

### 1.5 Dynamic workflows

https://code.claude.com/docs/en/workflows.md — "Dynamic workflows orchestrate many subagents
from a script Claude writes and you can rerun." This is orchestration-as-code (a script), not a
declarative manifest; relevant because it is the escape hatch when the declarative surface is not
enough. `/workflow-authoring` is a bundled skill available only when the feature is enabled.

### 1.6 OpenAI Agents SDK (Python/TS)

Source: https://raw.githubusercontent.com/openai/openai-agents-python/main/docs/agents.md

| Property | Required | Notes |
|---|---|---|
| `name` | yes | human-readable |
| `instructions` | no (strongly recommended) | string or dynamic callback |
| `prompt` | no | Responses-API prompt object with `id`, `version`, `variables` — platform-hosted, versioned prompt |
| `handoff_description` | no | description shown when this agent is a handoff target |
| `handoffs` | no | delegation targets |
| `model`, `model_settings` | no | model + tuning |
| `tools`, `mcp_servers`, `mcp_config` | no | capabilities |
| `input_guardrails`, `output_guardrails` | no | policy gates |
| `output_type` | no | structured output |
| `hooks` | no | lifecycle callbacks |
| `tool_use_behavior`, `reset_tool_choice` | no | loop control |

Note `prompt: {"id": "pmpt_123", "version": "1", "variables": {...}}` — the SDK's own answer to
"pin a reusable prompt so it does not silently change" is a hosted prompt id + version.

### 1.7 Google ADK

Source: https://raw.githubusercontent.com/google/adk-docs/main/docs/agents/llm-agents.md —
`name` (required), `description` (optional but recommended for multi-agent routing), `model`
(required), `instruction` (string or function), tools, sub-agents, output schema/key,
`generate_content_config`, planner.

ADK also ships a declarative **Agent Config** YAML
(https://raw.githubusercontent.com/google/adk-docs/main/docs/agents/config.md), explicitly labelled
*Experimental*, Python 1.11.0 / Java 0.3.0 / Go 0.3.0, Gemini-only:

```yaml
name: assistant_agent
model: gemini-flash-latest
description: A helper agent that can answer users' questions.
instruction: You are an agent to help answer users' various questions.
```

### 1.8 LangGraph — code-first, with a deployment manifest only

LangGraph does not have a declarative agent format. `langgraph.json` is a *deployment* manifest.
Real files (langchain-ai template repos):

```json
{ "$schema": "https://langgra.ph/schema.json",
  "dependencies": ["."],
  "graphs": { "agent": "./src/react_agent/graph.py:graph" },
  "env": ".env" }
```

Fields: `dependencies`, `graphs` (name to `path:object`), `env`, `image_distro`. The graph
itself is code. This is the counterexample: no reusable mode artifact, only a pointer to code.

### 1.9 CrewAI — YAML *and* a newer JSONC-per-agent format

Source: https://docs.crewai.com/en/concepts/agents.md. Current recommended layout is one file per
agent, `agents/<agent_name>.jsonc`, referenced from `crew.jsonc`:

```jsonc
{
  "role": "{topic} Senior Data Researcher",
  "goal": "Uncover cutting-edge developments in {topic}",
  "backstory": "You find the most relevant information and present it clearly.",
  "llm": "openai/gpt-4o",
  "tools": ["SerperDevTool"],
  "settings": { "verbose": true, "allow_delegation": false, "max_iter": 20 }
}
```

`{placeholder}` substitution with defaults in `crew.jsonc` `inputs`. Classic YAML
(`config/agents.yaml` + `@CrewBase`) still supported. Note the mode carries *execution budget*
(`max_iter`, `max_rpm`, `max_execution_time`, `max_retry_limit`) — closer to a work mode than
a persona.

### 1.10 Agno / Mastra / Pydantic-AI

- **Agno** (https://docs.agno.com/agents/overview.md): code-first `Agent`; abstractions are
  Agent / Team / Workflow. No declarative manifest on that page.
- **Mastra** (https://mastra.ai/docs/agents/overview.md + real example
  `examples/agent/src/mastra/agents/index.ts`): TS `new Agent({ id, name, description,
  instructions, model: 'openai/gpt-5.4-mini', tools, editor })`. The interesting bit for reuse:
  `editor: false` marks a code-defined agent as **locked against Studio (UI) overrides**, and
  `editor: { instructions: true, tools: true }` marks it overridable — an explicit
  code-owned vs UI-owned split.
- **Pydantic-AI** — the closest thing to a first-class reusable work-mode artifact found:
  **Agent Specs**, YAML or JSON, loaded with `Agent.from_file('agent.yaml')`
  (https://raw.githubusercontent.com/pydantic/pydantic-ai/main/docs/agent-spec.md):

```yaml
model: anthropic:claude-opus-4-6
instructions: You are a helpful research assistant.
model_settings:
  max_tokens: 8192
capabilities:
  - WebSearch:
      local: duckduckgo
  - Thinking:
      effort: high
```

  `AgentSpec` fields: `model`, `name`, `description`, `instructions` (str or list of str),
  `model_settings`, `capabilities`, `deps_schema` (JSON Schema for template-string validation),
  `output_schema` (JSON Schema), `retries`. Merge semantics are specified per field
  (scalars overridden, instructions/capabilities merged, model_settings merged additively).
  Stated motivation, verbatim: "Separating agent configuration from application code", "Letting
  non-developers (prompt engineers, domain experts) configure agents", "Sharing agent
  configurations across teams or projects". **No version field.**

### 1.11 Cross-vendor context file: AGENTS.md

https://agents.md/ — "A simple, open format for guiding coding agents, used by over 60k
open-source projects"; a plain markdown file (`## Setup commands`, `## Code style`, ...) read by
Codex, Jules, Cursor, Copilot, Gemini CLI, goose, opencode, Zed, Warp, Devin, Amp, RooCode, etc.
This is the *project-context* half of a mode; it has no schema and no version.

---

## 2. Awesome-lists and catalogues: what the community actually collects

| Catalogue | Scale | Category scheme |
|---|---|---|
| hesreallyhim/awesome-claude-code (54.6k stars) | 221 indexed pages | "Start Here", "From Anthropic", "Documentation/Knowledge", "Open Source Software", "Research & Scientific Inquiry", "Providers/Runtime & Integration", "Remote Control/Notifications/Voice", "Alternative Clients", "Status Lines", "Design & UI/UX", "Writing & Prose Quality", "Creative Media", "Infrastructure & DevOps", "Security", "Agent Orchestration" (sub: Ralph Wiggum, Dynamic Workflows), "Skills", "Memory & Context Persistence", "Observability & Monitoring" (sub: Session Monitors, Usage & Cost), "Configuration", "Testing", "Linting", "Multi-Purpose". Categories live in `config.yaml` and drive a generated README from a CSV. |
| VoltAgent/awesome-claude-code-subagents (25.3k stars) | 161 agents in 10 categories | `01-core-development`, `02-language-specialists`, `03-infrastructure`, `04-quality-security`, `05-data-ai`, `06-developer-experience`, `07-specialized-domains`, `08-business-product`, `09-meta-orchestration`, `10-research-analysis` |
| wshobson/agents (39.9k stars) | 94 plugins / 202 agents / 183 skills / 105 commands, "26 clear categories" | development, security (incl. reverse engineering), operations, languages, infrastructure, documentation, data/AI, business, SEO, ... |
| ccplugins/awesome-claude-code-plugins (952 stars) | — | Workflow Orchestration; AI & Speech; Automation DevOps; Business Sales; Code Quality Testing; Communication & Integrations; Data Analytics; Audio & Media; Design UX; Development Engineering; Documentation; Git Workflow; Marketing Growth; Project/Product Management; Lifestyle & Entertainment; **Security, Compliance & Legal**; MCP Servers; Thinking & Knowledge Management; Companion Apps |
| travisvn/awesome-claude-skills (15.2k stars) | — | Official Skills (Document, Design & Creative, Development, Communication, Skill Creation); Community Skills (Collections & Libraries, Individual Skills, Tools); plus *Skills vs MCP*, *Vetting Skills*, *Security Concerns*, *Known Issues* |
| obra/superpowers (291k stars) | 15 skills forming one methodology | Testing / Debugging / Collaboration / Meta — a *methodology* packaged as composable skills |

**What this reveals.** Catalogues file modes by (a) **domain role or stack** ("python-pro",
"backend-architect", "kubernetes"), (b) **workflow phase** ("code review", "debugging",
"pre-merge review", "documentation"), and (c) **meta** (orchestration, skill-authoring, memory).
Security is the only vertical with real depth — "penetration testing" appears as a keyword in
VoltAgent's `voltagent-qa-sec` plugin and reverse-engineering/compliance plugins exist in
wshobson — but **there is no quant/trading category anywhere**, and no auditing vertical framed
around evidence production. The catalogue taxonomies confirm that "reusable" in practice means
*a role plus a checklist plus a tool allowlist*, not *a governed execution mode*.

---

## 3. Versioning, sharing, and pinning mechanisms (with evidence)

### 3.1 Claude Code plugin versioning — the most developed mechanism found

From https://code.claude.com/docs/en/plugins/loading.md and `plugins/dependencies.md`:

1. **Version resolution order**: `version` in `plugin.json` then `version` in the marketplace entry,
   else derived from the source: **commit SHA (12 chars)** for `github`/`url`/`git-subdir`, SHA-256
   digest for `archive`, commit SHA of the installed directory for a relative path inside a
   git-hosted marketplace, `unknown` for local dirs and npm.
2. **Pinning is opt-in in both directions.** A manifest that pins `"version": "1.0.0"` keeps every
   user on the cached copy "however many commits they push"; to track commits you must leave
   `version` out of both the manifest and the entry. `claude plugin update` then prints
   `<name> is already at the latest version (1.0.0).`
3. **Explicit SHA pins exist in the marketplace format** — see the `git-subdir` + `ref` + `sha`
   example in section 1.4.
4. **Dependencies with semver ranges**: `plugin.json` `dependencies`: `["audit-logger",
   {"name": "secrets-vault", "version": "~2.1.0"}]`. The docs state the failure mode plainly:
   "Without a version constraint, a dependency moves to each new release its marketplace publishes
   the next time users update. **If that release renames an MCP tool your plugin calls, your plugin
   breaks for everyone who updates.**" Cross-marketplace deps require
   `allowCrossMarketplaceDependenciesOn`; otherwise the install is refused by name.
5. **Install records act as a lockfile**: `~/.claude/plugins/known_marketplaces.json` records each
   marketplace's `source`, `installLocation`, `lastUpdated`, `autoUpdate`;
   `installed_plugins.json` records each install's `scope`, `installPath`, `version`; `cache/`
   holds the files. Plugins load at session start from those records **without network**.
6. **Auto-update defaults are off for third-party marketplaces**: on for Anthropic's official
   marketplace, off for `knowledge-work-plugins`/`first-party-plugins`, on for claude.ai-sourced
   marketplaces, **off for every other marketplace**. Mid-session updates leave hooks/MCP/LSP on the
   old path until `/reload-plugins`.
7. **Validation gates**: `claude plugin validate --strict` fails on missing `version`, unknown
   manifest fields, non-`./` paths; recommended in CI.
8. **Evals as regression control**: `claude plugin eval` runs a plugin's test cases and scores
   results "which catches regressions when you change the plugin" (https://code.claude.com/docs/en/plugin-evals.md).

### 3.2 Repository-level pinning practices in the collections

- **VoltAgent CI enforces a version bump.** `.github/workflows/enforce-plugin-version-bump.yml`
  (read from the clone) triggers on PRs touching `categories/**` or `marketplace.json`, diffs
  against the base SHA, and fails with
  `::error file=...::Markdown changed under <category>, but plugin version was not bumped (still X)`,
  then cross-checks that the marketplace entry's `version` equals the plugin manifest's version.
  This is the clearest existing answer to "a mode must not silently change behavior": *content
  change without a version change is a CI failure.*
- **wshobson/agents generates per-harness artifacts from one markdown source** and gates the
  generated registries in CI. `tools/adapters/{claude,codex,cursor,copilot,opencode,antigravity,pi}.py`,
  `tools/generate.py`, `tools/validate_generated.py`, `tools/check_agent_name_collisions.py`,
  `tools/doc_gardener.py`. `docs/harnesses.md` is a **capability matrix** (skills, subagents,
  commands, marketplace, per-agent tool allowlist, MCP, hooks, tool-name case, model aliases per
  harness) and `docs/round-trip-results.md` records real-CLI verification per harness.
  From `docs/authoring.md`: "**Enforce invariants, not implementation.** Frontmatter shape, file
  naming, and trigger-phrase conventions are mechanically enforced by `plugin-eval`" and
  "**Boring tech preference.** Markdown + YAML frontmatter + small Python adapters. No templating
  engines, no DSLs, no harness-specific markup."
  Its explicit frontmatter contract:

  | File | Required | Recommended |
  |---|---|---|
  | `agents/<name>.md` | `name`, `description` | `model`, optional `tools:`, optional `color:` |
  | `skills/<name>/SKILL.md` | `name`, `description` | (none) |
  | `commands/<name>.md` | `description` | `argument-hint:` |

- **Ad-hoc sharing patterns people actually use**, from VoltAgent issue #254 ("how are teams
  sharing custom subagent configs across engineers?", opened 2026-05-13, closed with **zero
  comments**): git submodule of a private repo into Claude config dirs; shared dotfiles/chezmoi; a
  self-hosted registry that mirrors to disk on a polling loop (`luna-prompts/skillnote`).
- **Code-owned vs UI-owned**: Mastra's `editor: false` (see 1.10) is the only declarative
  "this mode is frozen, do not let a UI mutate it" flag found.

---

## 4. Failure modes: where reusable modes break, drift, or get abandoned

### 4.1 Silent non-application (the worst class)

- **VoltAgent #259** "Plugins fail to load agents — files placed at plugin root instead of agents/
  subdirectory" (2026-05-19, closed): all 10 category plugins declared
  `"agents": ["./data-analyst.md", ...]` at the plugin root. The loader only scans an `agents/`
  subdirectory and ignores the manifest entries. Symptom: *install succeeds*, `claude plugin
  details` reports `Agents (0) / ~0 tok`, and invoking any agent yields
  `Agent type 'data-analyst' not found`. **A declarative mode can be installed, report success, and
  never load.**
- **VoltAgent #258 / #242 / #240** — three separate reports of the same thing: `voltagent-qa-sec`
  v1.1.0's `plugin.json` declares 18 agents but two `.md` files
  (`cost-accounting-performance-reviewer.md`, `performance-roi-translator.md`) are not in the repo;
  `/reload-plugins` prints `Path not found: <cache>/voltagent-qa-sec/1.1.0/...`. The manifest and
  the payload drifted, and the version was *bumped* while drifting.
- **wshobson round-trip bugs** (`docs/round-trip-results.md`), caught only by loading generated
  artifacts in the real CLIs: (1) YAML block-scalar descriptions (`description: >`) were emitted
  with a literal `>` and broke OpenCode's loader (4 agents); (2) an OpenCode `permission` block
  derived from a `tools:` list containing only `mcp__*` tools or an empty list degraded to
  `read: deny, edit: deny, ...`, **making the agent inert**; (3) a custom `$source` key was rejected
  by OpenCode's config schema. Pure unit tests passed; only the round-trip found them.

### 4.2 Declared fields that don't take effect

Search `repo:anthropics/claude-code` yields **1,836 issues with "subagent" in the title** and
**301 open issues with "skill" in the title**. Representative titles (numbers are real):

- #43869 "Subagent model routing is broken — all mechanisms resolve to parent model (Opus)"
- #18950 "Skills/subagents do not inherit user-level permissions from settings.json"
- #14956 "Skill allowed-tools doesn't grant permission for Bash commands"
- #9716 "[BUG] Claude Code assistant not aware of available skills in .claude/skills/ directory"
- #14836 "[BUG] /skills command doesn't find skills in symlinked directories"
- #26489 "[FEATURE] skills/, agents/, commands/ should traverse parent directories like CLAUDE.md does"
- #18949 "Skills from marketplace plugins don't appear in slash command autocomplete"
- #16345 "Support the standard .agents/skills/ directory for agent skills"
- #14920 "Add ability to disable individual Claude plugin skills"
- #12633 "Allow skills to be hidden from the main agent (subagent-exclusive skills)"
- #20697 "Sync Skills between Claude Desktop and Claude Code CLI"
- #28729 "Link a source control repo as the source for organization skills"

The symlinked-directory and parent-directory-traversal bugs are the ones that hit *sharing*
specifically: the two obvious ways to share a mode across projects (symlink, or a shared parent
directory) were both broken.

### 4.3 Cost/context and model-rot drift

- **VoltAgent #279** "Agents hardcode `model: opus` - burns standard-Opus usage limit fast instead
  of riding the user's opus[1m] session". Measured distribution in the corpora I parsed:
  `0xfurai/claude-code-subagents` pins the literal dated id `claude-sonnet-4-20250514` in **all 137**
  agents; `contains-studio/agents` sets no model at all (32/32 inherit);
  `VoltAgent`: sonnet 109 / inherit 25 / haiku 19 / none 8;
  `wshobson`: sonnet 70 / inherit 52 / opus 54 / haiku 24 / fable 2.
  A mode that pins a model id will rot; one that inherits will surprise you on cost.
- **Always-on context cost**: plugin docs quantify it — a plugin's skills, agents and commands
  contribute their name + description (+ when_to_use) to **every** session whether used or not;
  `claude plugin details` prints an "Always-on" token figure and per-component rows; the official
  marketplace shows a "Context cost" section before install and highlights 2,000+ tokens.
  Claude Code also warns at startup when custom subagent descriptions exceed **15,000 tokens**,
  and truncates the combined description+when_to_use at **1,536 characters**. Installing many
  modes has a real, enforced budget.
- **Behavioral drift inside a shared methodology**: `obra/superpowers` ships a
  `diagnosing-superpowers` skill precisely for "a session [that] misbehaves: a skill fires when it
  shouldn't, stays silent when it should, or the agent ignores its plan, repeats work, or burns
  more tokens than you'd expect", plus an eval harness (`superpowers-evals`) for skill-behavior
  tests. Its contribution policy: "we don't generally accept contributions of new skills and **any
  updates to skills must work across all of the coding agents we support**."

---

## 5. Do shared modes actually get reused — or forked and forgotten?

**Fork/abandonment data** (GitHub API, 2026-09-25):

| Repo | Stars | Forks | Created | Last push | Note |
|---|---|---|---|---|---|
| wshobson/agents | 39,943 | 4,255 | 2025-07-24 | 2026-09-21 | active, has adapters + CI |
| VoltAgent/awesome-claude-code-subagents | 25,321 | 2,922 | 2025-07-30 | 2026-09-21 | active, has CI version-bump gate |
| obra/superpowers | 291,484 | 26,080 | 2025-10-09 | 2026-09-25 | active, commercial backing |
| contains-studio/agents | 12,421 | 2,499 | 2025-07-28 | **2025-07-28** | 2,499 forks of a repo untouched since the day it was created |
| 0xfurai/claude-code-subagents | 1,007 | 187 | 2025-07-31 | **2025-10-15** | ~11 months stale, all agents pin a 2025 model id |

Derivative sprawl: repository search returns **3,377 repos** matching `claude subagents` and
**2,642** matching `claude-code-subagents` — orders of magnitude more than the handful of curated
collections.

**Re-authoring, not reuse.** Parsing all four agent corpora (161 + 137 + 32 + 202 agents), the
same conceptual mode is re-implemented in each collection rather than imported:

- name collisions: VoltAgent and wshobson share **24** agent names (`ui-designer`, `python-pro`,
  `golang-pro`, `sql-pro`, `javascript-pro`, ...); VoltAgent and 0xfurai share 6;
  contains-studio and VoltAgent share 4; contains-studio and 0xfurai share **0**.
- content-level copying is nearly absent: only **1** description is byte-identical across repos
  (`0xfurai:bash-expert` equals `wshobson:bash-pro`), and **0** whole-file duplicates across the
  four corpora.

So the observable pattern is: *many independent authors converge on the same mode names and
re-write the prompts from scratch, rather than depending on someone else's artifact.*

**Creators cannot even measure reuse.** Two independent admissions:

- Claude Code docs (https://code.claude.com/docs/en/plugins/measure.md): "**Claude Code doesn't
  report a plugin's usage back to its author.** Usage is recorded on the machine of each person who
  installed the plugin." The author-side options are org-wide OpenTelemetry/Analytics, or asking
  teammates. Users get `/plugin` "Not used recently", `/skill-doctor` ("find skills that never
  run"), `/doctor` ("unused plugins"), and `/usage`.
- obra/superpowers README: "Because skills and plugins don't provide any feedback to creators, **we
  have no idea how many of you are using Superpowers.**" Their workaround is a logo image loaded
  from their site that embeds the version in use, opt-out via `SUPERPOWERS_DISABLE_TELEMETRY` —
  i.e. a 291k-star project resorts to a pixel beacon to learn its own version distribution.

---

## Must-answer questions

### Q1. Smallest set of fields a reusable work-mode artifact needs

Judged from what real projects actually ship (not from what is theoretically available):

**Required (universally present, and enforced):**
1. `name` — stable, kebab-case, equal to the directory name in the Agent Skills spec.
2. `description` — doubles as the *routing* text (when to use) and as the always-on context cost.

**Effectively required in practice (present in ~100% of real agent files):**
3. `instructions` / the markdown body — the mode itself. Never optional in any format surveyed.
4. `model` — 202/202 in wshobson, 153/161 in VoltAgent, 137/137 in 0xfurai; the only corpus that
   omits it (contains-studio, 32/32) is the one that was abandoned.

**The first genuinely optional layer (what makes it a *work mode* rather than a persona):**
5. `tools` allowlist + `disallowedTools` — only 31/176 in the VoltAgent-era corpus, 15/202 in
   wshobson, 0/137 in 0xfurai. Real projects under-specify this; a framework that cares about
   irreversible actions should not copy that.
6. Execution bounds — `maxTurns` (Claude Code), `max_iter`/`max_rpm`/`max_execution_time`/
   `max_retry_limit` (CrewAI). Present where the vendor thought about long-running work.

**Everything else is harness-specific decoration** (color, effort, isolation, memory, hooks,
mcpServers, background, cacheTtl) — useful, but no surveyed project treats them as part of the
reusable core.

Concretely, a minimal portable mode is:

```yaml
name: <kebab-case, == directory name>
description: <what it does + when to use it, <1024 chars>
model: inherit | <alias> | <provider:id>
tools: [<allowlist>]        # optional but load-bearing for safety
# body: the instructions, plus any scripts/ and references/ the mode needs
```

For the user's three verticals the survey says this minimal set is **insufficient** — none of the
surveyed formats carries the things the PRD requires (evidence contract, approval gates, stop
conditions, checkpoint/resume). The nearest real precedents for those are: OpenAI's versioned
hosted prompt object, Claude Code's `permissionMode` + `maxTurns` + hooks, CrewAI's budget
fields, and LangGraph's checkpointer/interrupt machinery (code, not declarative). A work mode
that must gate irreversible actions needs at least a permission/scope declaration and a budget,
and probably an explicit evidence/stop contract that no existing format has.

### Q2. Pinning / versioning mechanisms so a mode does not silently change behavior

Ranked by strength of the guarantee, all with real precedents:

1. **Immutable commit pin** — `source: {source: git-subdir, url, path, ref, sha}` in
   `marketplace.json`. Anthropic's own official marketplace does this for 137+ entries. This is
   the strongest guarantee found: the content is identified by SHA, not by a mutable tag.
2. **Content-change implies version-change, enforced in CI** — VoltAgent's
   `enforce-plugin-version-bump.yml`: any `.md` change under a plugin dir without a `version`
   bump fails the PR, and the marketplace entry must match the manifest. Cheap, mechanical, and
   directly targeted at silent behavior change.
3. **Manifest `version` + computed-version resolution** — Claude Code computes a version per
   plugin (manifest, then marketplace entry, then source SHA) and skips update when unchanged; the
   version also names the cache directory, so two versions can coexist on disk.
4. **Dependency constraints** — semver ranges in `plugin.json#dependencies`
   (`{"name": "secrets-vault", "version": "~2.1.0"}`), with the documented failure mode that an
   unconstrained dep "breaks for everyone who updates" when a tool it calls is renamed.
5. **Local install ledger** — `installed_plugins.json` (`scope`, `installPath`, `version`) and
   `known_marketplaces.json` (`source`, `installLocation`, `lastUpdated`, `autoUpdate`) are the
   lockfile analogue; plugins load from them offline. Auto-update is **off by default for
   third-party marketplaces**, which is itself a pinning default.
6. **Rename bookkeeping** — the `renames` map in Anthropic's marketplace and the docs' rule that
   "a renamed plugin is a different plugin to every existing install" (so `name` is permanent,
   `displayName` is the label).
7. **Eval suites as behavior locks** — `claude plugin eval`, superpowers' `superpowers-evals`,
   wshobson's `plugin-eval`. Version numbers pin *content*; evals are the only thing that pins
   *behavior*.
8. **Static validation** — `claude plugin validate --strict` (unknown fields, missing version,
   non-`./` paths), `skills-ref validate` (Agent Skills naming/frontmatter), wshobson's
   `check_agent_name_collisions.py` and `validate_generated.py`, and CI that gates registry drift.

What does **not** exist in any surveyed project: a lockfile that records *which mode version a
task ran under*, i.e. provenance of the mode in the run's evidence record. That is a gap the
user's framework would have to fill itself.

### Q3. Evidence that shared modes get reused vs forked and forgotten

Reused (real signals):
- One markdown source compiled to 6+ harnesses and shipped as 94 plugins with pinned SHAs; 183
  skills installed directly from GitHub by two independent installers (`gh skill`, `npx skills`)
  without a clone.
- superpowers distributed simultaneously through Anthropic's official marketplace, its own
  marketplace, OpenAI's Codex plugin marketplace, and per-harness installs for ~15 agents.
- VoltAgent's plugin marketplace, whose 10 category plugins are the packaging of its 161 agents.
- Cross-collection convergence on the same mode *names* (24 shared names between VoltAgent and
  wshobson) shows a shared vocabulary, i.e. the concept travels.

Forked and forgotten (real signals):
- contains-studio/agents: 12.4k stars, 2,499 forks, untouched since the day it was created.
- 0xfurai/claude-code-subagents: stale ~11 months, 137 agents all pinning a 2025 model id.
- 2,642-3,377 derivative repos for "claude subagents" against a handful of curated sources.
- Only 1 identical description and 0 identical files across the four corpora — the fork/derivative
  path does not feed back into the shared artifact.
- A direct question about sharing ("how are teams sharing custom subagent configs across
  engineers?", #254) was **closed with no answer**.
- Creators get no usage data at all (Claude Code docs, superpowers README) — so even a
  successfully reused mode is indistinguishable from an ignored one from the author's side.

Conclusion for the user's design: *publishing a mode is cheap and reuse is real but shallow; what
fails is (a) knowing whether a mode was used at all, and (b) knowing which version of a mode
produced a given outcome.* A framework that records mode id + mode version in the run's evidence
record solves both problems at once, and no surveyed project does it.

---

## Caveats / Not Found

- **`web_search` was unavailable for the entire session** (Firecrawl keyless tier 429 on every
  engine; `modsearch` failed for every query). All discovery was via the GitHub REST search API
  (`/search/repositories`, `/search/issues`) and known repository names. Repos that would only
  surface through a general web search may be missing.
- **GitHub API was unauthenticated** (60 core / 10 search requests per hour, shared IP). Two rate
  limit windows were hit. Consequences: issue *titles* are reliable, issue *bodies* are only
  available for the handful fetched before the limit; **GitHub Discussions could not be enumerated
  at all** (GraphQL limit 0, and discussion bodies are not in the server-rendered HTML). The
  "reuse failure modes" evidence therefore rests on issues + first-party docs + repo artifacts,
  not on discussions.
- `web_fetch` **truncates every response at 100,000 characters**. Files above that size (Claude
  Code's `sub-agents.md`, `skills.md`, Anthropic's `marketplace.json`) were read by downloading
  them with the shell and slicing locally; where that was not possible the counts are lower
  bounds and this is stated inline.
- Claude Code documentation is versioned by release and moves weekly (the docs carry per-week
  "what's new" pages; behaviour cited here includes v2.1.196-v2.1.271 gates). Field sets quoted
  are as of 2026-09-25.
- Corpora were cloned at HEAD on 2026-09-25: `wshobson/agents` (main),
  `VoltAgent/awesome-claude-code-subagents`, `0xfurai/claude-code-subagents`,
  `contains-studio/agents`, `hesreallyhim/awesome-claude-code`, `anthropics/skills`.
  `wshobson/agents` was extracted from a codeload tarball; one file (`CLAUDE.md`) failed to
  extract on Windows and is excluded from counts.
- Field-frequency numbers come from a hand-rolled frontmatter parser (top-level `key:` lines
  between the first two `---` lines). Files whose frontmatter contains multi-line YAML scalars
  (e.g. contains-studio's example blocks inside `description`) are parsed conservatively; the
  contains-studio corpus is excluded from the "keys" tallies for that reason and only used for
  its model distribution and name-overlap counts.
- Not verified: whether `gh skill` or `npx skills` write a lockfile (I could not reach
  `skills.sh`'s documentation content — the site is a client-rendered app and the npm package
  named `skills` is unrelated). wshobson's `docs/harnesses.md` describes both installers only as
  "read `plugins/*/skills/` from GitHub directly", with no pinning story.
