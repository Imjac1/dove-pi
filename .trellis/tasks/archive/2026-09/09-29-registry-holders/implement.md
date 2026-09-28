# Implementation plan: holders for the registry four behaviours

## Ordered checklist

- [x] **1. The four behaviours.**
- [x] **2. What holds each.**
- [x] **3. Holders for the unheld, with controls.**
- [x] **4. The gate.**

## Three of the four behaviours were unheld, not one

```text
require refuses an unknown name    unheld - zero assertions; the seventeen uses of require are calls
register refuses a duplicate       unheld - "already registered" matched 39 places and none was this
get answers undefined              unheld as its own behaviour, though require walks the same path
list enumerates                    unheld
```

**The round expected to hold one refusal and found four behaviours with no holder between them.** The registry is twenty-six lines; the
suite constructs registries in five places and asserts none of their behaviour.

## The control is in place, and a planted one was run

**The first case asserts the refusal and then - in the same case - that a held name resolves**, so the refusal assertion is about the refusal
and not about a method that always throws. A planted control flipping the *name in the expected message* fails the case. The duplicate case
asserts the message **and** that the first registration survives.

## Three type errors to get the fixture shape right, which is worth recording

```text
first   imported CapabilityDefinition - TS2459, it is declared locally and not exported
second  copied the field shape from the suite that owns the protocol fixtures - TS2345, still not assignable
third   the cause: a helper function *widens* literal fields, so `status` became `string` rather than its union.
        The existing suite inlines its literal at the call for exactly this reason, and the fix was to inline rather than to guess again
```

**That is the round teaching its own lesson about the session method**: the shape was not derivable from the registry, it was in the suite
that already registers capabilities, and three guesses cost three typecheck runs where one reading of the *owning* file cost none.

## Validation commands

```powershell
node --import tsx --test tests/capability-protocol.test.ts
npm test
```

## Recorded, not built

1. **The other request-runtime items.**
2. **The first real turn.**