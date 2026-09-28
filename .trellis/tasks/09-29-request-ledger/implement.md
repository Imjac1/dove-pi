# Implementation plan: the request ledger

## Ordered checklist

- [x] **1. The file list.**
- [x] **2. The four items.**
- [x] **3. The record-kind vocabulary.**
- [x] **4. The gate.**

## The four request-runtime items, held verbatim

```text
one plan and one terminal record       request-lifecycle.test.ts:19, :188   five automatic attempts, one logical request
active redelivery before persistence   request-lifecycle.test.ts:37    "coalesces in-flight redelivery but not the same text after settlement"
steer and follow-up keep the id        request-lifecycle.test.ts:52    "associates steering and follow-up deliveries with the active logical request"
shared chain, distinct execution ids   request-lifecycle.test.ts:215 and request-lifecycle-pi.test.ts:61, which parses by correlation
```

## The record kinds are not where a client lives, and the round asked before concluding

**Thirty-four record kinds, and none is a client or an account.** That was the question asked because the item is about a ledger - and the
answer was no, so the search moved to the code rather than repeating the word.

## And the client account was in `failure-reading.ts` all along

```text
failure-reading.ts:44    "What a client of this run called the failure, and how it decided."
failure-reading.ts:77    readonly client?: ClientAccount;
failure-reading.ts:174   "the client accounts keyed by request id, so an account can only land on ..."
failure-reading.ts:286   options.clientAccounts?.has(terminal.requestId) ? { client: ... }
```

**The item own phrasing - *keyed by request id* - is in that file comment**, which is why no word-search for *client* found it in the tests: the
names live in the code, and the tests only call them.

**And the two holders are verbatim**: *"carries a client account when the caller supplies one, and never merges it into the mechanism"*, and *"leaves
the other failures alone when a ledger holds more than one"* - the second half of the item, word for word.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The rest of the first list.**
2. **The first real turn.**