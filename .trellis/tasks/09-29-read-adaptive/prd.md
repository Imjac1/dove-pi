# Reading the adaptive formal workflow

## Goal

Read the next P0 open task and find what remains of it.

## Background: a plan fully checked, a stale number, and a template check list

`09-01-dove-adaptive-formal-workflow` is P0 and in progress. Its plan has twenty-three boxes and **all of them are
ticked** - including a validation section that reports *235 TypeScript tests*, where the suite now runs 778. So the
plan was written long ago, the task was never archived, and its `check.jsonl` is still the template.

## What was measured, and the mistake made measuring it

```text
what I searched for                      what the repository actually calls it
  acceptance.md                            src/project-provider/native-artifacts.ts:9
                                             NATIVE_FORMAL_ARTIFACTS = ["prd.md", "design.md",
                                             "implement.md", "acceptance.md"]
  formalTaskId                             no such name
  .dove/tasks                              native-artifacts.ts:34
                                             join(resolve(projectRoot), ".dove", "tasks", taskId)
  phase values                             native-state.ts:17
                                             NativeTaskPhase = "intake" | "planning" | "designed" |
                                             "implementing" | "verifying" | ...
```

**My first search used the names the plan used rather than the names the code uses**, and reported *none* for three
of the four. **The second search found all four** - which is the ninth time this session has mistaken its own
expectation for the repository, and the first time it almost produced a false negative about *someone else work*.

## The verdict, measured rather than taken from the checkboxes

```text
R1 two request lanes            held: fast-lane test in pi-adapter.test.ts:546, and the ledger ids
                                are separate from the task id
R2 formal native artifacts      held: NATIVE_FORMAL_ARTIFACTS and nativeTaskDirectory under .dove/tasks
R3 non-blocking lifecycle       held: NativeTaskPhase and NativeGoalStatus in native-state.ts
R4 task/request separation      held: the request plan and task id are distinct, per the fast-lane case
R5 legacy compatibility         held: src/trellis-adapter reads .trellis
R6 real-experience validation   held: the validation section, though its numbers are from when it was written
```

**So the task is done as far as its own plan says, and the only thing left is the archive step it never took.**
Its stale numbers are left as they are: rewriting another task history to look current is not this round work.

## Acceptance criteria

- [x] **AC1** The P0 plan and check list were read.
- [x] **AC2** Its claims were measured against the source rather than taken from the boxes.
- [x] **AC3** The measurement mistake is recorded.
- [x] **AC4** The task is archived, which is what it was missing.