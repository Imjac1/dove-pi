# Technical Design: Dove Pi Multi-Turn Real-User Replay

## Change Boundary

Primary implementation surfaces:

- `scripts/real-dove-blackbox.mjs`: scenario descriptors, per-case roots,
  ordered RPC steps, graceful shutdown, and redacted step evidence.
- `tests/real-dove-blackbox.test.ts`: isolated/concurrent and multi-turn
  black-box assertions through the public launcher.
- `src/pi-adapter/extension.ts` and/or `src/core/*`: only if replay proves a
  strategy or terminal correlation defect; no policy thresholds.
- `README.md` and `README.en.md`: reproducible scenario usage and result
  interpretation.
- Task-local `research/` evidence and runtime specs only for confirmed,
  reusable contracts.

Explicitly untouched: installer behavior, global Pi state, user project data,
parallel convergence/task changes, provider limit constants, and Pi's bundled
RPC implementation.

## Scenario Model

The harness keeps a single child process for one scenario. A descriptor is a
JSON object with a `caseId`, optional project seed, and ordered `steps`:

```json
{
  "caseId": "tool-profile-sequence",
  "steps": [
    { "kind": "prompt", "message": "..." },
    { "kind": "prompt", "message": "/dove-tools core" },
    { "kind": "prompt", "message": "读取 package.json" },
    { "kind": "state" },
    { "kind": "stats" }
  ]
}
```

Slash-command-like steps use the public `prompt` command because Pi resolves
extension slash commands at the same host boundary as interactive input. The
harness waits for `agent_settled` before sending the next prompt. State/stats
steps are read-only RPC requests and do not start a model turn.

The scenario also owns a synthetic session/context key. This follows Trellis'
actual model: active task state is stored per AI session under
`.trellis/.runtime/sessions/<context-key>.json`, and `task.py current --source`
resolves that pointer instead of reading a global current-task file. The replay
key is recorded with every step and is never inferred from the most recent
ledger record.

The resolver contract has one important guard: if a caller supplies a known
context key and its session file is absent, resolution must stop with no active
task. The single-session fallback is reserved for callers that have no usable
identity (for example a pull-based sub-agent); otherwise a fresh window can
inherit an unrelated task.

Each scenario gets a unique root beneath the requested output root:

```text
<output-root>/<case-id>-<nonce>/
  project/
  dove-state/
  pi-session/
  run.jsonl
  run.jsonl.provider.jsonl
```

The summary contains only a path digest in redacted mode. Ledger reads are
performed from that scenario's `dove-state/execution.jsonl` after the child has
closed.

This is deliberately stricter than Trellis' repository layout: independent
output filenames are insufficient; both filesystem roots and logical session
identity must be isolated.

## Lifecycle

1. Spawn the public source or managed launcher with scenario-specific state and
   session environment.
2. Send the first step and record all JSONL events with a step correlation.
3. For each prompt, wait for `agent_settled`; then issue any requested state or
   stats read and continue.
4. After the final evidence response, call `stdin.end()` and wait for the host
   to exit normally. A bounded grace timer may kill only an unresponsive host.
5. Classify host exit independently from the latest request terminal. A normal
   host exit is not a request terminal and a request terminal is not a host
   exit code.

The RPC package has no explicit `shutdown` command; EOF is the least invasive
public lifecycle boundary. If a Pi version does not exit on EOF, the timeout
diagnostic records that compatibility gap rather than labeling the request as
failed.

## Evidence And Defect Classification

For each step, capture:

- step kind/index and a prompt digest when applicable;
- ordered event type/count and request response success/error;
- strategy projection and active tool names/count;
- provider payload counters from the faux provider;
- request terminal envelope and request ID;
- artifact facts (`formal task`, `convergence`, and ledger files) without raw
  contents.

Classify findings in this order:

1. Harness defect: incorrect isolation, lifecycle shutdown, correlation, or
   redaction.
2. Host/provider defect: Pi or faux provider cannot execute the public step.
3. Dove semantic defect: effective strategy, classification, or terminal state
   contradicts its documented contract.
4. Intentional behavior: record the observed contract and add documentation or
   diagnostics only.

The known-unmatched-session case is classified as a Trellis persistence defect,
not a Dove policy issue, and should receive a focused resolver regression before
the black-box harness relies on session isolation.

## Compatibility And Rollback

The existing single-prompt CLI flags remain valid and are normalized into a
one-step scenario. Existing summary fields remain readable; new fields are
additive and versioned. If graceful EOF is unsupported, only the harness
returns a lifecycle warning and the existing force-kill fallback remains
available behind the explicit timeout path.
