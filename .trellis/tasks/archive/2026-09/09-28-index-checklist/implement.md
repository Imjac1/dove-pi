# Implementation plan: the entry point the workflow promises

## Ordered checklist

- [x] **1. Both indexes**: a Pre-Development Checklist line naming the table, and a Quality Check line naming `quality-guidelines.md`.
- [x] **2. The index check**: assert both sections are named, and state the limit.
- [x] **3. The gate.**

## What the change found, twice

```text
first run:  frontend lists personal-agent-runtime.md and it is not in this directory   <- my own new sentence pointed at a sibling
fix:        the rule resolves a name against the sibling directories too, with its limit stated,
            and the sentence uses the relative path a reader can follow
second run: the seeded expectation still said "does not exist" while the rule said "is not in this directory or any sibling"
```

**The check caught an inconsistency its own change introduced**, which is the strongest thing that can be said for it: the sentence
pointed at the router in another directory, and a rule that only looked in its own directory called a true sentence false. The rule was
refined rather than the sentence removed - and the seed text, which is the check own test, was updated with it.

**Two measurements recorded**: the gitignored backup trees are local and not a repository defect, and a wide sweep of the repository has
to skip them or it reads two stale copies of every document.

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/document-drift.test.ts
```

## Recorded, not built

1. **The workflow and the skills**, which are tool content.
2. **The first real turn**, which needs a Pi host.