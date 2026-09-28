# The mode suites read the directory the runtime reads

## Goal

Make the three mode suites load their mode through the resolver the host uses, so a test cannot validate a directory the runtime does
not read.

## Background: the measurement

The round asked whether the three shipped modes - `code-audit`, `pentest`, `trading` - are validated at all, and they are: each has its
own suite, and each reads the real files under `modes/`.

**And each spelled the path by hand**:

| File | What it wrote |
|---|---|
| `tests/code-audit-mode.test.ts:17` | `join(process.cwd(), "modes", "code-audit")` |
| `tests/pentest-mode.test.ts:16-18` | `join(process.cwd(), "modes", "pentest", ...)` |
| `tests/trading-mode.test.ts:14-16` | `join(process.cwd(), "modes", "trading", ...)` |

**While the host resolves through `workModeDirectory(root, name)`** (`work-mode.ts:778`), which is
`join(resolve(root), "modes", name)` plus a name check. The two agree today, and **nothing kept them in step**: a change to the resolver
would leave three suites passing against a directory the runtime no longer reads.

**That is the class the release digest had two rounds ago** - a test that spells a path is testing its own spelling - and the fix is the
same one: use the resolver.

## Requirements

- **R1 - The three suites load their mode through `workModeDirectory`**, so the directory under test is the directory the host uses.
- **R2 - Each says why**, because the next person to write a mode test will otherwise type the path again.
- **R3 - Nothing else changes**: the same files are read, and the suites pass unchanged.
- **R4 - The gate passes**: typecheck, the suite and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** The three suites import and use `workModeDirectory`.
- [ ] **AC2** The three suites pass, 36 tests, reading the shipped mode files.
- [ ] **AC3** The gate passes.

## A process note, recorded rather than backdated

**This task was created after the fix, for the second round in a row.** The slip a round earlier wrote down as a lesson has now happened
twice, which makes it a habit rather than an accident: **the rule for the next round is that the task exists before the first edit**, and
it is written here so the next reader can hold it.

## Out of scope

- **Changing `workModeDirectory`**, which is not what this round is about.
- **The other tests that spell paths**, which were not measured.
- **The first real turn**, which needs a Pi host.
