# Baseline Evidence (2026-09-05)

## Public RPC lifecycle probe

Command boundary:

```powershell
python dove_pi.py --offline --mode rpc --session-dir <temporary-dir>
```

The probe sent one `get_state` JSON-RPC request and then closed stdin. The
process exited with code `0` and no signal after returning the response. This
confirms that EOF is a viable normal shutdown boundary for the harness; the
existing post-settlement `child.kill()` is test-driver behavior, not a Pi
runtime requirement.

## Existing harness replay

Three independent-looking invocations were launched with output files under a
shared temporary parent. Each summary reported `settled: true`,
`signal: SIGTERM`, `exitCode: null`, and `terminalConsistency:
completed-ledger-only`. The provider evidence showed the same 16 active tools
for lookup, continuation-readonly, and formal prompts because Auto intentionally
preserves Pi's active tool set.

The harness computes both `stateDir` and `sessionDir` from the output file's
parent directory. Therefore multiple scenarios in one parent reuse those roots
unless the caller manually separates output directories. This is a harness
isolation defect, not evidence that Dove leaks state during normal single-case
use.

## Interpretation

- Confirmed harness defects: forced normal shutdown and non-unique scenario
  roots.
- Confirmed Trellis isolation defect: `resolve_active_task` falls back to the
  only existing session file even when an explicit context key is present but
  unmatched. This can make a fresh Codex window inherit another window's task.
- Intentional contract: Auto does not narrow Pi's tool authority. Explicit
  `/dove-tools core|full|auto` must be tested as a user command before deciding
  whether any strategy behavior is wrong.
- Not yet proven: semantic strategy drift across multiple commands, stale
  terminal correlation during continuation, or product-level artifact leakage.

## Corrected replay evidence

The corrected harness now allocates a nonce-scoped project/state/session root,
keeps a synthetic session key for every step, and copies the requested JSONL to
the legacy output path after the isolated log is closed. A five-case focused
run passed (3 legacy one-turn cases, one four-step slash/state replay, and two
concurrent cases): successful faux runs reported `exitCode: 0`, `signal: null`,
and `harnessTimedOut: false`. Slash commands completed from their RPC response
without a model `agent_settled`, while model prompts waited for settlement.
Evidence events contain type/digest/whitelist projections only; the summary
does not contain the test prompt text.

The Trellis resolver regression also passes four cases: an explicit unmatched
Codex identity returns no active task and cannot delete the sole old pointer,
while an identity-less pull invocation retains the documented single-session
fallback.
