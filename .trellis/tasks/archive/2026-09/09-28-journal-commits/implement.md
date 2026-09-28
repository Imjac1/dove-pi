# Implementation plan: the journal commits

## Ordered checklist

- [x] **1. The named commits**, from the journal files.
- [x] **2. Resolution**, against the object store.
- [x] **3. The comparison.**
- [x] **4. Fix or record, then the gate.**

## The measurement

```text
journal files:               index.md, journal-1.md, journal-2.md, journal-3.md
distinct shas named:         267
resolved in the object store: 267   (none missing)
sessions with a heading:     104   (journal-1: 51, journal-2: 52, journal-3: 1)
index rows:                  104, all distinct numbers, 1..104
```

**The trail is intact**, including the sessions where this session own sha slips were made and fixed by hand. **No check was added**, and the
reason is in the requirements: a shallow clone has fewer commits than the repository has objects, so a check over the journal would fail in
a checkout that is not this one - and a check that only passes here is worse than none.

## The reading I got wrong, twice

**First**: the index is in descending order, because `add_session.py` prepends, so a gap test written for ascending order reported the
whole list as gaps.

**Then**: the corrected reading said sessions 4 to 30 were missing, and they are not - **my own output was truncated at eight hundred
characters and I read the cut as the end of the list**. Measuring a second way, by counting distinct numbers, is what showed all 104 are
there. **This is the session recurring failure mode, a partial view read as a whole one**, and it is recorded here rather than in a note
somewhere else because this is where it happened.

## Validation commands

```powershell
git cat-file -t <sha>
npm run typecheck
npm test
```

## Recorded, not built

1. **Commits no entry names**, which is the normal case.
2. **The first real turn**, which needs a Pi host.