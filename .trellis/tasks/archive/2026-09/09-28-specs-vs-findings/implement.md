# Implementation plan: the findings against the specifications

## Ordered checklist

- [x] **1. The four findings**, each with what it refines.
- [x] **2. The claims each touches**, read from the specification.
- [x] **3. Corrections, where a claim is stale.**
- [x] **4. The gate.**

## The four findings against the specifications

```text
finding                                     held against                        result
the read-only switch is an adapter control  the capability runtime table         already named: "after the explicit Dove read-only switch is checked"
the two doctors differ in what they report  extension-runtime.md:61               not stale: that line names requestDiagnostics and subagent, not runtime
two approval gates, one status              capability-runtime.md:57-63           already documented, four rows, "granted is insufficient by itself"
the rpc error codes collapsed               capability-runtime.md:121             STALE - because of my own change two rounds ago
```

## What was actually stale, and it was mine

**Line 121 promised "one bounded parse error" for an oversized input line**, and the round that fixed the collapsed error codes changed that
one to `-32600`. The behaviour is unchanged and the new code is the right one for an oversized *request*; the sentence was what stopped being
true. It now says which code and why.

## And a finding of mine that was wrong

**Nothing held the neighbouring promise either.** Line 127 says a diagnostics filter that is not an object or holds non-string ids must return
a JSON-RPC error - and searching the tests for it found nothing. Probing it with a check that prints the whole response rather than treating
a resolved promise as success:

```text
[]                  error -32000  diagnostics/status params must be an object.
{"sessionId":7}     error -32000  diagnostics/status sessionId must be a string.
{"requestId":9}     error -32000  diagnostics/status requestId must be a string.
{"sessionId":"ok"}  result (no error)
```

**The refusal exists and my earlier claim that it did not was wrong.** That claim is in this session own record, so the archived task it
came from now carries an appended correction - an addition, not a rewrite - and a test holds the refusal, which is what would have caught the
error in the first place.

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **New documents**, which no finding asks for.
2. **The first real turn.**