# Implementation plan: reading the usage review

## Ordered checklist

- [x] **1. Read the plan and its research file.**
- [x] **2. Measure its sharpest claim.**
- [x] **3. Separate the half that is right from the half that is wrong.**
- [ ] **4. The plan own P0-P3 items.**

## Validation commands

```powershell
npm run typecheck
npm test
```

## What remains, from the plan own priorities

```text
P0  a session-size fuse: when the prompt prefix nears the context window, compact or suggest /compact.
    This is the largest saving named and it is a real product change, not a test or a document.
P1  give the model an incentive to invoke a capability - the recording exists, the invocation does not
    happen
P2  align the editors across hosts, and route dispatch through the Trellis lifecycle
P3  surface formatCacheDiagnostics in the UI, and consume the reuse rate the ledger already records
```

**The task stays open.** Its P0 is a behaviour change in the runtime, and this round was a reading.
