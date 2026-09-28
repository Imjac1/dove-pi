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


## Session 106: The acceptance criteria of archived tasks
<!-- trellis-session: v=2 fp=e701307330a4543d -->

**Date**: 2026-09-28
**Task**: The acceptance criteria of archived tasks
**Branch**: `master`

### Summary

Counted across 113 archived tasks: 209 criteria ticked and 497 unticked, with 88 tasks carrying at least one unticked. Split by origin, this session own 73 tasks have 380 unticked and none ticked, while the 40 older tasks are ticked in most places - so the practice exists in this project and I did not follow it.

### Main Changes

- the rounds updated the checklist in implement.md and left the PRD boxes alone, which is why the record of 73 tasks says nothing about whether their work was done
- three classes, read rather than counted: a placeholder criterion that reads TBD, a PRD whose boxes were never used, and a box simply missed. A number alone could not tell those apart
- this task own PRD is ticked because its criteria are met and verified here. The other seventy-two are not, and that is a decision: bulk-ticking would assert that every criterion of every round was met, and I cannot re-verify seventy-three rounds now
- the practice is the fix, and it is written here because this is what the next session reads: the PRD boxes are the record, and they are ticked when the work is done. No check was added - one that an archived PRD has no unticked box would be red on 88 tasks

### Git Commits

| Hash | Message |
|------|---------|
| `4481809` | chore(task): record the archived criteria, and that the worst share of them is mine |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 741 tests, 739 pass, 0 fail, 2 skipped. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.


## Session 107: The paths the task contexts curate
<!-- trellis-session: v=2 fp=75f8e638eefc2ab0 -->

**Date**: 2026-09-28
**Task**: The paths the task contexts curate
**Branch**: `master`

### Summary

Measured 236 context files and 584 curated entries: 66 paths did not resolve. Fifty-eight were the same shape - an entry pointing inside the task own directory, which archiving moves to archive/<month>/<name>/ - so archiving a task breaks every entry that pointed at it, and nothing noticed because the entries read fine.

### Main Changes

- five more pointed at files that moved with another task archive and are repointed to where those files now are; the result is 3 broken pointers where there were 66
- three point at files that are gone: a research document from a task that did not archive it, and tests/module-graph.test.ts, which I removed two rounds after curating it. Those stay, because a curated entry is also a record of what was curated
- the tool is what broke them: task.py archive moves the directory and rewrites nothing
- no check was added, because one that every curated path resolves would go red after every archive, and a check nobody can keep is worse than a measurement that says why
- the round also followed the practice set last round: this task own PRD boxes are ticked, because its criteria are met and verified here

### Git Commits

| Hash | Message |
|------|---------|
| `da3dbdb` | fix(tasks): repoint the curated context entries that archiving broke |
| `340493d` | chore(task): record the 66 broken pointers, the 58 that were one shape, and the 3 that stay |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 741 tests, 739 pass, 0 fail, 2 skipped. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.
