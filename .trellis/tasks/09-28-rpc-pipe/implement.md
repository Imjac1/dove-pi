# Implementation plan: the headless interface

## Ordered checklist

- [x] **1. The temporary project.**
- [x] **2. The documented request**, through a pipe.
- [x] **3. Two refusals.**
- [x] **4. Clean up, then the gate.**

## The runs

```text
{"jsonrpc":"2.0","id":1,"method":"diagnostics/status"}   exit 0
  -> {"jsonrpc":"2.0","id":1,"result":{"rpcVersion":"1.0.0","schemaVersion":1}}

malformed JSON      -> {"id":null,"error":{"code":-32700,"message":"Expected double-quoted property name ..."}}
unknown method      -> {"id":null,"error":{"code":-32700,"message":"Unsupported JSON-RPC method."}}      <- should be -32601
not a request       -> {"id":null,"error":{"code":-32700,"message":"JSON-RPC version must be 2.0."}}     <- should be -32600
```

**The documented request works and the process exits on its own**, so no timeout was needed. **And every failure left with the same code**:
`-32700`, which the specification reserves for a JSON *parse* failure, so four different problems - a shape that is not a request, a version
that is not 2.0, a method that is not served, an id of the wrong type - arrived indistinguishable to a client keying on the code.

## The fix, and the part of it I got wrong

**`JsonRpcError` carries the code**: an unserved method answers `-32601` and a malformed request `-32600`, both observed through
`handleRpc` before and after the change, and now held by a test. The messages are unchanged, which the existing assertions still require.

**And I also gave the params validator codes, which was wrong and is reverted.** Measuring showed that path is not reachable from
`handleRpc`: params values it would reject are accepted. **Asserting a refusal there would have been asserting what I expected rather than
what ran**, so those three throws are plain errors again and the test records the acceptance instead.

## Validation commands

```powershell
echo '{"jsonrpc":"2.0","id":1,"method":"diagnostics/status"}' | python dove_pi.py rpc
npm run typecheck
npm test
```

## Recorded, not built

1. **mcp**, which can have its own round.
2. **The first real turn.**