# Design: exclude them, and give the rule one home

## The decision, and the argument that settles it

Two shapes were available: **exclude caches from the archive**, or **let the manifest cover them**. The second is not a
serious option once the content is known, and the reason is worth writing down rather than assumed:

- the files **embed the builder's absolute path** (`D:\a\dove-pi\dove-pi\installer\...`), which is the leak this
  repository already documents for a copy's `__pycache__` - here it is shipped instead of left on a machine;
- they are **bytecode of the installer's own Python**, regenerated on first run and useless to the person who downloads
  them;
- and covering them would make `sourceDigest` a digest **of a particular build** rather than of what the release **is** -
  two builders would produce two manifests for the same source, which is the opposite of what an identity is for.

So: exclude. The manifest's scope and the archive's contents become the same set because the extra members are gone,
not because the description grew to describe them.

## Where the rule lives, so the two halves cannot drift apart again

The defect was not really "caches got in" - it was that **assembly and checking had no shared definition of what the
archive is**. The repair gives the rule one home and one enforcement:

- **one home**: a small assembly helper owns the include list *and* the exclusion, and both the release workflow and a
  local replay call it. Today the workflow has an eighteen-entry include list inline and this session's local replay had
  a hand-written copy of it in PowerShell, which is exactly the shape that drifts.
- **one enforcement**: the readiness check refuses an archive that contains a cache, naming the path. Enforcement is not
  a second definition of the rule - it is the thing that fails when the home is edited carelessly, and it is what makes
  the coupling loud rather than silent: change the helper without the check and CI goes red, which is the wanted failure.

## What this deliberately does not touch

- The **include list's composition** beyond caches. A folder missing from it would be a different defect with a different
  repair, and this child does not go looking for one - the verifier found the include list complete.
- The **digest algorithms**. `sourceDigest` skipping `__pycache__` stays as it is: once nothing of that kind is in the
  archive, the skip is a belt rather than a gap, and changing the algorithm would invalidate every manifest ever built.
- The **published artefacts**. v0.2.3 and v0.2.4 keep their bytes; how a superseded release is handled is the parent's
  map, not this child's.

## Rollback

One helper script, one workflow line, one rule in the readiness check, and one case. Reverting all four restores the
current behaviour exactly, and the case that makes the check refuse is the thing that would have caught this defect if it
had existed before the release.

## Trade-offs

- **A new assembly script** is more indirection than an inline zip step. It buys one definition of what the archive is,
  which the local replay has been re-typing by hand since the first release.
- **The readiness check gains a rule**, so it can now fail for a reason that has nothing to do with readiness in the
  narrow sense. That is deliberate: an archive whose contents do not match its manifest is not ready.
