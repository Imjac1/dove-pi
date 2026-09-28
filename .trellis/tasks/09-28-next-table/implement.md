# Implementation plan: which table

## Ordered checklist

- [x] **1. Every behaviour table**, found and counted.
- [x] **2. Ranked.**
- [x] **3. The choice, with its reason.**
- [x] **4. The gate.**

## The map

```text
rows  tables  names a test?  file
  51       7    yes           backend/personal-agent-capability-runtime.md      <- annotated by the last two rounds
  50       6     no           backend/personal-agent-framework-core.md         <- the biggest, and the choice
  29       2     no           backend/personal-agent-audit-vertical.md
  26       2     no           backend/personal-agent-request-runtime.md
  25       1     no           backend/personal-agent-managed-install.md
  20       1     no           backend/personal-agent-harness-loop.md
  19       1     no           backend/personal-agent-convergence-record.md
  10       1    yes           backend/personal-agent-runtime.md                <- names a test, and is small
```

**Seventeen files carry tables, and only two name a test at all.**

## The choice, and the sharpening

**`framework-core.md` is the target**: the most rows, six tables, no test named, and the tables are about gates, scope, effects and caps -
**the security-shaped body of the framework**.

**And reading it sharpened the question past the one the round was asked to answer**: the file is six scenarios, each with the same six
sections, and the fifth is **`Tests Required`**. So the document states which tests are required in **six places**, which is a claim with an
author that is countable - and a better target than a table column.

## The first list, checked

```text
"paired: gate off versus gate on, executed actions 1 -> 0"   tests/loop-gate.test.ts:9, 36, 43   held, in those words
"invocation log records allowed actions"                     tests/loop-gate.test.ts:55, 62      held, in those words
"the external adapter satisfies the same cases"              no holder by that name              the adapter suite holds one of them
```

**Two of the three are held in the specification own words.** The third - adapter parity - has a suite that holds *one* case of it and
nothing named for the rest, so it is the first question of the next round rather than a conclusion of this one.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **Annotating the choice.**
2. **The first real turn.**