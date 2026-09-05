# Corrected replay evidence (2026-09-05)

The public `python dove_pi.py --offline --mode rpc` path was replayed through
the black-box harness with a deterministic faux provider.

## Strategy and continuation

One session ran the ordered sequence `prompt`, `follow_up`, `/mode fast`,
`/dove-thinking off`, `/dove-tools core`, `follow_up`, `/dove-tools auto`,
`follow_up`, `state`. Four model turns received distinct logical request IDs
while retaining one synthetic scenario session key. The effective snapshots
were:

- initial lookup: `executionMode=standard(user)`, `thinkingPolicy=auto(auto)`,
  `toolProfile=auto(pi)`, 16 active tools;
- after explicit core: `executionMode=fast(user)`,
  `thinkingPolicy=off(user)`, `toolProfile=core(user)`, 9 active tools;
- after explicit auto: `executionMode=fast(user)`,
  `thinkingPolicy=off(user)`, `toolProfile=auto(pi)`, 16 active tools.

This confirms that Auto restores Pi's session-start tool authority and does not
implement a second Dove permission system. `off` is user-selected policy while
Pi controls the actual thinking level after Dove stops asserting one.

## Artifact boundary

Two isolated scenarios were replayed concurrently. A read-only inventory was
classified as `lookup/fast` and produced zero formal tasks, formal artifacts,
or convergence files. A formal multi-file planning request was classified as
`execution/formal` and produced one native formal task with the expected PRD,
design, implementation, acceptance, task manifest, and evidence artifacts.
The formal scenario had no convergence file because no convergence operation
was requested; this is additive evidence, not an implicit convergence gate.

All successful faux-provider runs exited with code `0`, no signal, and
`harnessTimedOut=false`. The harness now records redacted artifact counts and
relative paths in the summary, in addition to per-turn strategy sources and
logical request IDs.

## Preflight diagnostic boundary

An offline managed replay without provider credentials returns an RPC failure
classified as `provider-authorization-denied`. Because the failure happens
before Pi emits `before_agent_start`, the extension does not receive that
provider envelope; shutdown consequently writes `host-shutdown-preflight` for
the queued request. The summary retains both values and reports
`terminalConsistency: mismatch` with
`diagnosticGap: rpc-error-not-preserved-in-ledger`. This is recorded as a host
boundary limitation rather than a speculative lifecycle change.

## Read-only guard replay

A temporary trusted project extension drove the public RPC launcher with twenty
successful `read` calls, each against a different existing file and therefore
each producing a new observation. This is intentionally outside the normal
faux-provider scenario and was used only to inspect the current guard behavior.

- Calls 1-5 completed normally.
- Call 6 added the expected `read-only-budget` advisory.
- Calls 7-12 still completed normally despite changing observations.
- Call 13 was blocked by `Read-only exploration reached its 12-call limit`;
  Pi surfaced `Operation aborted` as the tool result and the model never
  reached its scripted summary response.

This is a confirmed user-experience defect in the current strategy policy: the
hard stop is request-count based and can terminate an active, non-repeating
read-only investigation. It is not evidence that token/context usage itself
caused the abort. The active replay task does not change this ceiling (R5);
the follow-up should compare a rolling/progress-aware advisory policy against
an explicit escape hatch, with regressions for both changing observations and
unchanged repeated reads.
