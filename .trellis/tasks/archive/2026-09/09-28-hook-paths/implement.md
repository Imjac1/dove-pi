# Implementation plan: the hook paths

## Ordered checklist

- [x] **1. The configs**, and the paths in them.
- [x] **2. Resolution**, against the tree.
- [x] **3. The comparison.**
- [x] **4. Fix or record, then the gate.**

## The measurement

```text
.codex/hooks.json names:   .codex/hooks/inject-workflow-state.py     OK
                           .codex/hooks/inject-subagent-context.py  OK
.codex/config.toml names:  no script paths
.claude:                   does not exist in this install (52 of its files are in the tool hash list)
```

**The hooks are clean.** The finding is one layer out: the correction in this file named a .claude path as a second location for the
workflow-state script, which was true when it was written and is not any more.

## What was fixed, and the rule the fix started by breaking

The correction now names the `.codex` path, and says in prose that the .claude half was true once and is not now. **The first attempt put the
removed path in code marks**, which is exactly what the note own rule forbids: the documentation checks read code spans, and a note
describing a wrong path would otherwise read as one. Removing the marks is what makes the correction honest about a path that is not there.

**No check was added**: the front-door check cannot hold an unmarked path by design, and one that read unmarked text would flag this very
note.

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **Whether the hooks fire**, which needs a host.
2. **The first real turn**, which needs a Pi host.