# Implementation plan: what is genuinely undone

## Ordered checklist

- [x] **1. The standing corrections.**
- [x] **2. The surfaces.**
- [x] **3. What is left.**
- [x] **4. The gate.**

## The standing correction, re-measured and found accurate

```text
archived tasks                                181
archived curated pointers into .trellis       421   resolving 419   broken 2
pointing inside their own task directory       58   of which broken 0
pointing elsewhere                            625   and the 2 broken are among them
```

**The note numbers moved - it says 394 of 396 - but the note is not wrong**, because it frames them as a measurement at a time and because
its *rule* is exact: an entry whose path began with the task own directory stops resolving. **58 entries point inside; round 75 repointed them
all, and none is broken.**

**And this session archived some fifty tasks without breaking one entry of its own**, for the reason the note gives: the entries were curated
against paths *outside* the task. **That is a confirmation rather than a correction, and no third date was added** - the file has room, but a
note that gains a date every time it is read stops being readable.

## The surfaces, and no untouched block

```text
bin  engagements  installer  modes  scripts  src  tests
```

**Every top-level directory has been touched by this session**: the launcher, the engagement fixtures, the Python installer package, the three
modes, the scripts, the source and the suite. `__pycache__` is the tool own bytecode and the known noise floor.

## What is left, said plainly

**The read-and-run surface is exhausted.** Every behaviour table and required-test section in the specifications has been read, every command
and subcommand has been run, every script in `package.json` has been accounted for, and the standing notes re-measure accurately. **What
remains is not undone work but recorded findings** - two claims that cannot be checked as written, two script entries that do not work as
written - **and the first real turn, which needs a Pi host.**

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **Anything untouched.**
2. **The first real turn.**