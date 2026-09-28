# Implementation plan: the release gate, given artifacts

## Ordered checklist

- [x] **1. Build the stage**: the shipped roots plus `release.json`, in a temp directory.
- [x] **2. Zip it and checksum it**, with the same names the workflow uses.
- [x] **3. Run `release:check` with the five arguments.**
- [x] **4. Record the verdict**, and clean up.

## The walk, and its verdict

```text
stage: bin, installer, scripts, src, tests, .pi, modes, dove_pi.py, package*.json, tsconfig.json, README*, .trellis/{spec,workflow.md}
       plus release.json, zipped (1,025,299 bytes) with its sha256, install.ps1 beside it

run 1: exit 1  Refusing release readiness with untracked files: .trellis/tasks/09-28-release-gate-run/...
run 2: exit 1  Release tag v0.2.0-test does not match package.json version 0.2.0
run 3: exit 1  release.json commit 621790d7... does not match HEAD
run 4: exit 0  Release ready: v0.2.0 (0.2.0+621790d); assets=4
```

**Three refusals, each correct, and none of them a defect** - they were my inputs: a task directory I had just created and not
committed, a tag I made up, and a manifest built before a later commit. **They are the evidence the gate works**, which is why the round
walked to the pass instead of stopping at the first refusal.

## What the walk found in the suite

The spec names five kinds of refusal under one word - "dirty, mismatched, unsafe, checksum-invalid, or partial four-asset bundles" - and
the suite covered three and a half of them: the dirty case tested **unstaged tracked changes** while the **untracked-files** refusal was
untested, and neither the **tag** nor the **commit** mismatch had a case. **So a claim in the contract was ahead of its suite.**

Three cases added, mirroring the fixtures already there. The installer suite went from 111 to 114 tests, OK.

## Validation commands

```powershell
npm run release:manifest -- "$env:TEMP\dove-gate\release.json"
python scripts/check_release_readiness.py --help
```

## Recorded, not built

1. **A real install**, which writes outside the repository.
2. **The first real turn**, which needs a Pi host.