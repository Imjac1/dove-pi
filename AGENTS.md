<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->

<!-- Everything in this section is outside the Trellis-managed block above, which a test checks: content inside the block may be
     overwritten by a `trellis update`, and content outside it is preserved. -->

## Where this harness is documented

The coding specifications live under `.trellis/spec/`, indexed in [`.trellis/spec/backend/index.md`](./.trellis/spec/backend/index.md) -
and that index lists **every** specification in that directory, which a test checks, because it was missing three of them.

One correction to a tracked document: `.trellis/workflow.md` names the script at .trellis/scripts/inject-workflow-state.py, which
in this install is `.codex/hooks/inject-workflow-state.py`. This note also named a .claude path as a second location, which was true when it was written and is not any more: that platform is not installed here, and its 52 files are still in the tool own hash list. The removed path is written without code marks for the same reason the one below it is. The path that is wrong is
written here without code marks on purpose: the documentation checks read code spans, and a note describing a wrong path would
otherwise read as one. The workflow-state mechanism itself works - that document carries thirty of its
blocks - and the file may be replaced by a tool update, so the correction lives here, where a test holds its position.

A second correction, measured rather than assumed: **archiving a task breaks the curated context entries that pointed inside it.**
.trellis/scripts/task.py moves a task directory to `.trellis/tasks/archive/<month>/<name>/` and rewrites nothing, so every entry in
`implement.jsonl` or `check.jsonl` whose path began with the task own directory stops resolving - 58 of 66 broken pointers in one
measurement, and the entries read fine, which is why nobody noticed. **The script is in `.trellis/.template-hashes.json`, so the fix is not
this repository to make**: a `trellis update` may replace it, and an edit here would be lost. What is ours is to repoint the entries after an
archive, and to know that a fresh archive has just done it again.

The harness own subjects: [`personal-agent-harness-loop.md`](./.trellis/spec/backend/personal-agent-harness-loop.md) for what it
measures and what was decided about its boundaries, [`harness-loop-turn.md`](./.trellis/spec/guides/harness-loop-turn.md) for how a
turn runs, and [`.trellis/harness-surface.yaml`](./.trellis/harness-surface.yaml) for the editable surface those turns are bounded by.
