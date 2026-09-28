# Implementation plan: the approval boundary

## Ordered checklist

- [x] **1. The temporary project.**
- [x] **2. capabilities/list.**
- [x] **3. A read-only invoke.**
- [x] **4. A writing invoke without approval, then the gate.**

## The runs

```text
capabilities/list                              -> result rpcVersion 1.0.0 with the registry
invoke dev.node_version, approval unavailable  -> status "success"
invoke dev.project_test, approval unavailable  -> status "approval_denied"
invoke dev.npm_build,    approval denied       -> status "approval_denied"
```

## The boundary, observed

**A read-only capability runs without approval and a writing one is refused**, and the refusal is a **typed status inside the result
envelope** rather than a JSON-RPC error - which is the right shape: the request was valid and the capability was not permitted. It names the
capability it refused, so a caller knows which of its calls was turned down.

**Both approval values behave the same way**: `unavailable` and `denied` each produce `approval_denied`, which says the field is checked and
that neither is a way past the check.

**This is the boundary the round intended to measure without crossing it**: driving a writing capability to the point of the decision changes
nothing, and the previous round declined to run one precisely because running it *through* would.

## And one plumbing note

The first attempt built the requests in PowerShell and every one came back `-32700 Bad escaped character in JSON` - **my own escaping mangled
the Windows path, not the server refusing a request**. Rebuilding them in Node, which cannot lose its escaping, produced the four answers above.

The fixture was removed and this repository is untouched.

## Validation commands

```powershell
<request> | python dove_pi.py rpc
npm run typecheck
npm test
```

## Recorded, not built

1. **An approved write**, which would change this machine.
2. **The first real turn.**