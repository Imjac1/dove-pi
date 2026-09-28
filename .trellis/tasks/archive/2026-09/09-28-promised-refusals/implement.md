# Implementation plan: the promised refusals

## Ordered checklist

- [x] **1. The promised behaviours**, from the table.
- [x] **2. What holds each**, found by behaviour.
- [x] **3. The unheld ones, classified.**
- [x] **4. Holders, where they can be added, then the gate.**

## The refusal table, ten promises, what holds each

```text
118 unsupported protocol / invalid semver   capability-protocol.test.ts:62,71   assert.rejects with a reason string
119 arguments fail the parameter schema     capability-protocol.test.ts:109  "before execution" is in the test name
120 approval claimed without a callback     local-rpc.test.ts:51,61,71        three assertions of approval_denied
121 input line exceeds 128 KiB              local-rpc.test.ts:89-91          an oversized line AND a valid line after it
122 duplicate project authorities           NOT FOUND                        the implementation is not under the obvious names either
123 evidence names credential material      NOT FOUND                        nothing but a comment about redacting at loop.ts:216
124 platform unsupported                    capability-protocol.test.ts:153  asserted by status name
125 granted by the mode, not implemented    host-work-mode.test.ts:418-420   including "nothing unimplemented is put to the operator"
126 not granted by the mode                 action-policy.test.ts            scope and grant fixtures
127 diagnostics filter bad                  local-rpc.test.ts                added by the previous round
```

## Eight held, and two not found

**Eight of the ten promises have a holder, and reading them showed the holders are the right ones**: the oversized-line test drives an
oversized line *and* a valid one after it, so it holds both halves of "then continue"; the unimplemented-action test asserts not only the
refusal but that nothing is put to the operator; the schema test carries "before execution" in its own name.

## The two that are leads rather than findings

**For 122 and 123 neither the implementation nor a test turned up under the obvious names** - and this round was already wrong twice by
pattern: a keyword sweep reported zero holders for the promise the previous round had just given one, and a guessed test filename did not
exist. **So these are recorded as leads, not as unheld promises.** Saying "the suite does not hold it" on the strength of two failed searches
would be the third wrong conclusion, and the expensive one.

**The next step is named**: find how a duplicate authority conflict and a credential-bearing evidence reference are implemented, and only
then ask what holds them.

## Validation commands

```powershell
node --import tsx --test tests/local-rpc.test.ts
npm test
```

## Recorded, not built

1. **A case this environment cannot stage.**
2. **The first real turn.**