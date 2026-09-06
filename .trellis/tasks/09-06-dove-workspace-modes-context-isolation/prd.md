# Dove Workspace Modes and Context Isolation

## Goal

Give Dove Pi an explicit, switchable workspace mode for ordinary software
development and authorized penetration testing. The selected mode must prevent
Pi-lens and large extension/background output from degrading the active model
session, while retaining useful development diagnostics when appropriate.

## Background

- Pi-lens is currently installed in Pi's global `packages` list and therefore
  loads for every direct Pi/Dove launch. Its project `.pi-lens.json` supports
  ignores and a small set of mutation settings; it cannot set `lens.enabled`.
- Pi-lens supports a per-launch `--no-lens` switch and a session-local
  `/lens-toggle` command. It also supports disabling only context injection,
  but that does not stop scanners and background work.
- A September 6 authorized security-testing session admitted a 2,865,326
  character diagnostic result for a downloaded third-party tool tree. This was
  approximately 95% of tool-result text in the session and reached the model
  through a background/custom-message path not covered by Dove's ordinary
  `tool_result` compaction.
- `fast`, `standard`, and `ultra` are currently independent execution-intensity
  modes. They drive Dove thinking policy and request/context strategy; they do
  not select Pi extensions or tool authority. Separately, `auto`, `chat`, and
  `work` select context organization, while installer extension profiles are
  `minimal`, `dev`, `research`, `security`, and `max`.

## Requirements

### R1: Two workspace modes

- Provide a visible, persistent workspace-mode selection with exactly
  `development` and `pentest` initially.
- Allow the user to select it before launch and change it through a clear Dove
  command. A mode change that affects Pi-lens must take effect on the next
  session, because Pi-lens evaluates its launch flags at process start.
- The launch/status surface must report the requested mode, effective mode,
  Pi-lens state, and whether a restart is required.

### R2: Pi-lens policy

- `development` starts with Pi-lens enabled, subject to bounded model-visible
  delivery.
- `pentest` starts Pi with `--no-lens`; it must not scan downloaded security
  tools, target artifacts, dependency trees, or caches automatically.
- A user may explicitly enable Pi-lens only for the current `pentest` session
  through Pi's existing session command. Dove must not silently rewrite the
  user's global Pi settings.
- The policy must apply to the `dove-pi` launcher. Direct `pi` use remains
  explicitly outside Dove's control.

### R3: Context and diagnostic isolation

- Enforce one centralized model-visible text boundary for ordinary tool
  results, extension custom messages, and background-task notifications.
- An oversized result must preserve a concise source, severity/count summary,
  content digest, omitted size, and safe artifact/log reference; raw full
  diagnostic text must remain outside the model transcript.
- Treat known generated/dependency/vendor paths as non-actionable by default
  in diagnostic delivery. Do not edit third-party workspaces or global user
  configuration as part of this protection.

### R4: Background failure projection

- Surface failed background commands as one bounded, actionable record:
  command classification, host shell, working directory, exit code, and short
  stdout/stderr tail.
- Detect repeated equivalent shell/path-dialect failures and prevent the same
  non-progressing retry until the execution strategy changes.

### R5: Preserve task-intensity controls without mode confusion

- Keep `fast`, `standard`, and `ultra` as task-intensity controls, independent
  of workspace mode. They must not enable/disable Pi-lens or change tool
  authority.
- Make the UI/help/status explain the orthogonal axes without presenting the
  existing installer extension profiles as runtime workspace modes.
- Retain `standard` as the default intensity. `fast` remains appropriate for
  short/read-only work; `ultra` remains an explicit opt-in for long or complex
  work. No fixed context-window allocation is introduced for any intensity.

## Out of Scope

- New permission or approval systems for authorized security work.
- Changing the global Pi configuration, removing globally installed Pi-lens,
  or changing behavior for direct `pi` sessions.
- Modifying the inspected external security-testing workspace or rerunning any
  external scan.
- Removing Pi's native `/lens-toggle` or replacing Pi-lens itself.

## Acceptance Criteria

- [ ] AC1: `dove-pi` exposes `development` and `pentest`, persists the selected
      workspace mode, and reports effective mode plus restart requirements.
- [ ] AC2: A `pentest` launch passes `--no-lens`; a `development` launch does
      not, and neither path mutates the user's global Pi settings.
- [ ] AC3: A 2.8 MB synthetic background/custom diagnostic is compacted before
      model re-entry with its source, counts, digest, omitted size, and artifact
      reference retained; the complete raw payload is not in model-visible
      session content.
- [ ] AC4: Normal development diagnostics remain concise and available to the
      model after central compaction.
- [ ] AC5: A diagnostic for a dependency/vendor/downloaded tool tree is not
      recursively delivered as actionable model context.
- [ ] AC6: Equivalent Windows/WSL shell mismatch failures are normalized once
      and do not cause an identical background retry loop.
- [ ] AC7: Regression tests prove workspace mode does not alter task-intensity
      selection, context interaction mode, or Pi tool authority.
- [ ] AC8: Help and status distinguish workspace mode from `fast`/`standard`/
      `ultra`, and document session-local Pi-lens opt-in in `pentest` mode.

## Key Decisions

- The primary interactive command is `/dove-workspace development|pentest`.
  It does not repurpose `/mode`, which remains the task-intensity command.
- `development` is the default workspace mode. A user explicitly selects
  `pentest` for authorized penetration-testing work and may switch back to
  `development` later.
- The selection persists at workspace scope; no global Pi setting is rewritten.
