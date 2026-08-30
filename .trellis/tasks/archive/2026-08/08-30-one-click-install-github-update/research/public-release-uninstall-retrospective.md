# Bug Analysis: Public Release uninstall failed on a deep npm tree

## 1. Root Cause Category

- **Category**: D/E - Test Coverage Gap plus Implicit Assumption
- **Specific Cause**: The uninstall fixture used shallow managed directories,
  while a real Release contains npm dependency paths beyond the legacy Windows
  `MAX_PATH` boundary. `shutil.rmtree` received an ordinary Win32 path and
  raised `FileNotFoundError` for an existing 263-character dependency file,
  leaving the managed installation partially removed.

Initial hypotheses were long-path handling (45%), deleting the currently
executing Release (30%), and a concurrent filesystem race (25%). The failing
path length, its continued existence through `Test-Path`, successful deletion
through the extended-length form, and deterministic greater-than-260 fixture
raise confidence in the long-path cause above 95%.

## 2. Why the Earlier Fix Failed

1. The first implementation proved ownership and preservation semantics but
   only created a shallow `bin` marker. It never reproduced Release topology.
2. Unit and fixture E2E used temporary roots but did not include one real npm
   depth boundary, so install/update checks passed while public uninstall did
   not exercise the same filesystem contract.
3. The first tactical patch targeted uninstall alone. Systematic search then
   found the same deletion mechanism in failed staging cleanup and old Release
   pruning, which would otherwise repeat the bug during later updates.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|---|---|---|---|
| P0 | Architecture | Centralize Win32 extended-length conversion after managed-boundary validation | Done |
| P0 | Test coverage | Exercise uninstall, staging cleanup, and prune with files beyond 260 characters | Done |
| P1 | Specification | Require long-path Release-tree coverage for every recursive managed deletion | Done |
| P1 | Release process | Run isolated install/version/doctor/update-check/uninstall against public assets | Done for discovery; rerun required on patch Release |

The first v0.1.1 patch acceptance then exposed a second, independent boundary:
PowerShell native exit status was read after a `Select-Object` pipeline. The
pipeline yielded the correct version text but `$LASTEXITCODE` was `$null`, so
`$null -ne 0` misclassified the runtime as missing. Tests must therefore include
at least one real native prerequisite process, not only scriptblock doubles.

## 4. Systematic Expansion

- **Similar issues**: failed staging cleanup and old-version pruning used the
  same ordinary-path `shutil.rmtree` call.
- **Design improvement**: managed ownership remains validated with normal
  resolved paths; only the final filesystem deletion call receives the Windows
  extended-length representation. This prevents the compatibility mechanism
  from weakening the path boundary.
- **Process improvement**: Release acceptance must use a realistic dependency
  tree, not only shallow synthetic managed directories.

## 5. Knowledge Capture

- [x] Updated the managed-install runtime specification.
- [x] Added deterministic Windows long-path regressions.
- [x] Searched and converted every managed recursive deletion path.
- [x] Recorded the public Release failure and required patch validation.
- [x] Template sync checked; this repository has no
  `src/templates/markdown/spec/` mirror.
