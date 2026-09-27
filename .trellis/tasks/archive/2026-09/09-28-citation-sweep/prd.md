# Citations name a thing, not a position

## Goal

Replace the line-number citations in this repository own code comments with the name of what they point at, and forbid the
pattern from coming back.

## Background: the measurement

Every comment in `src/`, `tests/` and `scripts/` was scanned for `<file>.ts:<line>` citations: **eighteen**, of which

| Category | Count | What it means |
|---|---|---|
| resolved and matching | 4 | the cited line still holds the named symbol |
| judgeable and **stale** | 2 | `failure-reading.ts:13` points `terminalForFailure` at a line holding `}`, and the withdrawn map points `evaluatePermission` at a comment |
| not judgeable by symbol | 7 | the citing line names no symbol, so no check can tell |
| pointing at a file we do not own | 2 | `types.d.ts:703-708`, the Pi host own type file, pinned by version |

**The specification files cite no lines at all** - zero across twenty-eight files - so the drift lives in comments, which is
where a reader trusts it most and where an edit to a *different* part of the file quietly invalidates it. Two are already
wrong, and one of them went wrong when the verifier extraction moved every line in `extension.ts`.

## Requirements

- **R1 - A citation names a thing.** In `src/` and `tests/`, an own-repository citation keeps the file and drops the line;
  where the sentence reads better with the symbol, the symbol is already there and stays.
- **R2 - Nothing is rewritten beyond the citation.** The sentences keep saying what they said; the sweep deletes positions,
  not claims.
- **R3 - Two categories stay**: a citation into the **Pi host own types** (a foreign file, pinned by version, not ours to
  keep in sync) and `scripts/mode-behaviour-map.mts`, whose citations **are its evidence** - it is the withdrawn map, and its
  finding is that specific lines did not mean what it claimed. Both are named and explained rather than silently allowed.
- **R4 - The pattern is forbidden**, by a check in the file that already checks what documents name, so the drift cannot come
  back with the next edit above a comment.
- **R5 - The check states its own limit**: it forbids a pattern and cannot judge whether a named file is the right one.

## Acceptance Criteria

- [ ] **AC1** No comment in `src/` or `tests/` cites a line of this repository, except the two stated categories.
- [ ] **AC2** The two stale citations are repaired by naming what they meant.
- [ ] **AC3** The check lives in `tests/document-drift.test.ts`, fails on a seeded line citation, and that failure is observed
      before the seed is removed.
- [ ] **AC4** The check comments state the foreign-file allowance and the one exempt file, with reasons.
- [ ] **AC5** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.

## Out of scope

- **Deleting the withdrawn behaviour map**, which is a decision about keeping a mistake as evidence rather than about
  citations.
- **Citations in archived task artifacts**, which are history.
- **The Pi host type citations**, which are not ours.
