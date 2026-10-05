# Error Handling

## Overview

Errors cross process, provider, and host boundaries. Preserve the original cause, return structured diagnostics where possible, and fail closed for mutations.

## Error Types

Use `Error` with actionable messages at the boundary. Structured results should include exit code, stdout, stderr, duration, and timeout/cancellation state. Provider health exposes `healthy`, `degraded`, or `lightweight` plus an issue list.

## Error Handling Patterns

- Catch errors at CLI, Pi command, and child-process boundaries.
- Convert unknown values with `error instanceof Error ? error.message : String(error)`.
- Record mutation intent before provider calls and a completed/failed/reconciled ledger event after them.
- Block Trellis mutations when compatibility or health is not sufficient; do not silently fall back to another authority.

## API Error Responses

Pi tools return structured JSON-safe payloads on success and throw an actionable error on failure. CLI commands print JSON for machine-readable status and use a non-zero exit code for failures. The TypeScript CLI has one terminal error boundary that emits exactly one `{ok:false,error:{code,message}}` object without a runtime stack. `rpc` and `mcp` reserve stdout for protocol frames and write startup/dispatch diagnostics to stderr instead.

## Common Mistakes

- Reporting success after only one side of a Trellis/Dove mutation persisted.
- Including raw secrets or full command output in error messages.
- Treating unsupported Trellis major versions as healthy.

## Aggregate shell timeout contract

The Pi adapter applies `DOVE_PI_SHELL_TIMEOUT_SECONDS` to aggregate `bash`/`powershell` verification
commands (`go test`, `npm test`, `pytest`, `cargo test`, and similar). The default is 240 seconds;
`0` disables the fallback and an explicit tool `timeout` always wins. This prevents a Git Bash pipeline
from waiting behind inherited child handles until the host emits only `This operation was aborted`.
Pi's own process backend then returns `Command timed out after N seconds` with partial output. Ordinary
commands remain unchanged. Invalid or negative overrides fall back to 240 seconds with a diagnostic
reason rather than restoring an unbounded wait.

**What that list covers is now written at the call, not inferred from the expression.** Everything outside it gets
no timeout at all, so the list *is* the difference between a bounded wait and an unbounded one - and until now the
only place it existed was a regular expression. The coverage is narrower than it reads: measured against the
expression above, `pytest -q` and `python -m pytest -q` do **not** match, because the trailing word boundary fails
after the space the `pytest` alternative consumed, while `pytest`, `pytest tests/...`,
`python -m pytest tests/... -q`, `npm test`, `npm test -- --watch`, `make test` and `go test` all do. A field run
then hung twice - once for six and a half minutes, once for forty-five - against a ledger that stopped one
millisecond after the call started and held no record saying whether a timeout had been applied or that a call was
still running. So every shell call now writes a `tool.started` record carrying `timeoutApplied` and, when it
applies, `timeoutSeconds` and `timeoutReason`; the refusal reason is one of the values the function returns rather
than a sentence. **The call that has not returned is `tool.started` with no `tool.observed`**, which
`projectExecutionDiagnostics` reports as `unterminatedToolCalls` (the shape `unterminatedRequests` already uses).
**The command is not persisted**: a digest and a bounded length only, joined back to the host's own session
transcript by `toolCallId`.

**This makes a hang legible, not shorter.** A call outside the list can still run until the outer watchdog, and
giving every command a timeout is a separate decision - it would change the behaviour of the ordinary commands the
paragraph above deliberately left alone.

Required tests cover aggregate/ordinary/explicit/disabled/invalid cases, the timeout stance the new record carries
for a covered and an uncovered command, and one real `createBashTool` execution that verifies the structured
timeout error.

## Shell selection contract

`dove-pi shell` only manages Pi's native `shellPath` field. `auto` removes that field in the chosen
scope and returns resolution to Pi: on Windows it prefers known Git Bash locations and then `bash.exe`
on `PATH`; on Unix it prefers `/bin/bash`, then `bash`, then `sh`. Project `.pi/settings.json` overrides
global `PI_CODING_AGENT_DIR/settings.json`. Writes preserve unrelated settings and use an atomic rename;
an explicit path must exist before mutation. The PowerShell tool remains independently resolved and is
never changed by Bash configuration. `doctor` exposes the effective shell or its resolution error.
