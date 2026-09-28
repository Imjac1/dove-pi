# Implementation plan: the authorisation table

## Ordered checklist

- [x] **1. Each row in its own words.**
- [x] **2. The holder, found by reading.**
- [x] **3. The column.**
- [x] **4. The pointer check, then the gate.**

## The five rows, and one of them was unheld

```text
Direct Core       tests/capability-protocol.test.ts    a payload granted with no callback is denied
Pi                tests/pi-adapter.test.ts            sets DOVE_PI_READ_ONLY and restores it
Local CLI         NOTHING                             implemented at cli.ts:360 and :371, held by nothing
JSON-RPC stdio    tests/local-rpc.test.ts             the approval refusals
MCP stdio         tests/mcp-adapter.test.ts           asserts dove_invoke exposes no approve argument
```

## The first genuinely unheld promise this audit has found

**The CLI row was implemented and nothing held it.** Searching the tests for the flag, for `createLocalAdapter`, and for `capability run`
found nothing: **the only `"approve"` literal in the suite is the MCP assertion that it is absent there**, and `createLocalAdapter` appears in
zero tests. A safety row - *omitting the flag denies side effects* - with nothing to make it go red.

**A holder was added**, and it drives the real CLI in a temporary project: without the flag the output says `approval_denied`, with it the
gate opens and the capability is what fails, because a temporary project has no test script. **That failure is the evidence**, the same way
it was when this boundary was first measured by hand.

**And the control was run**: with the assertion planted backwards the test fails with `CONTROL: this must fail`, so it holds the behaviour
rather than passing for its own reasons.

## Validation commands

```powershell
node --import tsx --test tests/document-drift.test.ts
npm test
```

## Recorded, not built

1. **Judging a holder.**
2. **The first real turn.**