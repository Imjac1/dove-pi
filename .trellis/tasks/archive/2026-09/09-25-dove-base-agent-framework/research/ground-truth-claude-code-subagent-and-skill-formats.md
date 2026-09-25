# Ground truth: how a reusable agent work mode is actually defined (Claude Code)

- Query: What does a production, field-level schema for a **reusable agent definition** look like?
- Scope: first-party vendor docs, fetched directly by the main session
- Date: 2026-09-25
- Sources:
  - https://code.claude.com/docs/en/sub-agents.md (fetched, 98,931 chars)
  - https://code.claude.com/docs/en/skills.md (fetched, 98,948 chars)

This file exists because the user's requirement is "the agent working mode must be reusable". This
is the most concrete published answer to *what a reusable mode is made of*, and it is in
production use.

## 1. The reuse trigger, stated by the vendor

> Define a custom subagent when **you keep spawning the same kind of worker with the same
> instructions.**

And the four stated benefits, verbatim:

> * **Preserve context** by keeping exploration and implementation out of your main conversation
> * **Enforce constraints** by limiting which tools a subagent can use
> * **Reuse configurations** across projects with user-level subagents
> * **Specialize behavior** with focused system prompts for specific domains

## 2. The artifact: one Markdown file, YAML frontmatter + body

> Subagent files use YAML frontmatter for configuration, followed by the system prompt in Markdown

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---
You are a code reviewer. When invoked, analyze the code and provide
specific, actionable feedback on quality, security, and best practices.
```

> The frontmatter defines the subagent's metadata and configuration. **The body becomes the system
> prompt** that guides the subagent's behavior. Subagents receive only this system prompt plus
> basic environment details like the working directory, not the Claude Code system prompt.

**Only `name` and `description` are required.**

## 3. The complete frontmatter field set (verbatim, condensed)

| Field | Required | What it controls |
|---|---|---|
| `name` | **Yes** | Unique identifier; can't contain `:` (reserved for plugin-scoped ids) |
| `description` | **Yes** | When the host should delegate to this agent |
| `tools` | No | Tools the agent may use; inherits all if omitted |
| `disallowedTools` | No | Tools to deny, removed from the inherited/specified list |
| `model` | No | `sonnet` / `opus` / `haiku` / a full model ID / `inherit` |
| `permissionMode` | No | `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`, `manual` |
| `maxTurns` | No | Max agentic turns; on reaching it, output is **marked partial** and can be resumed |
| `skills` | No | Skills preloaded into context at startup (full content injected) |
| `mcpServers` | No | MCP servers available to this agent |
| `hooks` | No | Lifecycle hooks **scoped to this agent** |
| `memory` | No | Persistent memory scope: `user`, `project`, or `local` - "Enables cross-session learning" |
| `background` | No | Keep running in background |
| `omitClaudeMd` | No | Launch without the user/project/local CLAUDE.md files |
| `effort` | No | `low` / `medium` / `high` / `xhigh` / `max` |
| `isolation` | No | `worktree` -> run in a temporary git worktree, "giving it an isolated copy of the repository" |
| `color` | No | Transcript display colour |
| `initialPrompt` | No | Auto-submitted first user turn when this agent is the main session agent |
| `experimental` | No | Map, e.g. `cacheTtl: 5m \| 1h` |

## 4. Why this field set is the answer to the user's requirement

Read the list as a checklist and it decomposes exactly along the axes this task's research
identified:

| Framework axis (from `synthesis-01-official-wave.md`) | Fields that carry it |
|---|---|
| Identity and delegation | `name`, `description` |
| **Authority / gate** | `tools`, `disallowedTools`, `permissionMode`, `hooks` |
| **Sandbox** | `isolation: worktree` |
| **Session / memory** | `memory`, `maxTurns` (+ partial + resume) |
| Capability packaging | `skills`, `mcpServers` |
| Cost / effort policy | `model`, `effort`, `experimental.cacheTtl` |
| Context admission | `omitClaudeMd`, `skills` (preload vs lazy) |
| Invocation | `background`, `initialPrompt` |

So a reusable work mode is **not** just a prompt. It is a prompt **plus** an authority grant, a
sandbox selection, a session/memory scope, a capability set, and a budget policy. That is a
directly usable design target.

## 5. Discovery, scope, and versioning

- Watched directories: `~/.claude/agents/` (user scope) and `.claude/agents/` (project scope);
  files are hot-reloaded "within a few seconds... with no restart needed".
- Three scopes exist: user, project, plugin (plugin agents are referenced as
  `my-plugin:reviewer` - a **namespaced identifier**, which is how one mode is distinguished
  from another across sources).
- Validation exists: `claude plugin validate` against an agents directory.

## 6. Documented footguns worth copying the *fix* for

- **Unknown fields are silently ignored.** Verbatim: "Multi-word field names use camelCase... and
  must match the table exactly: **Claude Code ignores a field it doesn't recognize without
  reporting an error.**" A typo in a security-relevant field (e.g. `permissionMode`) fails open
  and silent. A base framework should **reject unknown fields** instead.
- Skip rules are documented per case: no `name`; an opening `---` that is not the first line; a
  `name` starting with `-` or containing `:`; a `name` with no `description`; unparseable YAML.
  Each is skipped **without reporting it in the session** (only to the debug log).
- A catalog budget exists: combined `description` fields warn at **15,000 tokens**, with the
  guidance to keep descriptions short and push detail into the body "which only loads when that
  subagent runs". This is progressive disclosure applied to the mode catalogue itself.

## 7. Skills: the other half of the reuse story

From `skills.md`:

> Claude Code skills follow the **Agent Skills** open standard, which works across multiple AI
> tools.

> **Custom commands have been merged into skills.** A file at `.claude/commands/deploy.md` and a
> skill at `.claude/skills/deploy/SKILL.md` both create `/deploy` and work the same way.

> a skill's body **loads only when it's used**, so long reference material costs almost nothing
> until you need it.

Claude Code extends the standard with invocation control, subagent execution, and dynamic context
injection; the doc explicitly separates "which frontmatter fields are part of the standard and
which are Claude Code extensions".

**Division of labour that emerges**: a *skill* is a reusable **procedure**; a *subagent/work mode*
is a reusable **worker** (authority + sandbox + session + budget + procedure). The user's
requirement is the second one, and the second one can reference the first (`skills:` field).

## 8. Caveats / Not Found

- The skills frontmatter table (which fields are standard vs extension) was **not** extracted in
  full; only the prose above was read. Extracting it is a small follow-up.
- `agent-teams`, `background agents`, and `cross-session messaging` are referenced as separate
  features but were not fetched, so their schemas are unknown.
- This is one vendor's schema. Whether it is a good schema is a separate question; the GitHub wave
  is surveying alternative designs. Nothing here should be adopted without that comparison.
- Version notes in the doc (`v2.1.198`, `v2.1.246`, `v2.1.271`...) show this surface is still
  moving quickly, so field names are not a stable external contract.
