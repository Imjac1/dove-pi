# Implementation plan: the tests the runner runs

## Ordered checklist

- [x] **1. The disk set**: every `*.test.ts` under `tests/`.
- [x] **2. The loaded set**: what the pattern matches as the runner interprets it.
- [x] **3. The comparison, both directions.**
- [x] **4. Resolve or record, then the gate.**

## The measurement, and the question that answered it

```text
test files on disk:        75
nested (in a subdirectory): none - all at depth one
suite reported:            738 tests before this round, 739 after
```

**The behavioural question could not be answered here.** Three attempts - TAP, the spec reporter, and an explicit-file run - and none of
them reports which files were loaded: the reporters name tests, not files, and the explicit run produced nothing. **The precise question
answered it instead**: for a file at depth one both a single star and a double star match, so nothing depends on the interpretation. That
is a fact about the files, not about the glob.

## What that leaves, and the control that found it

**The assumption was written nowhere**, so it is asserted: a nested test file would make the pattern meaning-bearing, and the check says so.

**And the check failed its own negative control first.** Recursive `readdir` returns backslashes on Windows, so a filter looking for a
forward slash matched nothing and the check passed over a planted nested file. **This is the first check this session whose control found
it** - the previous three controls passed on the first try, which is exactly why the fourth was worth running.

## Validation commands

```powershell
npm test
npm run typecheck
```

## Recorded, not built

1. **The Python discovery**, which already works by pattern.
2. **The first real turn**, which needs a Pi host.