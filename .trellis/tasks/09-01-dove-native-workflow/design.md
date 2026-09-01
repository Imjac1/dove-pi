# Design

## Boundary

Pi owns tools, execution, and user interaction. Dove owns a small goal record,
bounded context, continuity, loop prevention, and diagnostics. There is no Dove
permission model and no mandatory project workflow.

## Native State

Store `.dove/state.json` with a version, revision, optional current goal, and a
bounded list of recent goals. A goal contains an opaque ID, title, status,
created/updated timestamps, optional next step, decisions, and verification.
Writes use a temporary file plus rename under the existing project mutation
lock.

The native provider implements the current `ProjectProvider` interface so Core,
Pi, MCP, diagnostics, and context compilation retain one boundary. Provider
terminology becomes `native`; task operation types become provider-neutral.

## Legacy Import

The compatibility reader may parse public `.trellis/tasks`, specs, workflow,
and workspace Markdown. It does not execute `task.py`, inspect private runtime
state, or mutate `.trellis`. If native state is absent, unfinished legacy tasks
are exposed as `legacy-trellis:*` records. A native mutation materializes only
the selected/current goal into `.dove/state.json`.

## User Flow

- Ordinary work: no task state is required; execute directly.
- Explicit tracking: `agent_project_task` or `/task` records a native goal.
- Continue: use the native current goal, or one unambiguous legacy candidate.
- Finish/archive: update native JSON directly; no phase handshake.
- `/project init` creates compact native state; `/project update` is removed.

PlanningSession and Trellis-specific prompt guidance are removed. The existing
pending-action continuation and one-question-per-goal guard remain because they
control loops, not permissions.

## Rollout

Keep legacy readers for one compatibility window. Preserve `.trellis` untouched.
Managed installation retains the previous release for rollback.
