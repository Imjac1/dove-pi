# Technical Design: Progress-aware exploration policy

## Boundary

Primary code is limited to `src/pi-adapter/progress-guard.ts`,
`src/pi-adapter/extension.ts`, the public replay harness/tests, README files,
and the request-runtime spec. The implementation must not touch Pi's bundled
RPC host or provider budget accounting.

## Policy

`readOnlyToolBudget()` continues to calculate the existing warning/count values
for visibility and compatibility, but the hard-stop value is no longer used as
an unconditional terminal. `ProgressGuard.beforeToolCall()` makes the
fingerprint decision first:

1. Same-batch duplicates coalesce.
2. A repeated successful observation reaches the existing bounded stagnation
   terminal after its configured repeated-success threshold.
3. A new input or observation is allowed; the read-only budget can emit one
   advisory when crossed.
4. Existing failure and question-loop guards remain unchanged.

This keeps safety based on semantic lack of progress instead of a raw count.
The snapshot may retain `readOnlyToolCalls` and the configured historical
hard-stop field as diagnostic metadata, but a count alone cannot issue
`ctx.abort()`.

## Evidence Flow

`tool_result` already records the bounded observation fingerprint and adds the
advisory text. The harness will assert that a productive sequence has a
completed request terminal and that a repeated sequence has a
`progress-guard` terminal. Redacted summaries contain only digests/counts.

## Compatibility

The public function signatures and existing summary fields stay readable.
Tests that directly exercise a custom `readOnlyToolHardStopThreshold` must be
updated to assert advisory-only behavior. Repeated-success tests remain
unchanged except for checking that their terminal reason wins over the old
count limit.

## Rollback

The change is localized: reverting the progress guard and its focused tests
restores the prior fixed-count behavior. No state migration is required.
