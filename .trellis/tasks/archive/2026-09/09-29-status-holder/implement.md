# Implementation plan: a holder for the status command

## Ordered checklist

- [x] **1. Read the harness that captures commands and notifications.**
- [x] **2. Confirm the command was never invoked.**
- [x] **3. Assert both halves inside an existing case.**
- [x] **4. The gate.**

## Validation commands

```powershell
npx tsx --test tests/pi-adapter.test.ts
npm test
```

## The gap, and what closed it

```text
named twice   the /status command has no direct test; holding it needs the fake extension host
measured      a search for commands.get("status") across the suite returned nothing at all
closed by     four assertions plus a control, inside the case that already builds the harness
```

## Recorded, not built

**The fuse wiring line still has no holder of its own.** It sits in the request path rather than behind a
command, and the notice it raises needs a context whose `getContextUsage` reports a grown prefix. **That is a
different harness from this one**, and it is named rather than assumed closed by the work above.
