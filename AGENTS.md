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

The harness own subjects: [`personal-agent-harness-loop.md`](./.trellis/spec/backend/personal-agent-harness-loop.md) for what it
measures and what was decided about its boundaries, [`harness-loop-turn.md`](./.trellis/spec/guides/harness-loop-turn.md) for how a
turn runs, and [`.trellis/harness-surface.yaml`](./.trellis/harness-surface.yaml) for the editable surface those turns are bounded by.
