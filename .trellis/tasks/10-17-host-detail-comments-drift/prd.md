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

**Why these three and not a sweep.** They are the sites this round's host-surface inventory reached that pin a host
detail in text; `src/extensions/catalog.ts:233` and `:276` also mention `0.84.3` in prose, and are **not** in scope here
because their `minPi` assertions are extension requirements that 1.0 satisfies - recorded as *feasible, wording to
watch* rather than as a defect.

**User value.** A comment that names a version teaches the next reader that the sentence beside it is current. This is
the repository's own recurring defect - a declaration that stopped being true - and the cheapest place to stop it is
where the sentence is.

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

- [ ] **AC-1** No host version number remains in a comment under `src/`; the count that proves it is stated with the
      search that produced it, because the 2026-10-17 count over `src` was **51** hits for the pattern `0\.8[0-9]\.\d`
      and most of them are fixtures rather than comments.
- [ ] **AC-2** `work-mode.ts:303` no longer cites `dist/harness/`, which the installed `pi-agent-core` does not have.
- [ ] **AC-3** Each of the two assertions is either measured in this task and stated, or carries an explicit
      unverified mark - `install.ts:95` is the one that needs it.
- [ ] **AC-4** Gates: `npm run typecheck` clean, `npm test` 0 fail, `npm run test:installer` OK.

## Out of Scope

- `src/extensions/catalog.ts`'s prose and `minPi` values: judged feasible for 1.0, wording only.
- The extension catalog's contents.
- Any change to the installer's behaviour.
