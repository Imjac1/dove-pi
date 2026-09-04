# Baseline and External Guidance

## Local Evidence

- `.trellis/tasks/08-28-dove-pi-usage-review/prd.md` records real session
  telemetry: long sessions reached roughly 180k-211k prompt tokens, with one
  complete cache miss after 169 messages; capability/recipe execution was
  observed at zero and dispatch was rare.
- `.trellis/tasks/09-03-task-convergence-control/research/real-blackbox-findings.md`
  records the constraint that resource observations must remain non-blocking
  and that generic `Operation aborted` must be attributed through a Dove
  terminal envelope rather than by changing Pi's text.
- `scripts/real-dove-blackbox.mjs` already provides a source launcher,
  temporary session/state directories, JSONL capture, and RPC settlement
  collection. The new matrix should extend this harness.

## External Guidance Applied

- Agent products commonly separate user intent, execution policy, and provider
  telemetry. Combining these into one status projection reduces ambiguity while
  preserving separate owners for execution and diagnostics.
- Retry systems distinguish a logical user request from provider attempts. A
  terminal event should be idempotent and retain the most specific failure
  cause; generic shutdown is only a fallback when no specific cause exists.
- Long-context systems treat token and cache measurements as telemetry first.
  Automatic compaction or threshold changes should be introduced only after
  measuring representative workloads, because prefix changes can invalidate
  caches and alter model behavior.

## Decision

This task therefore prioritizes a read-only effective-strategy snapshot,
terminal attribution, and a public-path black-box matrix. It defers resource
limit changes, automatic compaction, capability rewriting, and subagent routing
to separate calibrated tasks.
