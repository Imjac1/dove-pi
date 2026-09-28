# The promises on the reachability list

## Goal

Read what the unreachable-module list promises, and whether the tasks that promised it are finished.

## Background

`tests/harness-reachability.test.ts` holds the set of modules unreachable from the entry points to an allow-list, and the assertion is
**exact in both directions** - so the list cannot rot into fiction. Each entry carries a `reason` and a `wiredBy`:

| Field | What it means, in the file own words |
|---|---|
| `reason` | why the module is unreachable |
| `wiredBy` | **the milestone that will make the module reachable** |
| `wiredBy: null` | no milestone in that task makes it reachable, stated rather than left blank |

**So a non-null `wiredBy` is a promise attached to a task.** If the task that made it is finished and the module is still unreachable, the
promise was not kept - and unlike dead code, which the test catches, **an unkept promise is invisible**: the list stays exact, the suite
stays green, and the entry stays.

**This is the measurement**: read the entries, read the tasks, and say which promises are outstanding, which are kept, and which were
made by a task that no longer exists.

## Requirements

- **R1 - Read every `wiredBy` value** in the allow-list, and the reason beside it.
- **R2 - Establish the state of each task named**, from the task tree rather than from memory: active, archived, or not found.
- **R3 - Classify each entry**: promise outstanding and its task still open; promise outstanding and its task finished; promise kept; or
  no promise at all.
- **R4 - Do not "fix" a promise by deleting it.** An entry whose milestone is gone is a finding to report, and removing it from the list
  would be the opposite of what the list exists for.
- **R5 - The gate passes**: typecheck, the suite and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** Every entry is classified, with the task state it rests on.
- [ ] **AC2** Anything outstanding is reported as outstanding rather than quietly resolved.
- [ ] **AC3** The suite is unchanged, because this round measures a list rather than editing it.
- [ ] **AC4** The gate passes.

## Out of scope

- **Wiring any module**, which is the work the promises are about.
- **Editing the allow-list**, which the round explicitly does not do.
- **The first real turn**, which needs a Pi host.
