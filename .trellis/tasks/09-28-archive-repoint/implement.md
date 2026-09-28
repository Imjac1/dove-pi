# Implementation plan: whether the tool is mine to fix

## Ordered checklist

- [x] **1. The hash file**, and whether the archive script is in it.
- [x] **2. The consequence, or the fix.**
- [x] **3. Verification, if a fix was made.**
- [x] **4. The gate.**

## The measurement, and the assumption it settled

```text
.trellis/scripts/task.py in .trellis/.template-hashes.json:  yes, line 88, with its sha
tracked scripts entries in that file:                          68
```

**The tool is tracked, so the assumption this session had been making is correct** - but it was an assumption until this round, and it is
the kind that decides whether a fix is worth making.

## The consequence, recorded where the next person looks

**The pointers will break again on every archive**, and the fix is not this repository to make: a `trellis update` may replace the script.
What is ours is to repoint the entries after an archive, and to know that a fresh archive has just done it again.

The correction sits in the repo-owned section of `AGENTS.md`, beside the one about the workflow document path, and in the same style - the
wrong path written without code marks, because the documentation checks read code spans.

**No check was added**: the three pointers that remain are the ones whose files are gone, and a check over the rest would go red on every
archive, which is the thing this round established cannot be fixed here.

## Validation commands

```powershell
python ./.trellis/scripts/task.py archive <task> --skip-branch-validation
npm run typecheck
npm test
```

## Recorded, not built

1. **The archive layout**, which is not the question.
2. **The first real turn**, which needs a Pi host.