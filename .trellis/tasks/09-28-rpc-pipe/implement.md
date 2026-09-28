# Implementation plan: the headless interface

## Ordered checklist

- [ ] **1. The temporary project.**
- [ ] **2. The documented request**, through a pipe.
- [ ] **3. Two refusals.**
- [ ] **4. Clean up, then the gate.**

## Validation commands

```powershell
echo '{"jsonrpc":"2.0","id":1,"method":"diagnostics/status"}' | python dove_pi.py rpc
npm run typecheck
npm test
```

## Recorded, not built

1. **mcp**, which can have its own round.
2. **The first real turn.**
