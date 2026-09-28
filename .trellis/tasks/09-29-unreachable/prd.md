# The ten modules nothing reaches

## Goal

Read the reachability register rather than assume it is a defect list, and act only where it is wrong.

## The register, with sizes and reasons

```text
 9376  src/core/loop-runner.ts                the reference runner; M1 places the effect claim at its dispatch line
 6142  src/core/checkpoint.ts                 action-boundary checkpoints; reached only through the unreachable loop
11166  src/core/harness-axes.ts               a reading, consumed by scripts/harness-axes.mts and its test
16224  src/core/failure-reading.ts            a reading, consumed by scripts/harness-failures.mts and its test
 4408  src/core/harness-round.ts              a reading, consumed by scripts/harness-rounds.mts and its test
 4934  src/core/harness-corpus.ts             a reading, consumed by scripts/harness-corpus.mts and its test
 4858  src/core/dispatcher.ts                 pre-existing, from before the framework work
 1113  src/core/dispatch-policy.ts            pre-existing, from before the framework work
 7858  src/adapters/loop-pi-agent-core.ts     a reference adapter for a loop the host owns
 2109  src/adapters/loop-scripted.ts          a reference adapter for a loop the host owns
```

**Four are readings, and their class has a reason**: *a measurement the harness acted on would be a control*, and a
control is what the mode files and the fence are for. **Two are pre-existing**, **two are a reference loop**, and
**two are adapters for a loop the host owns.**

## And the register is accurate, including where it is transitive

```text
dispatcher      5 matches in 5 files, including src/pi-adapter/subagent-provider.ts
checkpoint    148 matches in 18 files, including src/commands/task.ts
loop-runner     5 matches, all in tests, and no source file at all
```

**So `dispatcher` and `checkpoint` are referenced - from files that are themselves unreachable.** The walk is
transitive and the entries are about *reachability from an entry point*, not about mentions. **Reading the register
was the work; it is not a list of defects, it is a list of things that know what they are.**

## The two entries that were wrong, and they were wrong in wording

```text
before   "pre-existing, from before the framework work; no milestone in this task claims it"
after    "pre-existing, from before the framework work; no milestone claimed it while that task was open,
          and none has since"
```

**"This task" pointed at a task that is archived**, so the sentence had stopped being answerable by a reader. **And
a stray parenthetical left behind said *the entry below stays for the reason it always had*, when the entry below
had left the list two rounds earlier.** Both corrected; the entries themselves stand, because they are still true.

## Acceptance criteria

- [x] **AC1** The register is read, with each entry classified.
- [x] **AC2** Its accuracy is checked where it looked transitive.
- [x] **AC3** The two entries with stale wording are corrected rather than removed.
- [x] **AC4** The gate passes.