# Implementation plan: a holder for the absence branch

## Ordered checklist

- [x] **1. The branch and the helper.**
- [x] **2. The case.**
- [x] **3. The control.**
- [x] **4. The gate.**

## The case, and the control that is inside it

```text
compareDoveExtensionIdentity(undefined, project)     -> "project_newer"   an absent managed identity is not drift
compareDoveExtensionIdentity(undefined, undefined)   -> "unknown"         nor is an absent pair - a state, not a fault
compareDoveExtensionIdentity(identity(), identity({ implementationDigest: "different" }))  -> "diverged"
```

**The third assertion is the control and it sits in the same case**: the same function, given something to compare, *does* report
divergence. So the first two are about *absence* and not about a function that can never say `diverged`.

**And a planted control was run as well**: with the first expectation flipped to `diverged` the case fails with *CONTROL: this must fail*,
then the flip was reverted and the full suite is green.

## What the case says it does not hold

**Not that the absent identity is produced.** That is `source_release_manifest` leaving `dove_extension` empty and the serialiser omitting the
field - two links held by other cases. **Not anything about a real adapter beside a real project.** The case is about the classifier branch and
the three answers it gives for absence.

## The promise this closes

**It was the third candidate the audit found and the first one closed by adding a holder rather than by finding one.** The other two - the CLI
approval flag and the ambiguous target - were implemented and unheld and each got a case; this one was implemented, unheld, and is the last
link of a chain whose other four links were already held.

## One thing the round got wrong before it started

**The first attempt read `09-28-holder-for-absence`, and the task is at `09-29-`** - the date had rolled over and I had assumed it. **The
tool created the right directory and printed its name**; the only thing wrong was the path I wrote from memory, which is the same class of
error as the eight word-searches this session: **a guess that the measurement would have settled.**

## Validation commands

```powershell
node --import tsx --test tests/extension-identity.test.ts
npm test
```

## Recorded, not built

1. **The classifier.**
2. **The first real turn.**