# Dove Pi multi-turn real-user replay

## Goal

Make the Dove Pi black-box test represent a real user session: one isolated
project, one Pi session, several sequential commands/requests, and one
diagnostic result that explains what actually happened. Use that replay to
separate harness failures from Dove policy or lifecycle failures, then fix only
the confirmed product defects.

## User Value

- A successful request is not reported as a process failure merely because the
  test driver killed the host after receiving `agent_settled`.
- Replaying one user's mode/tool/thinking changes shows whether the effective
  strategy changes at the next request and whether the source is visible.
- Different test cases cannot leak state, ledger entries, sessions, or provider
  captures into one another.
- A maintainer can reproduce a reported workflow issue through the same public
  RPC launcher used by a headless user.

## Confirmed Evidence

- `scripts/real-dove-blackbox.mjs` launches the public source path through
  `python dove_pi.py --offline --mode rpc` and captures ledger/provider data.
- The harness currently derives `stateDir` and `sessionDir` from the output
  directory and force-kills the child 500 ms after `agent_settled`; a normal
  replay therefore reports `signal: SIGTERM` and `exitCode: null`.
- A batch run with three separate output files under one parent reused the same
  Dove state and Pi session roots, so the cases were not independent.
- The current RPC protocol supports sequential `prompt`, `steer`,
  `follow_up`, `get_state`, `get_session_stats`, and host-setting commands; the
  existing harness sends only one prompt.
- In Auto tool mode, the adapter intentionally preserves Pi's complete active
  tool set. Explicit `/dove-tools core|full|auto` is the boundary that must be
  measured, not silently rewritten by the test.
- The existing faux provider is deterministic and records model payload shape,
  but it does not yet inject provider status failures or user cancellation.
- Trellis isolates active task state by AI session: `task.py start` writes
  `.trellis/.runtime/sessions/<context-key>.json`, and `task.py current --source`
  resolves that session pointer instead of using a global current-task file.
  The replay task was intentionally created with `--no-start`, so it has no
  pointer yet; that explains why it is not active, but it does not justify the
  shell selecting an unrelated older task.
- A direct resolver probe found an isolation defect: when an explicit Codex
  context key has no matching session file but exactly one unrelated session
  file exists, `resolve_active_task` still returns that unrelated task through
  `session-fallback`. With `allow_single_session_fallback=False` the same probe
  correctly returns no task. This contradicts the documented rule that fallback
  is only for platforms without a usable session identity.

## Requirements

### R1. Strict case and session isolation

- Every scenario owns a unique project root, Dove state directory, Pi session
  directory, provider capture file, and output log, even when scenarios share
  a parent output directory or run concurrently.
- The summary records the resolved paths only in local evidence; user-facing
  redacted evidence must not expose absolute paths, prompts, or tool arguments.
- A scenario may optionally seed project files, but it must not touch the
  repository's managed release, global Pi state, or the user's real project.

### R2. Graceful RPC lifecycle

- After the final `agent_settled` or preflight error, the harness requests the
  final state/statistics and closes stdin so the RPC host can perform its own
  shutdown path.
- `SIGTERM`/forced kill is reserved for an actual harness timeout or an
  unresponsive child and is reported as a harness failure, never as a normal
  request result.
- The summary distinguishes request terminal state, host exit status, and
  harness timeout; a normal completed scenario has `exitCode: 0` and no signal.

### R3. Multi-turn user workflow descriptors

- The harness accepts a small scenario descriptor with ordered steps for
  slash-command-like settings, prompts, continuation/follow-up, and diagnostic
  snapshots.
- Steps are sent only after the preceding request is settled, matching normal
  interactive use; a failed step stops the scenario and preserves evidence.
- Built-in scenarios cover: read-only inventory, formal multi-file work,
  `/mode` plus `/dove-thinking`, `/dove-tools core` then `auto`, and a
  continuation request in the same session.

