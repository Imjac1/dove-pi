# Implementation plan: who consumes the source manifest

## Ordered checklist

- [x] **1. The caller, named.**
- [x] **2. What it does with an empty identity.**
- [x] **3. The tests, by its name.**
- [x] **4. The gate.**

## The chain, five links, four of them held

```text
1  no manifest generator            source_release_manifest leaves dove_extension empty        held: three cases name the function
2  the serializer omits it          release.py:93  ({"doveExtension": ...} if it is non-empty)
3  validation is skipped            release.py:123 (if manifest.dove_extension)
4  the classifier answers for absence extension-identity.ts:82  if (!managed) return project ?
                                   "project_newer" : "unknown"
5  and project_newer is not diverged - so no drift is reported
```

**Link 4 is the one nothing holds.** `tests/extension-identity.test.ts` contains the word `undefined` zero times, so the `!managed` branch - the
branch that exists precisely so an absent identity does not read as drift - is not exercised by the suite that owns classification.

## And it corrects my own wording from two rounds ago

**I wrote that *unknown* is the absence of a value and not a state.** That was half right: the *manifest* omits the field and the serialiser
writes nothing, **and the classifier names the resulting condition `"unknown"`** - it is in `DoveExtensionSyncState` beside `diverged`. The
comment at `manager.py` was pointing at the classifier state, which the following round then read without connecting the two.

**So the corrected chain is a *designed* path with a *named* terminal state**, not an inert omission - and its last link is untested.

## The callers, read as the method requires

`source_release_manifest` is called by `install_source` (`installer/manager.py:250`), which runs inside `MaintenanceLock`, and it hands the
manifest to `prepare_source` (`installer/transaction.py:70`). **Three source-install cases exercise that path**, and the first compares the
whole source tree byte for byte before and after: `before == after`, so the install does not modify what it read.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **Word-searches.**
2. **The first real turn.**