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

Required tests cover aggregate/ordinary/explicit/disabled/invalid cases and one real `createBashTool`
execution that verifies the structured timeout error.

## Shell selection contract

`dove-pi shell` only manages Pi's native `shellPath` field. `auto` removes that field in the chosen
scope and returns resolution to Pi: on Windows it prefers known Git Bash locations and then `bash.exe`
on `PATH`; on Unix it prefers `/bin/bash`, then `bash`, then `sh`. Project `.pi/settings.json` overrides
global `PI_CODING_AGENT_DIR/settings.json`. Writes preserve unrelated settings and use an atomic rename;
an explicit path must exist before mutation. The PowerShell tool remains independently resolved and is
never changed by Bash configuration. `doctor` exposes the effective shell or its resolution error.
