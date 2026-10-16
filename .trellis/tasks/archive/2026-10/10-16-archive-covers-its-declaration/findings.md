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

## 0.2.6: the user-facing half closed, and the gate that refused to move a tag

The operator approved a release for one reason - the published v0.2.4 archive carries the seventeen `.pyc` files and fails
the check this child added, while the repair lives in the assembly step - and that release is **out**: `v0.2.6`, published
2026-10-16T13:38:15Z, `Release` green in 4m38s, both `Compatibility` jobs green, four assets, and the **published** archive
measured at **348 entries and 0 caches**. Its manifest reads `releaseId 0.2.6+f019a8d`, tracking the tagged commit.

**The first attempt failed and the tag did not move.** `v0.2.5` was tagged on `410a73d` and its release job failed at
`npm run test:installer`: three cases in the Python readiness suite build a complete archive by construction, so
`REQUIRED_ARCHIVE_FILES` gaining the two `.trellis` entries made them stop being complete and they failed with
`Archive must contain exactly one complete Dove Pi release root` instead of the mode refusal they assert. Both fixtures
carry the two entries now, and this repository's rule for that moment - a red gate does not move the tag - is why the fix
is published as **0.2.6** with `v0.2.5` left pointing at the commit that failed. Nothing was published by the failing
attempt, and no public ref was rewritten.

**Two lessons, both about my own habits rather than the code.** `npm run test:installer` is a **separate command** from
`npm test`, and my local gate runs never included it - the release workflow does, which is the only reason CI caught this
while my green 994/994 did not. And the failure arrived through the one place in the repository besides the check itself
that enumerates what a complete archive is: the fixture. A requirement that breaks the thing built to satisfy it is a
requirement that has reached something real.

**One criterion stays unmet on purpose**, and it is now outside this child's reach rather than merely unverified: "the
rebuilt archive is byte-identical to the published one". The verifier sharpened it to a statement about the **published**
bytes - 231 of v0.2.4's 344 tree files are LF→CRLF converted and 113 are committed LF bytes, so neither `core.autocrlf`
setting reproduces that mix - and answering which CI step does the converting needs the **release job's own workspace**,
which exists only inside a run. The local conversion is named and proven (`core.autocrlf=true`, 5029 B/70 LF → 5099 B/70
CRLF); the published mix is transferred to whoever next has a release workspace to inspect, and the criterion says so
instead of being ticked.

## What the verification changed, and what is still not held


A verifier measured this child's claims on 2026-10-16 and found three real defects - all in the **words**, not in the code
path, and all now fixed:

- **The rule row read wider than its mechanism.** "The release archive carries nothing the manifest does not describe" is
  false: 201 of the 344 shipped tree files are outside `RELEASE_SOURCE_ROOTS` (mostly deliberately), and the verifier drove
  `validate_archive` on archives carrying one extra entry each and measured that `docs/extra.md`, `src/extra-generated.ts`,
  `notes/readme.md` and `.pytest_cache/CACHEDIR.TAG` **all passed**. The row now says what was established and names the
  residual limit. **This is the defect class the sibling gate child exists for, sitting in the row written to fix it.**
- **The enforcement covered two of the four names the assembly half removes.** `.pytest_cache`, `.mypy_cache` and
  `.ruff_cache` were removed by the stager and refused by nothing - so the sentence in this very file claiming the two halves
  matched was itself false. Both halves cover the same four names now, and the case loops over all of them.
- **Nothing executed the stager.** One case read it as text; its `.trellis` entries, its cache exclusion and its own guard
  were held by nothing, so an archive staged without `.trellis/spec` and `.trellis/workflow.md` passed the suite, passed
  readiness and would have published. Two things close it: `REQUIRED_ARCHIVE_FILES` names both files, and a case runs the
  stager and asserts the roots, the two `.trellis` entries and the absence of caches. Measured under two interpreters -
  `pwsh` could not be resolved by `spawnSync` here while `powershell` could, and the stager staged 347 files with the same
  three cache directories removed under each - so the case prefers the workflow's interpreter and falls back to Windows'.

## What this child did not do, stated instead of implied

- **The exclusion is by caching name, not by rule.** A directory called `__pycache__.old` still passes both halves. The four
  names are explicit so they can be extended deliberately, and the front door's row says where the next reader should look.
- **The criterion about digest scope cannot be satisfied as written.** It asked that the scope `sourceDigest` covers equal
  the scope the archive delivers; the verifier measured that **201 of the 344 shipped tree files are outside
  `RELEASE_SOURCE_ROOTS`** - pre-existing and mostly deliberate. What is true now is narrower: the archive carries nothing
  of the cache kind that the digest cannot see.
- **The published archive is not a function of the commit alone**, which is the sharper form of the byte-identity finding:
  231 of its 344 tree files are LF→CRLF converted and 113 are committed LF bytes, so neither `core.autocrlf=true` nor
  `false` reproduces it locally. The **local** conversion is now isolated and named - `core.autocrlf=true`, turning
  5029 B/70 LF into 5099 B/70 CRLF - so what remains unexplained is the **published** mix, which needs the release job's
  own workspace to chase.
- **The consequence for the published release is not this child's to settle.** v0.2.4 is Latest and fails the new gate.
  That is correct - it carries the defect - and how a superseded release is handled belongs to the parent's map, per this
  child's own design.
