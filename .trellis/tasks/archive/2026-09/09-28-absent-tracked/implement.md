# Implementation plan: the absent tracked files

## Ordered checklist

- [x] **1. The absent list**, grouped.
- [x] **2. The classification.**
- [x] **3. The references**, across configs and documents.
- [x] **4. Fix or record, then the gate.**

## The measurement: three groups, all accounted for

```text
absent tracked files:  74
  .claude/**           52   a platform that is not installed here
  __pycache__/*.pyc    20   bytecode for Python 3.12, while the hash list records 3.11
  .runtime/sessions     2   gitignored runtime state
```

**Nothing this repository acts on points at one.** The 86 full-path references are almost all in the tool own documentation under
`.agents/skills/trellis-meta/**`, which describes the `.claude` platform as part of describing the tool, plus the hash file referencing its own
entries. A document that describes a platform is not a config that runs one.

## The detail worth recording

**The tool tracks `.pyc` bytecode**, and at a Python version the current interpreter does not produce: twenty modules appear as *absent* at
`cpython-312` while the same twenty appear as *different* at `cpython-311` in the same comparison. **That is a permanent noise floor in the
tool own check** - two of its three categories are occupied by the same bytecode, and neither says anything about this repository.

## And my own search was too loose once more

The first pass matched by **basename**, which reported seven references that were basename collisions: `inject-workflow-state.py` exists
under `.codex/hooks` and is missing under `.claude/hooks`, and the same for `SKILL.md` and `workflow.md`. Matching the **full path** is what
turned seven findings into none.

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **Restoring a platform**, which is not the question.
2. **The first real turn**, which needs a Pi host.