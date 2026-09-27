# Every path a specification names

## Goal

Check the strongest mechanical part of the rule that a specification describes the project as it exists now: **every
repository-owned path a specification names resolves.**

## Background: two measurements, and the wrong one first

The rule comes from the tool own skill: `.trellis/spec/` describes the project as it exists now. The checkable part is paths - and the
first version of the check got it wrong in a way worth recording:

```text
version 1: resolve each path relative to the file that names it
  -> 42 of 42 paths missing, including src/core/contracts.ts and .trellis/harness-surface.yaml, which exist
version 2: resolve from the repository root, or from the file directory, and only for paths this repository owns
  -> 42 paths, 2 reported
```

**Specifications name paths from the repository root** - `src/core/execution-ledger.ts`, `.trellis/harness-surface.yaml` - while a
handful are written relative to the document (`../backend/personal-agent-runtime.md`). A rule that tried one base reported 42 false
positives; a rule that tries both is quiet.

The two that remained are both in `guides/code-reuse-thinking-guide.md`: `src/templates/trellis/index.ts`, which belongs to the Trellis
tool, and `scripts/path/file.py`, which is a placeholder written as an example. **A guide gives examples; a specification makes claims
about this repository** - which is the scope the rule takes.

## Requirements

- **R1 - The check reads the specifications**, not the guides, and resolves each repository-owned path from the repository root or
  from the file own directory.
- **R2 - It reports zero today**, and it is proved to fail by a seeded specification that names a file which does not exist.
- **R3 - It states its limit**: it checks that a path exists, never that the sentence around it is still true. A specification can
  cite a real file for behaviour the file no longer has, and no path check can see that.
- **R4 - The two bases are explained in the check**, because the next person to write it will otherwise repeat version one.
- **R5 - The gate passes**: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** The check covers every `.md` under `.trellis/spec/backend` and `.trellis/spec/frontend`, and reports nothing.
- [ ] **AC2** A seeded file naming a missing path is reported, and the same file naming an existing one is not.
- [ ] **AC3** The rule, the two bases and the limit are in the check comments.
- [ ] **AC4** The measurement is recorded in the task, including the version that reported 42 false positives.
- [ ] **AC5** The gate passes.

## Out of scope

- **The guides**, which give examples rather than making claims.
- **Whether a cited file still behaves as the sentence says**, which is a reading and not a check.
- **The first real turn**, which needs a Pi host.
