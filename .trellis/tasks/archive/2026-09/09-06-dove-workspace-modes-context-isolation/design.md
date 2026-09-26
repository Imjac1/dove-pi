# Design: Dove Workspace Modes and Context Isolation

## 1. Architecture

Introduce a workspace-scoped policy with two independent axes:

```text
workspaceMode: development | pentest
executionMode: fast | standard | ultra
interactionMode: auto | chat | work
```

`workspaceMode` is the environment policy. `executionMode` remains the
request-intensity policy already owned by `ModeController`; `interactionMode`
remains the context-organization preference. None of these axes becomes a tool
allow-list or a permission tier.

The workspace policy is persisted in `.dove/workspace.json`:

```json
{
  "schemaVersion": 1,
  "mode": "development"
}
```

Missing or malformed optional policy falls back to `development` with a
bounded diagnostic. It must not block ordinary Pi startup. Writes use the same
workspace mutation lock and atomic temporary-file/rename pattern as native
state.

## 2. Launch and runtime flow

1. `dove-pi` resolves an explicit one-launch override, then reads the workspace
   policy. No file means `development`.
2. The launcher passes `--no-lens` to Pi only for effective `pentest` mode.
   Development launches preserve normal Pi-lens loading. The launcher does not
   edit `~/.pi/agent/settings.json` or `~/.pi-lens/config.json`.
3. The Dove extension reads the same policy and exposes
   `/dove-workspace development|pentest` plus status output. A change is
   persisted and reported as `next session`; the running process is not
   falsely reported as having unloaded Pi-lens.
4. Pi's native `/lens-toggle` remains available as a deliberate current-session
   override. Dove reports the configured policy and launch effective state
   separately so a temporary toggle cannot be mistaken for persistence.

The public launcher also accepts an optional `--workspace-mode development|pentest`
override for one launch. It has higher precedence than the workspace file and
does not persist. The wrapper and Python fallback must strip/forward this
consistently before invoking Pi.

## 3. Pi-lens policy

- Development: Pi-lens is enabled by default. Project ignore defaults are
  applied through Dove's launch/runtime policy where supported, with explicit
  `.pi-lens.json` project settings left intact.
- Pentest: pass `--no-lens`. This avoids LSP, lint, formatting, structural
  scans, and Pi-lens context injection for downloaded tools and target data.
- The security mode does not add authorization prompts, block valid Pi tools,
  or infer that a target is safe. It is a workload policy, not a security
  boundary.
- Direct `pi` sessions are outside Dove's control and keep their existing
  configuration.

## 4. Central model-context boundary

Add a pure projection helper for `AgentMessage[]` and register it on Pi's
`context` event. The projection runs immediately before every provider request,
including follow-ups triggered by `background-task-notification`.

The helper must:

- preserve user, assistant, image, compaction, and normal small custom content;
- compact custom messages and tool-result content above a fixed character
  budget, regardless of which extension created them;
- recognize background task details and retain task id, status, exit code,
  output path, summary, error counts, digest, and omitted size;
- remove raw oversized `details`/content from the model projection while
  leaving the original session entry and on-disk artifact untouched;
- avoid duplicate compaction markers when multiple context passes occur;
- avoid exposing credentials or sensitive absolute paths in generated metadata.

The existing `tool_result` hook remains useful for built-in tool-specific
metadata, but it is no longer the only protection. The context projection is
the final defense against third-party custom messages.

## 5. Background-task failures

Normalize task notifications into a bounded summary before model delivery.
The summary includes shell/runtime facts only when supplied by the task:
`hostShell`, `cwd` (sanitized or workspace-relative), `exitCode`, and bounded
stdout/stderr tails. A failure fingerprint is derived from normalized command
classification, shell, cwd, exit code, and error tail digest. Equivalent
failures are coalesced until the command strategy or environment facts change.

This is diagnostic loop control, not a permission gate: the model may retry
after changing shell, path dialect, command, or working directory.

## 6. Mode versus intensity

Keep `/mode fast|standard|ultra` unchanged. The three values remain useful for
short work, routine work, and complex/long work respectively. They continue to
feed thinking policy, provider-round diagnostics, and context compilation, but
never select extensions or change tool authority.

Keep `auto|chat|work` as the context preference. Status/help text must label all
three axes explicitly, while the primary workload command remains
`/dove-workspace`.

The installer extension profiles remain installation compatibility profiles.
They are not aliases for workspace modes. `max` may still install Pi-lens, but
the runtime `pentest` launch flag disables it for that session.

## 7. Compatibility and rollout

- Existing workspaces with no `.dove/workspace.json` behave as development.
- Existing `/mode` history remains readable and keeps its current meaning.
- Existing global Pi and Pi-lens configuration is never migrated or rewritten.
- Existing `.pi-lens.json` files remain user-owned; downloaded external trees
  are protected by the launch policy and centralized projection rather than
  by mutating those trees.
- If an older managed launcher does not understand the policy file, the Dove
  extension still reports the mismatch; the managed release must be updated
  before claiming that `pentest` actually disabled Pi-lens.

## 8. Test seams

- Pure workspace policy read/write/precedence tests.
- Launcher argument tests for default, persisted pentest, and one-shot override.
- Extension command/status tests proving next-session semantics.
- Context projection tests with normal custom messages, a synthetic 2.8 MB
  background notification, images, duplicate markers, and sensitive paths.
- Cross-axis tests proving workspace mode leaves execution mode, interaction
  mode, and active Pi tools unchanged.
- Background failure coalescing tests for unchanged and changed strategies.
- One fresh-process launch smoke for each workspace mode without touching the
  inspected external workspace.
