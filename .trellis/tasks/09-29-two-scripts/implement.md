# Implementation plan: the two scripts nobody runs

## Ordered checklist

- [x] **1. Both scripts, read first.**
- [x] **2. Run each, with a timeout.**
- [x] **3. Classify each.**
- [x] **4. The gate.**

## Both work, and one of them writes into the repository

```text
benchmark:interop   exit 0   and it is safe: it makes its own temp directory
                    { iterations: 25, providerRefresh: { meanMs: 3.36, p95Ms: 4.649 },
                      contextCompilation: { meanMs: 10.039, p95Ms: 10.785 } }

release:manifest    exit 0   it prints the path it wrote: <repo>/release.json
                    and git status then shows it as untracked, so running this entry dirties the tree
```

**The benchmark is the first thing this session has run that measures rather than checks**, and it answers in milliseconds - provider
refresh at 3.36 and context compilation at 10.04, over twenty-five iterations. **It is also the only script so far that is safe to run in a
working tree**: it makes its own temp directory and cleans up.

## And the pair explains the entry that cannot run

**`release:manifest` writes a manifest and `release:check` validates one.** The generator defaults its destination to the repository root; the
validator requires `--manifest`, `--archive`, `--checksum`, `--bootstrap` and `--asset`. **So the two entries are a pair whose second half
cannot be called the way it is written**, and the first half dirties the tree when it is - which is why the readiness check runs inside the
workflow, where the arguments are assembled, rather than from `npm run`.

## The file was removed, and nothing was invented

**`release.json` was deleted and the tree is back to one untracked directory.** No fix was made to either entry: **a caller that passes the
right arguments is what the workflow is**, and inventing them here would produce a script that appears to work and checks the wrong thing.

## Validation commands

```powershell
npm run benchmark:interop
npm run release:manifest
npm test
```

## Recorded, not built

1. **Anything unrunnable.**
2. **The first real turn.**