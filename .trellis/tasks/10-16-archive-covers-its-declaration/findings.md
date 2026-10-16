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

## The single home, and the mistake that got pushed with it

`scripts/stage-release.ps1` is now the one place that says what an archive contains - the include list, the two `.trellis`
entries, the cache exclusion and the generated assets - and the release workflow's staging step is a call to it. Measured
both paths: from the working tree it stages **347 files and removes 3 cache directories**; from `-Ref v0.2.4` it stages
**344 and removes none**, because git's tree carries no caches at all - the same 344 the verifier compared, and an
independent confirmation that these files are untracked rather than merely unpushed.

**I pushed a red commit, and the honest description is that the gate did its job and I did not read it.** The gate run and
the commit were in the same command, and the first line of that output was
`✖ copies every root the digest covers into the archive the release job assembles` - `tests/release-manifest.test.ts` held
the workflow's `$include` array against `RELEASE_SOURCE_ROOTS`, so moving the array into the helper broke it. That is
precisely the behaviour a case holding two files equal should have, and it is the case that would have caught the original
two-files-one-rule drift. The repair points it at the helper - the same assertion, the file it reads changed - and the
suite is back to 993/993. `bc355cb` therefore went out red and the commit after it says so; no history was rewritten.

**A byte-identical local reproduction was not achieved, by either path**, and the measurement is worse than my expectation
rather than better: the published archive stores **LF** (0 CRLF, 203 bare LF in a `.trellis/spec` file) while staging from
a ref here produced **CRLF** (203 CRLF, 0 bare LF) - identical after normalising line endings, different as bytes. The
step in this pipeline that converts them was **not** isolated, so the helper's own doc was corrected against the
measurement instead of the intuition it was written from, and the criterion that asks for byte identity is left unticked.

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
