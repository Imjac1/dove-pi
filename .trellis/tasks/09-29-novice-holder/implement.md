# Implementation plan: the holder, shape read first

## Ordered checklist

- [x] **1. Read the protocol suite head.**
- [x] **2. Write the case against it.**
- [x] **3. The control.**
- [x] **4. The gate.**

## What was read, and what it cost

```text
read first   capability-protocol.test.ts:12  request(name, overrides) - protocolVersion, capability, arguments,
                                             context, correlation and approval, in that shape
             :24-55                          the registry helper, whose definition literal is the template for a fixture
             :7 and :10                      CapabilityInvocationService and ExecutionLedger are already imported there

then written one case, added two imports, and it passed on the first run: 7/7 and typecheck clean
```

**Last round the same case took two attempts and six calls, both failures from guessing a shape that was one file away.** This round read
the file first and spent four. **The reading paid for itself and the margin is the note worth keeping.**

## The case, and its control

**It composes the runtime with no arguments and runs `dev.node_version` through an invocation service built the way the suite builds one**,
in a root with no `.dove/`. **The control asserts the root is still bare** - so the case is about absence and not about a project that happens
to be there - and a planted control flipping the expected status fails the case.

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **The other items.**
2. **The first real turn.**