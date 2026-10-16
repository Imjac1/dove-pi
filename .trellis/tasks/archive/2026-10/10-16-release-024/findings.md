# Findings: 0.2.4

## The release

- **Released 2026-10-16T11:23:04Z**, `v0.2.4`, **Latest**, four assets: `dove-pi-windows.zip`,
  `dove-pi-windows.zip.sha256`, `install.ps1`, `release.json`. Tag on `25039c9`; the job `windows-release` green in
  4m29s.
- **The four fixes are in it, by ancestry**: `git merge-base --is-ancestor` exits 0 for `80e4dad`, `f528375`,
  `d40f9b5` and `6eaffdb` against `v0.2.4`.
- **And by the published manifest**, which is the stronger reading because it comes from the URL a user fetches:
  `releases/latest/download/release.json` reports `releaseId` `0.2.4+25039c9` and `commit`
  `25039c99a9086d68aaf352b764035658590f3716` - the tag's commit, and identical to the local replay's `releaseId`, so the
  replay did predict the artifact.
- **What users get**: `releases/latest/download/install.ps1` answers HTTP 200 with 20,623 bytes, which is the tree's
  `install.ps1` byte for byte. The check only returns a status at all when the request goes through the proxy explicitly;
  `Invoke-WebRequest` does not honour the environment's proxy setting, which cost three failed checks earlier and is
  worth knowing before reading a failure as a release problem.
- **CI did not go red this time.** Both `Compatibility` jobs on the tag and on master are green, so the rule about not
  moving the tag was never triggered - which is also consistent with the failure that motivated it being a race rather
  than a broken case.

## The readiness check refused twice, and both times it was right

This is the part worth reading. `release:check` refuses when the tree has unstaged tracked changes, and it caught two
sequencing mistakes of mine in a row:

1. **I bumped the version and ran the checks with it uncommitted.** The manifest came out as `0.2.4+89d5bbd` - naming a
   commit that does not contain the bump - and the check refused. A release identity that names the wrong commit would
   have shipped a paragraph of metadata that is false.
2. **Then the task's own metadata was dirty**, from `task.py start` and the manifest curation, and it refused again. The
   files were tracked, so they counted.

The plan already had the order right - commit everything, then build the manifest, then check - and I ran ahead of it
twice. The useful shape of the lesson is not "be careful": it is that **the check validates the tree, not just the
artifacts**, and it will not let a release be cut from a working copy. Both refusals cost one command each, which is the
cheapest possible way to learn it.

## What this child did not prove

**Ancestry proves the commit, not the archive's contents.** Everything above establishes that the tag names a commit
containing the four fixes; it does not establish that the zip holds the files those commits touched. The archive is
assembled by an include list, and a file missing from that list would be invisible to every reading here. That check is
the verifier's, and it is written down here rather than left implicit because it is exactly the gap this repository keeps
finding in its own evidence.

## The verification, and what it found

The verifier took the gap above as its target and closed it with **content rather than ancestry**: it expanded the
published archive and compared every file against `git archive 25039c9` - the **tag's own tree**, not the working tree,
which is already past it - and reported **344 files compared, 0 different**. The stronger half of that evidence is
one-way: `src/pi-adapter/declared-packages.ts` in the archive contains `npmStoreCandidates` and `legacyGlobalStore`,
which only exist **after** the correction commit `6eaffdb`, so the first version cannot be what shipped. It also
recomputed the archive's SHA256 against the published `.sha256` (identical), and recomputed `release.json`'s
`sourceDigest` and `implementationDigest` independently from the tree - both identical, which also explained the
suspicious-looking sixteen-character repeat in `implementationDigest` as an intentional `.repeat(4)` rather than a
defect.

**One real defect, and it is not from this round: 17 `.pyc` files ship inside the archive**, and they embed the CI
runner's absolute path (`D:\a\dove-pi\dove-pi\installer\...`) - the same leak mechanism this repository already
documents for `__pycache__` in a copy. Two consequences make it worse than untidy: `sourceDigest` **deliberately skips**
`__pycache__`, so **the manifest covers a smaller scope than the archive delivers** - a declaration that does not
describe what shipped, which is the defect class this repository keeps finding - and `release:check` passes with them
present. Measured as pre-existing rather than introduced: v0.2.3's archive carries 17 of them too.

**It went to the parent's map rather than being repaired here**, because a reading that quietly turns into an unplanned
change is the thing this child's design forbids.

**What the verifier could not check, reported as not-passed rather than passed**: whether the build tree was exactly
`25039c9` (the digests cover 143 files and prove it **on the covered roots**; the `.pyc` simultaneously prove the tree
held untracked cache, so the honest claim is the narrower one), the 39 profile mappings one by one (counts and spot
checks agree with the authority), and a real `install.ps1` run on a clean machine (what was checked is static fit: every
path the installer references either exists in the archive or is generated by the payload).

**And it reported its own measurement error rather than hiding it**: its first probe for the leaked path used
`D:\\a\\dove-pi` inside a PowerShell double-quoted string, so one backslash layer was eaten and `\a` became a bell
escape - it read **0 matches** and nearly recorded "no path leak". That is the third time this session a door or a
verifier was needed because a string was mangled on its way through a shell.
