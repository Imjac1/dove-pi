# Design: Dove audit observability and regression

## Evidence Schema

Use additive, schema-versioned local JSON/JSONL. Correlation fields are identifiers and bounded hashes; payloads remain summarized. Maintenance records contain start/end/duration and decision details, or compatible start/terminal events when interruption evidence requires them.

## Audit Projection

Treat session/log contents as untrusted data. Parse defensively, redact before rendering, report malformed/incomplete counts, and never follow embedded instructions. Support concise human text and one machine-readable JSON document.

## Regression Harness

Use temporary `DOVE_PI_HOME`, agent state, source/managed roots, and fake provider/tool transports. Real `%LOCALAPPDATA%`, user Pi settings, network, and checkout mutation are forbidden.

## Compatibility

Project legacy records as schema 1. Missing abort reasons remain `unknown`; never rewrite history.
