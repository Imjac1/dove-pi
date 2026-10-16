# The specification pages' prose citations drift, and nothing watches them

## Goal

`tests/spec-anchors.test.ts` holds the **mount-point table's** citations against the declarations they name, and holds
every other citation on every page only to the floor: the path resolves and the line exists. Measured 2026-10-17, while
repairing the citations one edit had moved: **three named citations on two pages were already stale before that edit**,
and the pre-edit file is the evidence. `personal-agent-field-run.md`'s `extension.ts:1113` was a comment rather than the
strategy-snapshot assembler; `personal-agent-mode-format.md`'s `:3490` was a terminal flag rather than the call building
the mode block, and its `:2331` was a request-metadata lookup rather than `loadWorkModeFromDirectory`.

## Background

- **The three sites above**, each repointed during that repair to the declaration its sentence names - `:1116`, `:3635`,
  `:2460` - and each verified by reading the new line.
- **What the repair proved and what it did not.** The mount page's inner `:N` citations were shown identical before and
  after that edit, so they were moved to the line they had always meant. Whether each **holds** the claim its sentence
  makes is a different question, and it was not asked.
- **Why nothing caught it**: the door's own header says the mount table is the only table it checks by rule, and this
  repository's front door says the same in prose - the other citations are held to the floor, which a stale citation
  satisfies.

## Requirements

- **R1** Every prose citation on the pages that cite `src/pi-adapter/extension.ts` is read against the line it names, and
  each is either **confirmed**, **repointed**, or recorded as **the sentence being wrong**. Repointing is done by
  content, never by arithmetic - the arithmetic is what produced the nonsense range this repository has recorded.
- **R2** The scope is the pages that cite that file, because that file is the one measured to shift. Whether the same
  holds for other cited files is the same question applied elsewhere, and is answered by the same method if it is asked.
- **R3** A citation whose sentence no longer matches any declaration is **recorded rather than deleted**: the sentence
  may be the thing that is wrong, and deleting the citation would hide that.

## Acceptance Criteria

- [ ] **AC-1** The count of prose citations examined is stated **with the search that produced it**, and each is
      classified confirmed / repointed / sentence-wrong.
- [ ] **AC-2** Every repoint names the declaration it landed on, and the line was read to check it.
- [ ] **AC-3** Any sentence found wrong is recorded with what it says and what the code says, in its own words.
- [ ] **AC-4** Gates: `npm run typecheck` clean, `npm test` 0 fail, `npm run test:installer` OK.

## Out of Scope

- **Adding a door** that checks prose citations: that changes the check surface, and this task measures what the current
  one misses.
- Repointing anything outside the pages that cite `src/pi-adapter/extension.ts`.
