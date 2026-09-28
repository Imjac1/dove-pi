# Implementation plan: a holder for the fuse wiring

## Ordered checklist

- [x] **1. Read how the diagnostics are derived.**
- [x] **2. Establish that a cold start is stageable through the real path.**
- [x] **3. Establish that the notices are one-shot per extension() call.**
- [ ] **4. Write the case of its own, using the edit tool with an anchor.**
- [x] **5. Restore the tree and record the cause.**

## Validation commands

```powershell
npm run typecheck
npm test
```

## Next round, precisely

```text
the file      tests/pi-adapter.test.ts, restored to 1342 lines at HEAD
the tool      tools.edit with the anchor `it("registers modes, shortcuts, capabilities, and doctor"` -
              and read the file first, so the edit tool has a current revision
the case      its own extension(api), because the flags are closure state
the stages    warm and long  -> near_limit, names /compact
              two messages six minutes apart with the second reading no cache -> cold_start, names idle
              one more identical turn -> nothing, which is the control for the flag
the entries   { type: "message", message: { role: "assistant", provider, model, timestamp,
              usage: { input, cacheRead, cacheWrite } } }, timestamps in milliseconds
```
