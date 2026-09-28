# Implementation plan: the documented state paths

## Ordered checklist

- [x] **1. The documented paths**, from the help and both READMEs.
- [x] **2. The coded paths**, from the layout constants and the file operations.
- [x] **3. The comparison, both directions.**
- [x] **4. Fix or record, then the gate.**

## The measurement

```text
the help said:            .dove/manifest.json holds the stored profile
what .dove holds:         state.json, tasks/<id>, sessions.jsonl, project-mutation.lock,
                          project.json, effects, workspace.json   - no manifest.json
what that sentence read:  profiles.defaults.font, in the Windows Terminal settings, for a font
where the profile is:     the managed install state, with max as the fallback
```

**Two things were wrong with one sentence**: the path exists nowhere, and the code it pointed at is about a terminal font. **The real
store is the install state**, which `state.py` declares as `profile: str = "max"` and reads back with the same fallback.

## Two strings, not one

The argparse help carried the false path and the printed help carried a vague phrase - *"stored profile"* - and they are different text.
Both name the same source now.

**And the check had to be relaxed before it was right**: its first version demanded my own wording from the printed help, which was vague
and not false. The invariant is that both name the same source and that the path exists nowhere. The control is what proved the check
live: putting the path back makes it fail with it quoted.

## Validation commands

```powershell
python dove_pi.py --help
npm run typecheck
npm test
```

## Recorded, not built

1. **Paths Pi owns**, under `~/.pi`.
2. **The first real turn**, which needs a Pi host.