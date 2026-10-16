# Partial integration review: three children read together

## Added after the release: four children are now three archived and one open

**`10-16-archive-covers-its-declaration` is archived**, 4 of its 5 criteria met and the fifth transferred rather than
ticked: the rebuilt archive is content-identical to the published one but **not byte-identical**, because the published
bytes are a mix (231 of v0.2.4's 344 tree files LF→CRLF converted, 113 committed LF) that neither `core.autocrlf` setting
reproduces, and answering which CI step produces that mix needs the release job's own workspace. The local conversion is
named and proven. What the child did deliver is measured: staging removes exactly the caches (17 → 0, with 7 + 9 + 1 = 17
reproduced on this machine), the refusal names the entry, a case drives the stager, and the front door's row was narrowed
to what its door holds after a verifier showed a stray `docs/extra.md` still passes.

**The user-facing half is closed by `v0.2.6`** - published 2026-10-16T13:38:15Z, `Release` green in 4m38s, both
`Compatibility` jobs green, four assets, and the **published** archive measured at **348 entries and 0 caches**, with
`releaseId 0.2.6+f019a8d` tracking the tagged commit. The first attempt is part of the record: `v0.2.5` was tagged, its
release job failed at `npm run test:installer` because a complete-archive fixture had to grow with
`REQUIRED_ARCHIVE_FILES`, and this repository's rule - a red gate does not move the tag - is why the fix ships under a new
patch number with `v0.2.5` left on the commit that failed. Nothing was published by that attempt and no public ref was
rewritten.

**The remaining child has been refreshed to the current build.** Its sixth attempt failed on the same `http_429` as the
five before it, but it caught that the managed install was still reporting **0.2.4** while **0.2.6** is Latest - a pass
against a superseded build, which is what its first requirement exists to prevent. The install now reports
`Dove Pi 0.2.6 (Pi 1.0.0)`, pulled from the release, so when the provider window opens the reading measures what users
have.

**Why partial.** This task's design puts the integration review after the children are archived, and two of the four are:
`10-16-release-024` (archived, v0.2.4 is Latest) and `10-16-trustworthy-gate` (archived). `10-16-archive-covers-its-declaration`
is in_progress with one criterion unmet, and `10-16-two-project-reading` has taken no counting reading. So this reads what
has **landed** and says what the other two still owe - which is the part of the review that does not need them.

## What the three landed results say together

**The build users have is 0.2.4+m, and four fixes are certified inside it.** The release read the manifest from the
published URL and got `releaseId=0.2.4+25039c9` with `commit=25039c99…`, exactly the commit the tag names; the verifier
then proved it by content rather than by ancestry, comparing the published archive against `git archive v0.2.4` - 344
files, 0 different, with the one-way check that `declared-packages.ts` in the archive carries APIs that only exist after
the correction commit. The managed install was refreshed to `Dove Pi 0.2.4 (Pi 1.0.0)`, so a machine here runs what a user
runs.

**The gate can still fail for the wrong reason, one fewer way.** Two fixed-sleep fences are gone; the batch case now waits
for two child markers instead of sleeping 600 ms, and it fails on its mutation with `actual: 1`; the lock case builds its
own overlap and fails on a broken lock. The enforcer that keeps the next one honest was itself three times weaker than
the rule it was attached to when first written - seven files under `tests/fixtures/` invisible and a one-character
parameter rename enough to escape - and the repair that followed is the reason the front door's row now says what its
door holds instead of what would be convenient.

**The archive now matches what a second reader can check.** The `.pyc` files the release's verification found are gone
from staging (17 → 0, with 7 + 9 + 1 = 17 reproduced on this machine), the refusal fires on the published v0.2.4 archive
naming `installer/__pycache__/__init__.cpython-311.pyc and 16 more`, and the front door's row was narrowed to what was
measured after a verifier showed a stray `docs/extra.md` still passes.

## What reading them together adds, that no single child could see

1. **The gate that certified 0.2.4 was trustworthy for the reason the plan predicted, and for one it did not.** The
   order - release, then gate - was accepted with the consequence that 0.2.4 would be certified by a gate that could fail
   for an unrelated reason. Both release jobs were green, so the consequence never triggered. What did happen is the
   reverse: the gate's own rewrite needed a verifier to find that its door was weaker than its rule, which means the
   gate's quality was established **after** it had already been used to certify a release. Nothing went wrong; the
   ordering's real cost is that a gate's defects are discovered by the next thing that leans on it.
2. **Two children found the same defect class, three times.** The gate's scan read stronger than its rule; the release row
   read stronger than its mechanism; and the archive child's own disclosure claimed a coverage it did not have. Each was
   found by someone driving the mechanism rather than reading it - a verifier, twice, and the sibling child's verifier.
   That is now four rows in the front door stating their own limits, which is the pattern this repository should keep.
3. **The archive defect and the reading share a cause.** The 17 `.pyc` files are what a **run** leaves behind: the CI job
   executes Python before staging, exactly as this machine's own test runs left `__pycache__` under `tests/`. The reading
   child's recipe already handles it for its copies ("remove caches after any baseline measurement, because a copy
   carrying `__pycache__` tells an agent where the original lived") - so the same mechanism was documented for readings
   and unhandled for releases.

## What the other two still owe

- **`10-16-archive-covers-its-declaration`**: one criterion, byte identity against the published archive. The verifier
  sharpened it past what I had: the published archive is **not a function of the commit alone** - 231 of its 344 tree
  files are LF→CRLF converted and 113 are committed LF bytes, so neither `core.autocrlf=true` nor `false` reproduces it.
  The local conversion is named (`core.autocrlf=true`); the published mix needs the release job's workspace.
- **`10-16-two-project-reading`**: the first reading has taken **five attempts, none counting**, all with
  `failureKind=transient failureReason=http_429` and **zero tool calls, zero output tokens** - so the runtime behaved
  correctly and the provider window did not. The second project is **built and baselined** (generated Node fixture, 7
  files, `tests 4 / pass 3 / fail 1`, instrument digests recorded), so when the window opens the second reading is one
  command away.
- **The parent's own cross-child criteria** are therefore not answerable yet, and the honest state is the one the design
  anticipated: the goal's question has a measured answer for **one ecosystem and one mode**, not two.
