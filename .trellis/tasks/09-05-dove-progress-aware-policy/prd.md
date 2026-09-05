# Dove progress-aware exploration policy

## Goal

Make long read-only investigations lighter and more自由 without allowing
repeated or failed tool loops to run indefinitely. A changing observation must
not be aborted solely because a fixed request-count budget was reached.

## Background And Evidence

- The public RPC path was replayed with a deterministic provider issuing twenty
  `read` calls against different existing files.
- Calls 1-12 completed; call 6 emitted the read-only advisory.
- Call 13 was blocked by the standard lookup hard stop (`12` calls), returned
  `Operation aborted`, and prevented the provider's scripted summary.
- The behavior is owned by `ProgressGuard` plus `readOnlyToolBudget()` in the
  Pi adapter, not by model context or token accounting.
- Repeated identical observations already have a separate fingerprint-based
  warning and hard stop and must remain protected.

## Requirements

### R1. Productive reads remain executable

When an idempotent call has changed input or produces a new observation, the
read-only count may be recorded and surfaced, but it must not by itself cause a
request abort. The model must be able to reach a final answer after a long
productive investigation.

### R2. Genuine no-progress protection remains

Unchanged successful observations, repeated failures, and repeated confirmation
questions retain their existing guard behavior. A progress guard must identify
why a call was blocked and must not label a productive call as stagnation.

### R3. Diagnostics are explicit and recoverable

Strategy/status/ledger evidence distinguishes an advisory read budget from a
terminal repeated-observation or failure guard. A terminal message includes the
evidence already collected and a concrete next action; generic `Operation
aborted` must not be the only explanation available to the user.

### R4. Real-user regression coverage

The public black-box path must cover both a changing-read sequence that exceeds
the former hard stop and an unchanged-read sequence that still terminates. The
tests must assert request terminal state, tool result, and host exit separately.

### R5. Compatibility and scope

Keep Auto Pi tool authority unchanged, do not add a second permission system,
and do not alter context/token/provider-window validation. Existing direct
`ProgressGuard` callers and summaries remain backward-readable; new fields are
additive where needed.

## Acceptance Criteria

- [ ] Twenty changing public `read` calls complete with a normal terminal and a
      final provider summary; no hard-stop `Operation aborted` occurs.
- [ ] An unchanged read sequence still reaches the repeated-success terminal
      within a bounded number of calls and reports its specific reason.
- [ ] Read-only advisory and terminal diagnostics expose used count, reason,
      request ID, and next action without raw prompt or tool arguments.
- [ ] Existing black-box isolation, multi-turn, preflight, and artifact tests
      remain green.
- [ ] Full Node tests, typecheck, doctor, Pi smoke, and `git diff --check` pass.
- [ ] README CN/EN and the backend request-runtime spec describe the final
      behavior without claiming that numeric resource values alone abort work.

## Out Of Scope

- Raising arbitrary provider/token/context ceilings or adding automatic
  compaction.
- Changing Pi's RPC protocol, tool authority, or provider lifecycle hooks.
- Fixing the separate provider preflight diagnostic mismatch before Pi emits
  `before_agent_start`; that remains a host-boundary follow-up.

## Open Questions

None. Recommended policy: read-only count is advisory only; repeated
observations and other no-progress guards remain the terminal safety boundary.
