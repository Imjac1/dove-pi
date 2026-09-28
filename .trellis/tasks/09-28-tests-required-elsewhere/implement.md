# Implementation plan: where the required-test sections are

## Ordered checklist

- [x] **1. The sections**, found by the words each file uses.
- [x] **2. The negative**, named.
- [x] **3. What it means.**
- [x] **4. The gate.**

## My hypothesis was wrong, and the measurement says so

**I expected this file to be the only one with required-test sections. It is not.** Nine specifications carry them:

```text
capability-runtime.md     4      audit-vertical.md        2      extension-runtime.md     2
framework-core.md         6      request-runtime.md       2      convergence-record.md    1
harness-loop.md           1      managed-install.md       1      mode-format.md           1
project-context.md        1      plus backend and frontend quality-guidelines.md, headed Testing Requirements
```

**Twenty-three headings mention tests, and seventeen lists remain unread.** The method has a source of claims for many more rounds, and the
right answer to the question was *more to read*.

## The next target, and why it

**`capability-runtime.md`, which has four lists.** It is the capability and safety specification; this session drove four of its authorisation
rows by running them; and its lists ask about behaviour that has already been exercised here - so the holders should be findable and their
absence would matter.

## Its first list, read as a running start

```text
"a granted-but-unregistered capability is refused at the boundary ... each of the three is load-bearing on its own -
 removing either check must fail a case"                                            a mutation requirement
"a mode naming an unimplemented capability still loads, because the mismatch is a
 deployment fact and not a malformed mode"
"the vendor-account-free smoke matrix must exercise one read-only capability through
 Direct Core, CLI/JSON-RPC, official MCP transport, and Pi registered agent_run_capability"
```

**Two of these shapes are new to this audit**: an item that requires a check to be *load-bearing* - which is a claim about test sensitivity
rather than about behaviour - and one that names a *four-transport matrix*, whose rows are countable. `interop-smoke-matrix.test.ts` exists,
so that one at least has a suite with the right name.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **Reading new lists.**
2. **The first real turn.**