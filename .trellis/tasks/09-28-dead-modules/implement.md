# Implementation plan: modules nothing imports

## Ordered checklist

- [x] **1. The graph**: every relative import in `src` and `tests`, resolved to a file.
- [x] **2. The entry points**, named by hand with reasons.
- [x] **3. What is left**, read one by one.
- [x] **4. Remove or record**, then the gate.

## What the graph said

```text
src modules:                          103
imported by src or tests:             103  (nothing is unreferenced)
entry points excluded by hand:        cli.ts, pi-adapter/extension.ts, runtime.ts
orphans:                              0
```

**A clean result, and it became a check rather than a note**: `tests/module-graph.test.ts` asserts that every module in `src` is named
by some other file in `src` or `tests`, or is listed in the test with the reason nothing imports it. The next module added is therefore
either wired or named - and the entry-point list is where a reader finds out why `cli.ts` has no importer.

## The check was wrong once, and then proven able to fail

**It cried wolf on the first run**: requiring the path relative to `src` reported wired modules as orphans, because a sibling import says
`./work-mode.ts` and contains only the file name. The criterion accepts either the path or the name now - over-approximating what "named"
means, which for this check means staying silent.

**And it was given a negative control**, which no other check this session has had: a planted orphan in `src` makes it fail, and removing
the file makes it pass. **A test that cannot fail is not a test.**

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **Unused exports inside live modules**, which this round does not measure.
2. **The first real turn**, which needs a Pi host.