# Technical Design: Normal-user Dove Pi E2E

## Boundary

This is an evaluation task, not a product-change task. The primary subject is
the globally resolved `dove-pi` runtime at the currently pushed source state.
The evaluator may create fixtures, drive the TUI/RPC surface, and write reports
under this task, but it does not modify Dove product code when a defect appears.

## Test Topology

```text
normal terminal user
  -> `dove-pi` TUI in disposable project
  -> natural prompt sequence
  -> Dove request plan / Auto tool stage / project context
  -> Pi provider payload and real configured provider/model
  -> optional tool calls inside disposable project
  -> final response and same-session follow-up
  -> Pi session/events + git/filesystem evidence
  -> E2E report and defect ownership
```

The ordinary TUI is authoritative for usability, startup, visible progress,
approval behavior, and whether the Agent completes the requested work. Pi's
documented JSON/RPC mode may replay a prompt with the same runtime settings when
machine-readable tool/usage evidence cannot be recovered from the TUI session.
Replay results are labeled separately and never replace the TUI verdict.

## Fixture

Create a temporary Git project outside the Dove checkout. It contains:

- a small deterministic application with a fast local test command;
- one seeded bug whose expected behavior is unambiguous;
- enough source/docs for read-only analysis and planning prompts;
- optional `.trellis/` initialized through Dove's documented project command;
- a clean baseline commit so post-run changes are attributable.

The Agent receives a normal request such as “修复这个测试失败并验证结果”, not
an evaluator-authored tool script. The fixture boundary is checked after the run;
it is not enforced by removing normal Dove tools.

## Journey

1. Resolve `dove-pi`, record Dove/Pi version, doctor result, runtime source, and
   non-secret selected model metadata.
2. Launch TUI from the disposable project with ordinary Auto behavior.
3. Send `hi`, then a response-only Chinese cache probe.
4. Ask for a read-only project/package inspection.
5. Ask for a no-write analysis and implementation plan.
6. Ask Dove to fix the seeded defect and run verification.
7. Follow with a read-only question and then a simple summary, proving prior
   Execution authority is dropped while conversational continuity remains.
8. Exercise Trellis via the documented Dove project/skill flow and verify that
   guidance is relevant and non-duplicative.
9. Exit normally, inspect session events, token/cache audit, project diff, test
   result, and any extension/provider errors.

## Evidence Contract

For each user request, capture when available:

- exact prompt and classified intent/mode;
- TUI-visible startup/first-output/completion times and progress behavior;
- active/provider-visible tools and serialized schema size;
- Dove project-context/guidance presence and ordering;
- provider/model identity and declared limits, stop reason, usage, cache,
  retries, and number of provider turns;
- tool calls/results and approval interactions;
- final response and repository diff/test result.

Evidence is written under the task's `research/` directory in a redacted JSONL
trace plus Markdown report. Raw credential/config values are never copied.

## Failure Ownership

Classify failures as one of:

- launcher/install selection;
- Dove request planning/tool/context/budget;
- Pi lifecycle/session/TUI;
- provider/model metadata/transport/cache;
- extension interaction;
- fixture/evaluator defect.

A discovered Dove product defect is documented with a minimal reproduction and
recommended follow-up task. It is not repaired inside this evaluation.

## Safety and Cleanup

Use the real configured provider and normal Auto tools. Keep the writable project
and session trace temporary, never inspect credentials, and do not run install,
update, winget, publication, or real project task mutations. A human-observable
safety or liveness failure is the only reason to interrupt the normal journey.
Preserve redacted evidence before cleanup.

