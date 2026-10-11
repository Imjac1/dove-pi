# Quality Guidelines

## Overview

The project uses strict TypeScript, Node's test runner through `tsx`, and focused boundary tests. The current quality gate is typecheck, unit/contract tests, installer tests, doctor, and Pi smoke.

## Forbidden Patterns

- Pi imports in `src/core`.
- Direct `.trellis` file mutation outside the provider.
- Arbitrary shell strings where a registered capability or structured PowerShell executor applies.
- Silent last-write-wins synchronization or silent provider downgrade.
- Plaintext secrets in tests, fixtures, logs, snapshots, or public docs.

- **A count of something the code declares.** "The three observables are X, Y and Z" is worse than "the observables are
  X, Y and Z", because the second cannot be wrong about a number the reader can count. A count is a claim with no reader: the
  code changes, the sentence does not, and nothing connects them. That is how `GATE_LABELS` came to be documented as ten labels
  when the tenth plus the intensity ceiling made eleven. **Name the declaration, or name the members.**
  - **This one is a convention, not a control, and it is the only entry here that is.** Prose cannot be checked: the labels are
    kept true by the typecheck, the surface by its loader, the citations by a prohibition, and this is what remains. A
    convention that read as a control would be the defect the other entries exist to prevent.
  - **Structural numbers stay.** "One path may belong to two components" is a rule about the map rather than a count of an
    enumeration, and deleting the number would delete the rule.

## Required Patterns

- **A new script is a new file inside the type gate.** `scripts/**/*.mts` is in `tsconfig.json` include, because these are the
  commands a person runs and the readings the loop is judged by. They were outside it from the beginning, and the first thing the
  gate found when they entered was a reading printing `undefined` for the observable the whole verdict machinery is built around.
  `scripts/**/*.mjs` is the one exception, because plain JavaScript has no types to check.

- Use typed contracts at layer boundaries.
- Keep provider-qualified task IDs and execution IDs correlated but separate.
- Make mutations recoverable and lock concurrent provider writes.
- Add tests for mode boundaries, degraded paths, and failure/recovery behavior.
- Real RPC replay harnesses must allocate a private project, state directory,
  Pi session directory, provider capture, and logical session key per scenario.
  Do not infer a scenario's current request from a shared parent ledger.
- Treat an RPC host that reaches final evidence and exits after stdin EOF as a
  clean completion. Reserve forced termination for an explicit harness timeout.
- Black-box evidence is a diagnostic projection: retain digests, event types,
  and bounded counters, but never persist raw prompts, tool arguments,
  credentials, or absolute local paths.

- **A test file header that stopped describing the file.** A header is a cursor, not a summary: a reader arrives at a file to
  answer one question, whether the defect they care about is caught here. So it names **what class of defect the file holds and what it
  does not**, and it does not restate the cases below it. Two files in this repository drifted from that - the drift suite grew from two
  kinds of naming to six while its header still said two, and the readings suite grew four failure modes while its header described only
  the script layer - and both were files whose whole subject is a declaration that stopped being true.

## Testing Requirements

Run:

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
```

Prefer deterministic fixtures and one representative integration smoke over duplicating full end-to-end tests for every capability.
CLI integration fixtures that spawn child processes must pass temporary environment overrides through the child `env` option; do not mutate the test runner's `process.env` when parallel files may observe it.

**A test that makes a temporary workspace removes it.** Measured 2026-10-11: one full suite run left **92** directories behind, and this machine's temp directory had accumulated **49,044** of them across two months - about 3.2 KiB each, so on the order of 150 MiB of stale workspaces, and a directory that large is slower for everything that comes after it. Six files were responsible, and the two largest are not files that forget to clean up at all: `host-work-mode.test.ts` and `work-mode.test.ts` each remove *something*, so a search for `rmSync` calls them clean while the directories their own `freshRoot()` factories make are nobody's to remove. `tests/temporary-directory.ts` registers each directory on the file's own `after` hook, so the removal runs whether the file passed or failed; the leak went from 92 to **0**, counted on both sides of the same command. **Nothing in the front door enforces this**, deliberately: the static check worth having - "a file that calls `mkdtemp` also removes what it made" - is false for those two files, and a check with false negatives reads as coverage while missing the worst case.

**Read a failing case's own words before building on it.** A red that fails for a reason other than the one it was written to test is worse than no red: it reports a breach that is not there and hides the one that is. Filtering the output for the reason you expect is how that happens - in one run a case was red because a fixture's YAML had a Windows path inside a double-quoted scalar, and two such greps hid it until the raw output was read.

**State the encoding when the answer depends on text.** Reading a UTF-8 file with the platform default turned its non-ASCII content into mojibake and reported a section absent that was present. The command succeeded, exit code zero, and the reading was false; that is what makes it worth a rule rather than a note.

**A red on the way to green is a step, not a commit.** Either make it green in the same change, or record it as a skipped case with the reason travelling with it - and when the red is produced by reverting a change rather than by the current tree, say so in the reading, because a rebuilt red proves the change rather than the state.

**Do not read a claim about every member off a ranked, truncated view.** A table sorted by density and printed to the first twenty rows said every spec page had zero anchors; the page holding eighteen had sorted past the cut, and the sentence went into a commit message about the corpus. Count the population first, then say what is true of it - and when the answer is "none of them", check that the rows you did not print could not contain one.

## Code Review Checklist

- Does the change preserve the Pi/core/Trellis boundary?
- Are paths bounded and secrets excluded?
- Are failures and interrupted mutations visible and recoverable?
- Are docs, contracts, tests, and compatibility ranges updated together?

## Formal Convergence Quality Gate

**This repository own rule, and the one part of the gate that is stated only here**: only **blocking** and **regression** findings are
fixed in the current scope. Follow-ups are recorded without expanding the task, and a scope change or a serious unexpected risk is a
checkpoint rather than a quiet widening.

**The rest of the gate is the convergence contract, named where it lives** - so a reviewer can find it and argue with the rule rather
than with a summary of it:

- findings are classified and tied to an existing `AC-*`, and the acceptance state bounds what a formal task may do
  (`personal-agent-convergence-record.md`),
- two semantic no-progress reviews persist a criterion-bound checkpoint, and `ready_to_finish` is terminal for product mutation
  (the same specification),
- tool calls, provider rounds, elapsed time and token usage are **observation-only** until a separately approved threshold task defines
  calibrated limits - which is enforced by the closed observable set carrying no resource observable
  (`personal-agent-harness-loop.md`).
