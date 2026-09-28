# Journal - aixi (Part 3)

> Continuation from `journal-2.md` (archived at ~2000 lines)
> Started: 2026-09-28

---



## Session 104: The .dove paths the READMEs name
<!-- trellis-session: v=2 fp=b3464dda796eec31 -->

**Date**: 2026-09-28
**Task**: The .dove paths the READMEs name
**Branch**: `master`

### Summary

The READMEs name .dove/state.json and .dove/tasks/<task-id>, and the code builds both - native-state.ts and native-artifacts.ts. The rest of the layout is internal and a front door is right not to enumerate it.

### Main Changes

- the round added the property nothing held: the existing drift case asserts a named path exists, and these two do not exist in a fresh checkout, so it could not hold them. The new case asserts that a path a front door names is one some code constructs - exactly what the previous round found the help violating
- and it errs toward silence: any mention of the name in src counts, so it cannot call a built path unbuilt
- the header own count was stale by one while this was written - it said nine cases where the file held ten - which is the same class as everything else measured here, found by counting while adding one
- the case was given a negative control: a planted .dove path in a README makes the suite fail, and removing it makes the suite pass

### Git Commits

| Hash | Message |
|------|---------|
| `4ad8e80` | test(docs): a front door may name a .dove path that does not exist yet, if code builds it |
| `30c6b9a` | chore(task): record the README paths, the property nothing held and the stale count |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 741 tests, 739 pass, 0 fail, 2 skipped. The drift suite is 11 of 11. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.


## Session 105: The commits the journal names
<!-- trellis-session: v=2 fp=3791d8acc6b363c4 -->

**Date**: 2026-09-28
**Task**: The commits the journal names
**Branch**: `master`

### Summary

Checked every commit the journal names against the object store: 267 distinct shas across four files, all resolving, and 104 sessions with headings across the three journal files. The index holds 104 rows with 104 distinct numbers. The trail is intact.

### Main Changes

- the tool refused the first attempt, because I passed a placeholder where a sha belonged: cannot resolve commit evidence, nothing was written. That refusal is the check I had decided not to build, and it is better placed - the writer will not record a commit that does not resolve
- what it cannot check is the past: an entry written when its sha did resolve, and later lost. That is why the measurement was worth making by hand, and why no test holds it - a shallow clone has fewer commits than the repository has objects
- and I got the reading wrong twice. The index is descending because add_session.py prepends, so a gap test written for ascending order reported the whole list as gaps
- then the corrected reading said sessions 4 to 30 were missing, and they are not: my own output was truncated at eight hundred characters and I read the cut as the end of the list. Measuring a second way, by counting distinct numbers, showed all 104 are there

### Git Commits

| Hash | Message |
|------|---------|
| `c472708` | chore(task): record the journal trail as intact, and the truncation I read as a result |
| `dc91b2f` | chore(task): archive 09-28-journal-commits |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 741 tests, 739 pass, 0 fail, 2 skipped. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.
