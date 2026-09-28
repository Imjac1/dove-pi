# Implementation plan: the schema versions

## Ordered checklist

- [x] **1. The writers**: every schemaVersion stamp.
- [x] **2. The readers**: every acceptance check and its refusal.
- [x] **3. The comparison.**
- [x] **4. Fix or record, then the gate.**

## The measurement

```text
workspace policy         written and read as 1, in dove_pi.py and bin/dove-pi.cjs
native project state     NATIVE_PROJECT_STATE_VERSION, one constant
native sessions          NATIVE_SESSION_SCHEMA_VERSION, one constant
release manifest         stamped 1, read as any integer - no acceptance side
managed install state    STATE_SCHEMA_VERSION = 2 in Python, a literal 2 in TypeScript
context snapshot         a literal 2 stamped in the adapter, a literal 2 refused in the decoder
cache policy version     stamped 2, only ever reported - no acceptance side, so no pair
```

**Two pairs had nothing keeping them in step**, and they are different problems:

| Pair | Fix |
|---|---|
| the context snapshot, both sides in `src/pi-adapter` | a shared constant: `CONTEXT_SNAPSHOT_SCHEMA_VERSION` |
| the managed install state, Python writes and TypeScript reads | a declared pair in a test, because no constant crosses the boundary |

**The first is structural and the second cannot be.** That is the whole difference, and it is why one fix is a constant and the other is a
check.

## The control

The declared pair was given one: drifting the TypeScript literal makes the check fail, and restoring it makes it pass.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
```

## Recorded, not built

1. **Migration**, which is a design decision.
2. **The first real turn**, which needs a Pi host.