### R4. Strategy and lifecycle evidence

- Each step records prompt digest, event sequence, request terminal envelope,
  strategy snapshot, active tool count/names, and provider payload counters.
- Diagnostics correlate to the current step/request instead of selecting the
  last record from a shared ledger.
- The harness reports mismatches such as strategy source not changing after an
  explicit command, stale terminal evidence, or a fast-lane step creating
  formal/convergence artifacts.

### R4a. Session-identity fidelity

- Each scenario carries an explicit synthetic session/context key, analogous
  to Trellis' per-session active-task pointer, and uses it consistently for all
  steps and evidence.
- A scenario never infers its current request or task from a shared global file
  or from the last record in a parent directory.
- Continuation keeps the scenario session key while receiving a fresh logical
  request ID, so session continuity and request identity are tested separately.
- An explicit, known-but-unmatched session key must never fall back to an
  unrelated sole session file. Fallback is allowed only when the host provides
  no usable session identity at all, and the evidence must name that degraded
  source when it occurs.

### R5. Evidence-backed product fixes only

- If replay confirms a Dove defect, fix it at the owning boundary and add a
  regression through the public path or the narrowest typed unit boundary.
- Do not change tool-call, elapsed-time, provider-round, token, or context
  ceilings in this task. Do not add automatic compaction, cache keepalive,
  capability rewriting, or subagent routing.
- If a behavior is intentional (for example Auto retaining Pi's complete tool
  set), document the observed contract and improve its diagnostics rather than
  changing policy.

### R6. Documentation and reproducibility

- Document the scenario command, descriptor shape, isolation guarantees, and
  interpretation of normal exit versus timeout in both README files or the
  most appropriate existing diagnostic section.
- Keep a redacted baseline under this task's `research/` directory showing the
  pre-fix SIGTERM and shared-root behavior, followed by the corrected replay.

## Acceptance Criteria

- [ ] Two scenarios launched concurrently use disjoint state/session/provider
      paths and produce ledgers containing only their own request records.
- [ ] A deterministic successful faux-provider scenario exits with code `0`,
      no signal, and a completed terminal; only a deliberately timed-out run
      reports a forced kill.
- [ ] A multi-turn scenario executes at least three ordered user steps through
      the public RPC launcher and records one strategy snapshot per step.
- [ ] Explicit mode, thinking, and tool commands are observable in the next
      step's effective values and sources; Auto remains Pi-owned and does not
      unexpectedly narrow the tool set.
- [ ] Read-only inventory and formal execution steps retain their expected
      intent/lane and fast-lane steps create no formal/convergence artifacts.
- [ ] Continuation preserves the same session correlation while using a new
      logical request ID and does not reuse a prior terminal as the current one.
- [ ] A resolver regression proves a known unmatched Codex session does not
      inherit the sole session file from another window, while a genuinely
      identity-less pull-based invocation still uses the documented fallback.
- [ ] Redacted evidence contains no raw prompt, tool arguments, credentials, or
      absolute local paths.
- [ ] Any confirmed product bug has a focused regression; intentional behavior
      is recorded as a contract instead of altered speculatively.
- [ ] Focused replay tests, full Node tests, typecheck, doctor, Pi smoke, and
      `git diff --check` pass without modifying unrelated parallel work.

## Out Of Scope

- Raising or redesigning tool, elapsed-time, provider-round, token, or context
  limits.
- Injecting arbitrary provider failures, cancellation, or session replacement
  without a deterministic public seam; these remain a follow-up unless replay
  evidence identifies an existing seam that can be used safely.
- Replacing Pi's RPC protocol, changing Pi's built-in tool authority, or adding
  a second permission/approval system.
- Cleaning, resetting, or committing unrelated parallel task changes.

## Open Questions

None blocking. The recommended implementation is to extend the existing
black-box harness with scenario descriptors and graceful stdin shutdown, then
change product code only when a replay demonstrates a semantic defect.
