# Bug Analysis: Windows Specification Budget Drift

## 1. Root Cause Category

- **Category**: D/E - Test coverage gap and implicit assumption.
- **Specific Cause**: `tests/spec-context-budget.test.ts` measured checkout file bytes with `statSync`. Git's Windows checkout converted LF to CRLF, adding one byte per line. `personal-agent-request-runtime.md` was 24,440 bytes with LF but 24,844 bytes with CRLF, crossing the 24,576-byte limit even though the injected text contract was unchanged.

## 2. Why Fixes Failed

1. The first release failure exposed only the `npm test` step on the public page. The initial fix removed a plausible process-environment race without obtaining the authenticated test log, so it addressed a risk but not the failing assertion.
2. Local checks used an LF working tree and therefore could not reproduce the Windows checkout byte count.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|---|---|---|---|
| P0 | Test coverage | Measure context bytes after CRLF-to-LF normalization and assert LF/CRLF equivalence | Done |
| P0 | Specification | Define routed-spec budgets over normalized UTF-8 text | Done |
| P1 | Debug process | Retrieve authenticated Actions logs before changing code after a release-only failure | Done |
| P1 | Release history | Never reuse failed immutable tags; advance patch version | Done |

## 4. Systematic Expansion

- **Similar issues**: Any test using filesystem byte size for logical text content can differ by checkout line endings.
- **Design improvement**: Content contracts should measure the serialized representation consumed by the runtime, not storage artifacts controlled by Git checkout settings.
- **Process improvement**: A local green run is insufficient evidence for release-only failures; use the runner log as the discriminating signal.

## 5. Knowledge Capture

- [x] Updated `.trellis/spec/backend/personal-agent-runtime.md`.
- [x] Added explicit cross-line-ending regression coverage.
- [x] Recorded immutable `v0.1.3` and `v0.1.4` failures in task artifacts.
- [x] No template sync path exists in this repository (`src/templates/markdown/spec/` is absent).
