# Three comments pin a host detail that has moved or drifts

## Goal

Three comments in `src/` state a host fact that is no longer true or will not stay true: one cites a path that cannot
exist, and two pin a host version number in prose. None of them changes behaviour; all of them are read as statements
about the host by whoever arrives next.

## Background (measured 2026-10-17, Pi `1.0.0`)

| Site | What it says | The measurement |
|---|---|---|
| `src/core/work-mode.ts:303` | cites the host's own schemas as `pi-agent-core`, `dist/harness/tools/*.d.ts` | the installed `pi-agent-core` `1.0.0` mentions `harness` in **0 files** - the directory is gone, so the citation names a path that cannot exist |
| `src/extensions/install.ts:95` | *"Pi 0.84.3 has no public persistent multi-source install API"* | the version is two majors behind the installed host; the **assertion** beside it was not measured by this round and is left unverified rather than endorsed |
| `src/core/request-lifecycle.ts:162` | a host version in prose | the same drift; the **assertion** it guards (that the host exposes no submission id) was re-measured in 1.0 and **holds** |

**Why these three, and what the sweep then found.** They are the sites this round's host-surface inventory reached that
pin a host detail in text; `src/extensions/catalog.ts:233` and `:276` also mention `0.84.3` in prose, and are **not** in
scope here because their `minPi` assertions are extension requirements that 1.0 satisfies - recorded as *feasible,
wording to watch* rather than as a defect.

**AC-1's sweep found two more sites than this table listed, which is the AC doing its job rather than the table being
right**: `src/pi-adapter/extension.ts:431` (`Pi 0.84.x makes built-in tool input mutable but does not expose a cursor
parameter for ls`) and `:1443` (`Pi 0.84+ owns the built-in /thinking command`). Both are comment-shaped, both pin a
version, and both were fixed under this task. **Their assertions were re-measured and hold in 1.0**: the host's `ls`
schema is `path` and `limit` with no cursor, and the host still declares `{ name: "thinking", ... }` in its own
slash-command table. So the two extra sites are the same defect as the three listed - a version number that drifts -
and not a behavioural break.

**User value.** A comment that names a version teaches the next reader that the sentence beside it is current. This is
the repository's own recurring defect - a declaration that stopped being true - and the cheapest place to stop it is
where the sentence is.

## What the edit cost, and what the sweep found (2026-10-17)

**The mirror tax came due exactly as the front door says it does.** Two comment blocks in `src/pi-adapter/extension.ts`
grew by one line each, and the citation door went red on the first run after the edit: *18 of 18 mount points cite a line
that is not their declaration*. That is the tax this repository documents - an edit above every `pi.on(...)` registration
moves the whole mount table - and it was caught in seconds by the one check that walks cited lines.

**Repaired by content, with the shift proved rather than assumed.** Every pre-edit line was compared with the line the
shift would land on, and **every pair is identical**, so the mapping restores exactly the line each citation pointed at
before the edit rather than inventing a new one. Applied: the 18 mount rows, the page's bare `:N` citations by depth, and
the named citations that provably held their claim before - `mode-format.md` `:2567` and `:1333`,
`use-time-architecture.md` `:958`.

**Three named citations were already stale before this edit, and the pre-edit file is the evidence.** In
`HEAD:src/pi-adapter/extension.ts` the cited lines hold the same text they hold now: `field-run.md`'s `:1113` was a
comment rather than the strategy-snapshot assembler, `mode-format.md`'s `:3490` was a terminal flag rather than the call
building the mode block, and `:2331` was a request-metadata lookup rather than `loadWorkModeFromDirectory`. Each was
repointed to the declaration its sentence names - `:1116`, `:3635`, `:2460` - and each verified by reading the new line.
**So those three are not this edit's tax**: the page's prose citations were drifting already, which is what the front
door means when it says only the mount table is checked by a rule of its own and every other citation is held only to the
floor. Recorded rather than generalised - a full audit of the page's inner citations is a task of its own.

## Requirements

- **R1** No comment in `src/` names a host **version number** as a fact about the installed host. Where a version matters,
  name the declaration or the capability instead.
- **R2** `work-mode.ts:303` names a declaration that exists in the installed host, or states what it observed without
  citing a path.
- **R3** The **assertions** each comment guards are re-measured as part of this work, or explicitly left marked as
  unverified. Removing a version number must not smuggle in a claim about behaviour: `install.ts:95`'s assertion is
  currently unmeasured.
- **R4** **Zero behaviour change**: comments only.

## Acceptance Criteria

- [x] **AC-1** No comment under `src/` asserts a host version number as the host's standing state. **Measured, with the
      search:** the pattern `0\.8[0-9]\.\d` over `src/` returns **15** hits after the edits - **13** `minPi` data fields
      and **2** user-facing `notes` strings in `catalog.ts`, which is a string literal rather than a comment and is out
      of scope - and **no** comment asserts a host version. **Amended while implementing, and the sweep is what forced
      it:** the clause first read *no comment names a host version number*, which a blunt regex cannot distinguish from
      this repository's own measurement idiom - a comment saying "re-measured 2026-10-17 against the installed Pi 1.0"
      names a version as the subject of a dated reading, not as a fact that is supposed to stay true. The clause now
      separates the two, because the alternative was deleting the measurement that makes the sentence checkable.
- [x] **AC-2** `work-mode.ts` no longer cites `dist/harness/`. Measured: `pi-agent-core` 1.0 holds no tool declaration
      file at all, and the sentence now names `pi-coding-agent`'s `dist/core/tools/` and the re-exported input types.
- [x] **AC-3** Each assertion is measured and stated: the `ls` schema is `path` + `limit` with no cursor; the host still
      declares its own `thinking` slash command; no file in the host package carries a submission id; and the install-API
      assertion is **corrected rather than re-endorsed**, because 1.0 does expose `installAndPersist` and its siblings.
- [x] **AC-4** Gates: `npm run typecheck` clean, `npm test` 0 fail, `npm run test:installer` OK. Re-run after the comment
      edits **and** after the citation repair: typecheck exit 0, the suite 999 pass / 0 fail, the installer OK, the
      task-artifact corpus at 0 problems, and the citation door that this edit turned red - *18 of 18 mount points cite a
      line that is not their declaration* - green again at 4 pass / 0 fail.

## Out of Scope

- `src/extensions/catalog.ts`'s prose and `minPi` values: judged feasible for 1.0, wording only.
- The extension catalog's contents.
- Any change to the installer's behaviour.
