# Every spec index lists its directory

## Goal

Generalise the index check from one directory to all of them, because the wide measurement says the drift happens where a
specification is added and nobody updates the table - and the check added last round names `backend/` only.

## Background: the wide measurement

Every markdown file under the repository and the root (139 of them, five levels deep) was read, and every relative link in them
resolved against the filesystem:

```text
markdown files scanned: 139, links resolved: 61, broken: 0
```

**No broken link anywhere.** And the two specification indexes that still carry generator boilerplate were read in full:

| Index | Files in the directory | Listed | Verdict |
|---|---|---|---|
| `backend/index.md` | 11 personal-agent specifications plus six guidelines | 8 of the specifications | **stale** - three missing, fixed a round ago |
| `frontend/index.md` | 6 | 6 | complete |
| `guides/index.md` | 3 guides plus itself | 3 | complete |

**So the drift is not random**: it happens when a specification is added to a directory and its table is not updated - which is
exactly what happened three times in `backend/`, including the harness loop itself. And the check written last round names
`backend/`, so the same drift in `frontend/` or `guides/` would be invisible.

**One more thing measured, because it was worth knowing**: the content specifications are not template text. `frontend/state-management.md`
describes this project own split of state by authority. The boilerplate is confined to the two `index.md` files, and it is
Trellis-generated prose that a tool update may rewrite - so the round records it rather than editing it.

## Requirements

- **R1 - The check covers every specification directory**: for each directory under `.trellis/spec/` that has an `index.md`, every
  markdown file in that directory is mentioned, and every markdown name the index gives exists in it.
- **R2 - The check fails on a real omission**, which is tested by its own case: the round seeds a specification into a temporary
  directory shape and watches the comparison fail, or asserts it against the rule directly.
- **R3 - A directory with no index is reported, not skipped silently** - because "no index" is how the backend index came to be
  missing a specification nobody knew about.
- **R4 - The limit stays stated**: a row pointing at the wrong specification resolves, and no check can see that.
- **R5 - The boilerplate is recorded, not edited**: it belongs to the generator, and fighting a generator is a different change.

## Acceptance Criteria

- [ ] **AC1** The index check loops over the spec directories rather than naming one.
- [ ] **AC2** It fails when a specification is absent from its index, proven rather than asserted.
- [ ] **AC3** It reports a directory without an index instead of passing over it.
- [ ] **AC4** The wide measurement is recorded in the task and the method lesson repeated in the guide.
- [ ] **AC5** The gate passes: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Out of scope

- **The generator boilerplate**, which a tool update may overwrite.
- **A link check for every markdown file in the suite**: measured at 61 links and none broken, so the round has no evidence it
  would earn its cost. The number is recorded instead.
- **The first real turn**, which needs a Pi host.
