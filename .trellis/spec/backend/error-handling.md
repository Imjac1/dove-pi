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

Pi tools return structured JSON-safe payloads on success and throw an actionable error on failure. CLI commands print JSON for machine-readable status and use a non-zero exit code for failures.

## Common Mistakes

- Reporting success after only one side of a Trellis/Dove mutation persisted.
- Including raw secrets or full command output in error messages.
- Treating unsupported Trellis major versions as healthy.
