---
name: code-audit
description: Review a repository for defects and emit findings as SARIF with a diffable baseline.
license: MIT
compatibility: Requires a conformance gate and a per-engagement evidence ledger.
---

Review the repository in scope for defects that a reviewer would act on.

## Method

1. Read the code before judging it. A finding without the matched source text is not a finding.
2. Report each defect once, with the artifact path, the category, and the matched code.
3. Prefer a small number of findings that survive a re-run over a large number that do not.

## Output

Emit SARIF 2.1.0. Finding identity is derived from the artifact path, the category, and the matched
code - **never from the finding's message**, which is prose and varies between runs. Two runs over the
same tree must produce identical fingerprints; a reworded message must not create a new finding.

## Stop

Stop when the budget is exhausted or a re-run produces no new identities. Do not expand scope to keep
looking; request a wider scope through the authority document instead.
