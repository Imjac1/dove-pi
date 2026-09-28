# The maintenance log grows additively

## Goal

Do the child second plan item: extend maintenance logs with run identity, timing, decision, release, path,
extension and sync summaries.

## Background: the result knew eleven fields and the log kept four

`MaintenanceResult` in `installer/manager.py` carries eleven fields and its `to_json` already emits release,
profile, degraded extensions and a path outcome. **The log writer took four of them away**:
`write_maintenance_log(layout, command, status, message)` wrote `{at, command, status, message}` and nothing else.
So the gap was not missing data - it was a writer that dropped what it was handed.

## Requirements

- **R1 - Keep the legacy call working**: no record passed means the four-field file, unchanged.
- **R2 - With a record, write schema 2** with run identity, timing, decision, release and extensions.
- **R3 - Label what has no vocabulary** rather than inventing it.
- **R4 - Hold it with tests** that use a temporary layout and never the real installation.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The legacy four-field write is unchanged when no record is passed.
- [x] **AC2** Schema 2 carries the additive fields.
- [x] **AC3** A field with no vocabulary behind it is labelled.
- [x] **AC4** The gate passes, installer suite included.