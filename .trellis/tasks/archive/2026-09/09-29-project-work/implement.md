# Implementation plan: the project work

## Ordered checklist

- [x] **1. The P0 task own PRD.**
- [x] **2. Its fifth item.**
- [x] **3. Do it or block it.**
- [x] **4. The gate.**

## The P0 is an umbrella, and three of its four children are archived

```text
08-30-dove-extension-identity-sync          archived 2026-08   done
08-30-dove-request-lifecycle-idempotency    archived 2026-08   done
08-30-dove-tool-loop-context-control        archived 2026-08   done
08-30-dove-audit-observability-regression   OPEN - and it is in the open task directory list
runtime-reliability-sync                    OPEN - the umbrella itself, which says "do not start the parent task"
```

**So the project remaining work is one child**: `08-30-dove-audit-observability-regression`, with six acceptance criteria and eight plan
items. **Its first item is *Define additive evidence and redaction contracts***, and that is where the next round starts.

## What it asks for, in its own words

```text
a summary reporting lifecycle counts, abort reasons, duplicate requests and tools, stagnation,
cache-prefix changes and maintenance decisions
legacy four-field maintenance logs staying readable
new maintenance logs explaining repeated install and repair decisions with duration
an archived-scenario replay with no duplicate registration, persistence or execution
redaction tests covering bearer and API-key patterns, credentials, private-key names, environments, prompts and arguments
the full gate passing without touching the real installation or Pi state
```

## And the name that was filled in rather than read

**This round curated two paths that did not exist, because the survey output truncates task names and one was completed from memory**: the real
directory is `08-30-dove-pi-runtime-reliability-sync`, not `-reliability`, and the list of open directories holds seven entries where the survey
showed a shaped list. **Same class as the nine word-searches**: a name written from what it was expected to be rather than what it is. **Both
curations were corrected against a directory listing rather than another guess.**

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The other four open tasks.**