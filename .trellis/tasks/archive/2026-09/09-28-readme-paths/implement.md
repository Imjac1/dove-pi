# Implementation plan: the README .dove paths

## Ordered checklist

- [x] **1. The README paths**, with their lines.
- [x] **2. The layout**, confirmed from the code.
- [x] **3. The comparison, both directions.**
- [x] **4. Fix or record, then the gate.**

## The measurement

```text
README.md names:      .dove/state.json, .dove/tasks/<task-id>, and the directory
README.en.md names:   the same two
the code builds:      .dove/state.json (native-state.ts:63), .dove/tasks/<id> (native-artifacts.ts:34)
```

**Both named paths are built by the code, and the rest of the layout is internal** - `sessions.jsonl`, `project-mutation.lock`,
`project.json`, `effects`, `workspace.json` - which a front door is right not to enumerate.

## What the round actually added

**The existing drift case holds that a named path exists, and these two do not exist in a fresh checkout**, so it could not hold them.
The new case asserts the other property: a path a front door names must be one some code constructs. That is exactly what the previous
round found the help violating, with `.dove/manifest.json`.

**And the header own count was stale by one**: it said nine cases where the file held ten. The same class as everything else measured
here, found by counting while adding one.

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **Paths Pi owns**, under `~/.pi`.
2. **The first real turn**, which needs a Pi host.