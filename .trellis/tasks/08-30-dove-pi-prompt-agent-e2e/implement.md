# Implementation Plan

## Change Boundary

Expected writes are limited to this task directory, disposable fixture/session
roots, and—only if a reusable evaluator is necessary—an isolated script plus its
tests. Dove runtime/product files remain unchanged during evaluation.

## Ordered Checklist

1. Record the clean Git commit, resolved global `dove-pi` path/version, doctor
   result, and non-secret default provider/model/context/output/thinking metadata.
2. Create and baseline a disposable Git project with a deterministic seeded bug,
   fast tests, analysis material, and no dependency on Dove source files.
3. Launch ordinary `dove-pi` TUI in that project while redirecting only session
   storage and Dove runtime state to temporary locations; retain the user's real
   provider/model configuration and default Auto behavior.
4. Execute the prompt journey in order: Chat greeting, response-only probe,
   Lookup, no-write Project Work, defect Execution, post-Execution Lookup/Chat,
   and Trellis project/continuation flow.
5. Observe visible startup, progress, approvals, tool calls, errors, final answers,
   and whether any turn appears stalled or truncated. Do not coach the Agent with
   internal tool names.
6. Recover machine-readable evidence from the isolated Pi session/event stream.
   If a field is unavailable, replay only that prompt through documented JSON/RPC
   with identical runtime/model/settings and label it as replay evidence.
7. Run `dove-pi cache audit` and `dove-pi token audit` against the isolated session
   root; compare Auto `hi` to the old 10,866-token baseline and distinguish first
   request size from later cache reuse.
8. Verify the fixture's final tests and Git diff, confirm no writes escaped the
   fixture/task evidence roots, and capture Trellis task/state changes.
9. Write `research/e2e-trace.jsonl` and `research/e2e-report.md` with pass/fail per
   acceptance criterion, prior-baseline comparison, failure ownership, and a
   readiness recommendation for a larger real-project trial.
10. Run the repository's existing typecheck/tests only if the evaluator itself
    adds reusable code. Always run `git diff --check` and confirm product files
    were not modified by the evaluation.

## Review Gates

- Primary result comes from ordinary TUI usage, not a mocked hook test.
- Runtime/model identity is known before interpreting budget or truncation.
- Chat/Lookup/Project Work/Execution behavior is judged from observed provider
  requests and tools, not only the planner's expected classification.
- The Execution case genuinely edits and verifies the fixture without evaluator
  tool instructions.
- Post-Execution prompts prove authority narrows again.
- No secret appears in saved evidence and no real project/provider settings are
  rewritten.
- Product fixes are not mixed into this evaluation task.

## Rollback and Cleanup

- Exit/abort the Pi session if normal use encounters a genuine safety/liveness
  failure; preserve the trace first.
- Remove only the verified temporary fixture/session/state roots after reporting.
- Leave the task open with a concrete blocker if provider access or the global
  launcher cannot run; do not replace them silently with a mock.

## Start Review Checklist

- The user approved real normal-flow provider use without arbitrary synthetic
  limits.
- The writable case is isolated without changing Dove's normal Auto behavior.
- The final artifacts and acceptance criteria are observable and reproducible.
- A subsequent explicit approval of this final plan is still required before
  task activation and execution.

