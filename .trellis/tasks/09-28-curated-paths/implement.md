# Implementation plan: the curated paths

## Ordered checklist

- [x] **1. The entries**, from every task context file.
- [x] **2. Resolution**, against the tree.
- [x] **3. The comparison.**
- [x] **4. Fix or record, then the gate.**

## The measurement

```text
context files:              236
entries:                    584   (20 of them the format own _example lines)
paths that did not resolve:  66
  of those, the same shape:  58   an entry pointing inside the task own directory
  moved with another task:    5   repointed to where the file now is
  the file is gone:           3   left as they are
after the repointing:         3
```

**Archiving a task breaks every context entry that pointed inside it**, because `task.py archive` moves the directory to
`archive/<month>/<name>/` and rewrites nothing. Fifty-eight of the sixty-six were exactly that, and nothing had noticed because the
entries read fine.

## What was fixed, and what was not

**Fifty-eight were repointed to the task own archive path, and five more to files that moved with another task archive.** The remaining
three point at files that are gone: a research document from a task that did not archive it, and `tests/module-graph.test.ts`, which I
removed two rounds after curating it. **Those are left alone**, because a curated entry is also a record of what was curated, and there is
no file to point at.

**No check was added.** One that every curated path resolves would go red after every archive, and a check nobody can keep is worse than a
measurement that says why.

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **The reasons**, which are prose.
2. **The first real turn**, which needs a Pi host.