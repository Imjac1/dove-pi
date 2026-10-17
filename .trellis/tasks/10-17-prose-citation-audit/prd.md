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

## What the audit found (2026-10-17)

**Method, and its limit.** The mount page's eighteen rows were parsed, and for each inner `:N` the last identifier named
before it in the same row was checked against the cited line; the named citations on the pages that cite
`src/pi-adapter/extension.ts` were read against their sentences. **The script's heuristic produced two false positives,
recorded rather than smoothed**: at `:1040` it blamed the identifier from an earlier clause (`SessionKeepaliveTimer`) while
the row's claim for that position is `new ExecutionLedger(...)`, which the line holds; and at `:2504` it blamed
`createActionPolicy` while the claim there is *"cleared at the session boundary"*, which `activeActionPolicy = undefined`
is. Counting those two out, **every citation on the page now names a line that holds its claim.**

**Nine citations were wrong, and none of them was this audit's doing** - each already pointed at a line that never held
its sentence, and the identity-proved repoint of the previous task had faithfully preserved those wrong targets:

| Claim the sentence makes | Cited | Where it actually is |
|---|---|---|
| the range brackets the eighteen registrations | `:3699` | `:3741` - the last one is `context` |
| `SessionKeepaliveTimer` | `:29` | `:30`, the import |
| `new ExecutionLedger(join(stateDir, "execution.jsonl"))` | `:917` | `:1040` |
| `loadWorkModeFromDirectory`, `preflightAuthority` | `:67`-`:68` | `:68`-`:69` |
| `createActionPolicy` | `:2362` | `:2507`, the call; the import is at `:63` |
| *"cleared at the session boundary"* | `:2359` | `:2504` |
| *"the mode check comes first ... a mode that failed to load must stop the action"* | `:2837`-`:2839` | `:2875`-`:2881` |
| `resolveActionIdentity(...)` then `denyDecision(...)` | `:2843`-`:2844` | `:2885`-`:2886` |
| the refusal that carries a deterministic remedy | `:2863` | `:2905` |
| *"the half that reads arguments runs after the input is final"* | `:2867` | `:2884` |

**Every one was repointed by content and then read** - the table is the reading, and each target line was checked for the
identifier or behaviour its sentence names before the number was written.

**What it says about the floor.** The door did its job twice, catching the mount rows my earlier edits moved, and it says
**nothing** about any of these nine, because all nine satisfied its floor the whole time: the path resolved and the line
existed. That gap is now nine measurements rather than a warning in the front door.

## Acceptance Criteria

- [x] **AC-1** The count is stated **with the search**: the mount page's **18 rows** carrying **39 distinct bare
      positions**, plus the **11 named `extension.ts:` citations** across the pages that cite the file. Classification:
      **9 repointed**, the rest confirmed, and **0 sentence-wrong** - no sentence was found to be the thing that is
      wrong, so **AC-3** has nothing to record beyond that statement.
- [x] **AC-2** Every repoint names the declaration or behaviour it landed on, and the line was read first: see the table
      above, where each row carries the claim, the old number and the line the claim actually lives on.
- [x] **AC-3** No sentence was found wrong. Recorded as a finding of its own, because "none" over a population is a
      claim that needs the population stated - which AC-1 does.
- [x] **AC-4** Gates: `npm run typecheck` exit 0, `npm test` **1001 pass / 0 fail**, `npm run test:installer` OK, the
      task-artifact corpus at 0 problems, and both citation doors green at 17 pass / 0 fail both before and after the
      repoints.

## Out of Scope

- **Adding a door** that checks prose citations: that changes the check surface, and this task measures what the current
  one misses.
- Repointing anything outside the pages that cite `src/pi-adapter/extension.ts`.
