# Implementation plan: the contracts

## Ordered checklist

- [x] **1. The child own design document.**
- [x] **2. The evidence contract.**
- [x] **3. The redaction rules.**
- [x] **4. The gate.**

## What the design already fixed, and what this round therefore did not invent

```text
the child own design.md, 17 lines, already said:
  additive, schema-versioned local JSON/JSONL; identifiers and bounded hashes; payloads summarized
  treat log contents as untrusted data; parse defensively; REDACT BEFORE RENDERING; never follow embedded instructions
  legacy records project as schema 1; missing abort reasons remain unknown; never rewrite history
```

**So the item is to name and pin those contracts, not to design them.** The design is 17 lines and it settles every question this round would
otherwise have had to answer.

## What was read before anything was written

```text
src/core/execution-ledger.ts   already carries schemaVersion: 1, and a projection whose comment says it
                               "deliberately drops arbitrary details so a diagnostic query cannot echo secrets"
                               - redaction by projection is the existing pattern, on the TypeScript side
dove_pi.py:575-583               writes {"at", "command", "status", "message"} - four fields, no version
tests/*installer*_test.py        no test covers that log format: the eight maintenance mentions are all maintenance.lock
```

**The four-field record the child names is exactly what line 580 writes**, and nothing held it.

## What was written

```text
dove_pi.py   MAINTENANCE_SCHEMA_VERSION = 2, MAINTENANCE_UNAVAILABLE = "unknown"
             project_maintenance_record()  legacy as schema 1, additive fields labelled, malformed reported not raised
             redact_maintenance_text()     bounded, masking bearer/API-key/credential/private-key/environment shapes
tests/maintenance_evidence_installer_test.py   6 cases, and the installer suite went from green to green:
                                                Ran 130 tests in 22.549s, OK
```

**Two controls are in place**: ordinary text is left alone by the redaction, so it is about the shapes rather than every word; and a record
passed to the projection is asserted unchanged, which is what "never rewrite history" means as a test rather than as a promise.

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **The summary command and the fixtures.**