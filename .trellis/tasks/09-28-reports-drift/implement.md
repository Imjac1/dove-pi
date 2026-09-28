# Implementation plan: reports drift without reverting it

## Ordered checklist

- [x] **1. The reporting function.**
- [x] **2. What it does with the drift.**
- [x] **3. The tests, by its name.**
- [x] **4. The gate.**

## The chain, which has two halves and both are held

```text
core/extension-identity.ts:81   compareDoveExtensionIdentity(managed, project) -> DoveExtensionSyncState
                                in_sync | managed_newer | project_newer | diverged | managed_only | ...
managed-install-status.ts:97    inspectManagedInstall attaches syncState = compareDoveExtensionIdentity(...)
                                and inspects: it reads and reports, and writes nothing

extension-identity.test.ts:22-25   classifies in-sync, version drift, and same-version divergence
                                   :23 in-sync, :24 a version apart, :25 same version and a different digest -> diverged
managed-install-status.test.ts:9   reports managed extension degradation from local state without mutating it
```

**The claim is *doctor reports schema drift without reverting it*, and it is two claims.** *Reports drift* is held by the classifier and by
the inspector that attaches its verdict; *without reverting it* is held by the status case that asserts the report does not mutate. **Two
halves, two suites, both held.**

## The method, which is now four for four

**I looked for a drift function in the doctor and found none** - the doctor has profile conflict checks and nothing about drift. So the owner
was found the way the last three rounds found theirs: **read what the test imports**, which named `core/extension-identity.ts`, then ask for
that function company by name.

```text
word searches that failed        8
function-name searches that worked  4
```

**And the naming is a hint the repository keeps giving**: the function that reports without acting is called *inspect*ManagedInstall, the
case that proves it is called *without mutating it*, and the state that means drift is called *diverged*. **The names say what the code
promises**, which is why asking for a name has worked every time and asking for a word has not.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **Word-searches.**
2. **The first real turn.**