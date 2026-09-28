# Implementation plan: the registration that must not change the contracts

## Ordered checklist

- [x] **1. The registering code, read first.**
- [x] **2. The checkability answer.**
- [x] **3. Hold, qualify, or record.**
- [x] **4. The gate.**

## What the adapter registers, and into what

```text
pi.registerCommand(...)   eleven: mode, dove-mode, dove-workspace, status, subagent, sysprompt,
                          reasoning-voice, dove-thinking, dove-tools, 设置, settings-zh
pi.registerShortcut(...)

the receiver is `pi` - the host object - and three suites fake it. pi-adapter.test.ts:93 stores what
it is given rather than discarding it, so the adapter own suite records the registration.
```

## The checkability answer, which is the round product

**The item is two claims.** *Registers tools/commands/shortcuts* is a behaviour, and it is exercised. **"Without changing core contracts" is
not a behaviour at all**: the contracts live in `src/core`, the adapter is on the other side of that boundary, and the structural half is what
the layer check already holds - `src/core` imports nothing from the Pi side. **A case restating it would prove nothing of its own**, which is
the failure mode this round was watching for.

## And a constraint discovered the hard way

**The qualification was written into the specification, and the document suite refused it**: *personal-agent-request-runtime.md exceeds
24 KiB*. **Every specification file has a 24 KiB budget**, enforced by `spec-context-budget.test.ts`, and the round 142 gate was green - so
the addition is what pushed it over.

**The edit was reverted.** The substance was worth having and the file had no room for it, which is a real constraint on the whole
correction method: **a note that does not fit the budget is a note the suite will refuse.** The item stands as written, accounted for by the
layer check rather than by an edit.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The other lists.**
2. **The first real turn.**