# Implementation plan: the other headless interface

## Ordered checklist

- [x] **1. How to drive it**, read first.
- [x] **2. The call**, recorded verbatim.
- [x] **3. Two failures.**
- [x] **4. The comparison, then the gate.**

## The runs

```text
initialize  -> {"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{"listChanged":true}},
                       "serverInfo":{"name":"dove-pi","version":"1.0.0"}},"jsonrpc":"2.0","id":1}
tools/list  -> {"result":{"tools":[{"name":"dove_capabilities", ...}]}}
unknown method -> {"jsonrpc":"2.0","id":3,"error":{"code":-32601,"message":"Method not found"}}
bad version    -> exit 0, no error line
malformed line -> exit 0, no error line
```

## The comparison, which is the point of the round

**mcp answers `-32601` where rpc answered `-32700`.** The two interfaces take the same question - an unserved method - and give the
specification's code and the parse-error code respectively, and the reason is visible in the code: **`mcp.ts` connects the official
`StdioServerTransport`**, so the protocol's error handling is the SDK's, while the rpc server is hand-written and had to be taught the code in
the previous round.

**And they differ on malformed input too**: rpc *answers* with a `-32700` envelope, mcp says nothing at all, because the SDK transport
drops a line it cannot parse. Two behaviours for the same input, neither wrong for what it is - one is an answer to a request, the other is a
transport refusing to pass rubbish upward.

**Nothing was fixed.** The contrast is the result, and it says the defect the last round repaired was a defect of writing the protocol by
hand rather than of the protocol.

The fixture was removed and this repository is untouched.

## Validation commands

```powershell
echo <handshake> | python dove_pi.py mcp
npm run typecheck
npm test
```

## Recorded, not built

1. **A full client**, unless the documented form needs one.
2. **The first real turn.**