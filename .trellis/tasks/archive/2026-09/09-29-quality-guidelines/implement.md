# Implementation plan: the two quality guidelines

## Ordered checklist

- [x] **1. Both sections.**
- [x] **2. The checkability answer per requirement.**
- [x] **3. What holds each.**
- [x] **4. The gate.**

## Both sections are command lists, not claims

```text
backend/quality-guidelines.md:53-61   a code block: typecheck, test, test:installer, doctor, pi:smoke
frontend/quality-guidelines.md:23     one sentence: pi:smoke plus the full test suite for UI-affecting changes
```

**So the checkability question has a third answer here, and it is not the three the last rounds used**: these are not claims to hold or
qualify, they are *instructions to run*. **The rest of this round is what happens when you follow them.**

## Following them: pi:smoke passes, and release:check cannot run

```text
npm run pi:smoke      exit 0   it is `dove-pi --version && dove-pi --help` - the two commands this session has run all along
npm run release:check exit 2   and it always will: the Python tool requires --manifest, --archive, --checksum,
                               --bootstrap and --asset, and the npm entry passes none of them
```

**release:check is a script entry that cannot work.** The values it needs exist only while a release is being built - a manifest, an
archive, a checksum, a bootstrap and an asset - so the entry is either incomplete or written for a caller that passes its own. **The workflow
does**: test_release_workflow_runs_readiness_after_gates_before_publish is the case that holds that, which is why the readiness check runs
in CI and not from this script.

## Why no fix was made

**Inventing arguments would produce a script that appears to work and checks the wrong thing** - the failure mode every round since the
mode-format qualification has been watching for. **The entry is recorded as unrunnable rather than repaired**, which is the honest form of a
finding whose fix belongs to whoever decides what a human-run readiness check should check.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **Anything uncheckable.**
2. **The first real turn.**