# Implementation plan: the function that leaves it unknown

## Ordered checklist

- [x] **1. The owning function.**
- [x] **2. The tests, by its name.**
- [x] **3. The doctor claim.**
- [x] **4. The gate.**

## The method worked, and the count is the point

```text
the word "unknown" in the tests               0 references to this behaviour
the function name in the tests                6  (an import, a case that calls it twice, two patch targets, a caller)
```

**The owner is `source_release_manifest` at installer/manager.py:118.** Asking for the function and then for its callers found six
references where the word found none - **the seventh time a word-search has failed and the third time this direction has worked.**

## And my previous reading of the branch was wrong

**`manager.py:153` is a comment, not a state.** The code is `dove_extension=generated.dove_extension if generated else {}` - so *unknown*
is the **absence of a value**, written as an empty dict, and not a `"unknown"` string anywhere. The lead the last round recorded was built on
reading a comment as a state, which is the same class of mistake as reading a search result as a holder.

## The promise, held by name but not by consequence

```text
held       managed_installer_test.py:656   test_source_manifest_changes_when_source_changes, calling it twice at :660 and :662
held       release_installer_test.py:139, :157   two cases that patch installer.manager.source_release_manifest
exercised  the branch with no generator runs through those patched cases
not asserted  the consequence the comment names - a source install must not read as drift because its identity is empty
```

**So the function has holders and the specific consequence does not.** `extension-identity.test.ts:22` classifies drift and is the nearest
thing to a holder for it; it is about an adapter identity, not about a source install with no generator. **Named, not concluded.**

## The doctor schema-drift claim, still named

**Not checked this round.** It is the fourth claim of the continuation item and it is safety-shaped - *reports schema drift without reverting
it* - so it deserves the same treatment rather than a mention.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **Word-searches.**
2. **The first real turn.**