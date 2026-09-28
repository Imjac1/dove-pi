# Dove audit observability and regression

## Goal

Explain Dove failures from bounded local evidence and prevent the archived startup/replay/tool-loop failures from returning.

## Requirements

- Correlate session, logical request, attempt, provider, tool, extension-resolution, and maintenance runs.
- Add schema-versioned maintenance evidence with duration, release identity, decision/no-op reason, selected extension, sync state, and bounded failures.
- Keep logs as evidence, not a second state store.
- Add a redacted audit-summary command for sessions and maintenance logs.
- Never output secrets, full environments, raw sensitive files, private prompts, or full tool arguments.
- Accept legacy records and label unavailable fields rather than guessing.
- Build isolated fixtures for startup conflict, six replays, fourteen duplicate tools, unchanged successful tools, late abort, and incomplete capture.

## Acceptance Criteria

- [ ] Summary reports lifecycle counts, abort reasons, duplicate requests/tools, stagnation, cache-prefix changes, and maintenance decisions.
- [ ] Legacy four-field maintenance logs remain readable.
- [ ] New maintenance logs explain repeated install/repair decisions and duration.
- [ ] Archived scenario replay has no duplicate Dove registration, request persistence, or tool execution.
- [ ] Redaction tests cover bearer/API-key patterns, credentials, private-key names, environments, prompts, and arguments.
- [ ] Full quality gate passes without touching real installation or Pi state.

## Out of Scope

- Remote telemetry, archive upload, or using logs as state.
