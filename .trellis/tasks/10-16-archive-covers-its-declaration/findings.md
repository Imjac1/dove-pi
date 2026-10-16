# Findings: the archive carried what the manifest could not see

## The defect, reproduced here rather than described

The verification of the v0.2.4 release compared the published archive against the tag's own tree and found a
**difference the manifest had no way to show**: seventeen `.pyc` files, present in no commit, embedding the CI builder's
absolute path (`D:\a\dove-pi\dove-pi\installer\...`) - the same leak mechanism this repository documents for a
`__pycache__` left in a copy, except this one shipped to every downloader. `sourceDigest` deliberately skips
`__pycache__`, so the manifest covered a **smaller scope than the archive delivered**, and v0.2.3 carried them too.

**The mechanism is now reproduced on this machine, which is what makes it a finding rather than an anecdote:**

- **no cache is tracked** - `.gitignore` carries `__pycache__/` and `*.pyc`, and `git ls-files` finds none;
- but five `__pycache__` directories exist here, untracked, and three of them sit **inside roots the release include list
  copies**: `installer/__pycache__` (7 files), `tests/__pycache__` (9), `scripts/__pycache__` (1) - **7 + 9 + 1 = 17**,
  the same count the published archive carries and the same count the new refusal reports as `...cpython-311.pyc and 16
  more`. Whether they are byte-for-byte the CI runner's files is not something this machine can say; that the route is
  real is now measured rather than inferred.

## The two halves, and the ordering fact the case discovered

**The enforcement**: `validate_archive` refuses an archive that carries a `__pycache__` component or a `.pyc`, naming the
entry and the count. It sits first inside the archive validation because it is about what must never be in an archive at
all. **The removal**: the release workflow deletes caches from the staged tree by name before compressing, and the two
halves cross-reference each other, because a change to either without the other is exactly what the refusal catches.

**Red first, and the first red was for the wrong reason** - which is worth writing down. The case originally drove the
whole command, and went red saying `Unable to read JSON from ... release.json` rather than anything about caches: the
command reads and validates the **manifest before it opens the archive**, so a placeholder manifest stops it and the
archive is never examined. The repair was to call `validate_archive` directly - the function that owns the rule - which is
the smallest thing that can fail when the refusal is missing; the full command path is covered by the release replay,
which passes a real manifest. The case now asserts the refusal's exit, the named entry, and the sentence.

Verified end to end on the artefact that matters: the published v0.2.4 archive is **refused** by the new check with
`Archive carries a cache: installer/__pycache__/__init__.cpython-311.pyc and 16 more`.

## What this child did not do, stated instead of implied

- **The design's stronger shape is not implemented.** It called for one assembly helper owning the include list, called by
  the workflow *and* by a local replay, so the rule would have a single home. What exists is the workflow's removal step
  and the check's refusal, cross-referenced - two places instead of one. The drift that shape was meant to prevent is
  therefore still possible; the refusal makes it loud rather than silent, which is weaker than the design and stronger
  than nothing. This is the first thing a follow-up should close.
- **The exclusion is by name, not by rule.** A cache directory with another name (`__pycache__.old`, a `.ruff_cache`
  variant not in the list) would pass both halves. The list is explicit for that reason: it can be extended deliberately.
- **A `.pytest_cache`-only archive was not tested.** The refusal's condition covers the four known names through its
  `__pycache__` and `.pyc` tests; the `.pytest_cache` entries are covered by the workflow's removal only.
- **The consequence for the published release is not this child's to settle.** v0.2.4 is Latest and fails the new gate.
  That is correct - it carries the defect - and how a superseded release is handled belongs to the parent's map, per this
  child's own design.
