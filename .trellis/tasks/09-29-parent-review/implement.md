# Implementation plan: the parent integration review

## Ordered checklist

- [x] **1. The four cross-child gates.**
- [x] **2. The runtime spec, measured against its own limit.**
- [x] **3. The parent archived.**
- [x] **4. The gate.**

## Validation commands

```powershell
npm run typecheck; npm test; npm run test:installer; npm run doctor; npm run pi:smoke
node --import tsx --test tests/spec-context-budget.test.ts
```

## What this span produced, under the umbrella

```text
08-30-dove-audit-observability-regression, eight plan items:
  1 evidence and redaction contracts      dove_pi.py, 6 installer cases
  2 the log grows additively              schema 2 with run identity, timing, decision, release
  3 correlating lifecycle records         correlateExecutionRecords, 5 cases
  4 the audit summary                     summarizeExecutionRecords, 6 cases, built on the one reader
  5 fixtures that break the reader        four fixture files, 7 cases, found a real defect
  6 the isolated replay                   one case, and the driver exits zero on failure
  7 repeated maintenance explained        summarize_maintenance_logs, 6 cases
  8 full validation                       five commands, all green
```

## Recorded, not built

**Two of the child acceptance criteria remain unmet and are named**: the summary does not report cross-turn
stagnation or cache-prefix changes, because the record vocabulary has no kind for either. **The remaining open
tasks are not this umbrella own**: interop layer, real-user web access, usage review, and the adaptive formal
workflow.
