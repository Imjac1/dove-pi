# Implementation plan: the four lists

## Ordered checklist

- [x] **1. The four lists.**
- [x] **2. The behavioural items.**
- [x] **3. The load-bearing claim, by mutation.**
- [x] **4. The smoke matrix, then the gate.**

## The four lists, read

```text
:173  the load-bearing claim, the "still loads" item, and the four-transport smoke matrix
:258  dispatch metrics and both ledger record kinds; rejected work writes a failed completion first;
      missing metrics default retries and interventions to zero; parallel dispatch writes one completion
:327  snapshot verification detects changed, missing and extra files; restore returns content and file set;
      a failed multi-operation patch rolls back; path traversal and reserved snapshot paths are rejected
:391  the registry exposes the fixed development names; dev.node_version through Fast Path; non-zero,
      timeout and missing-tool behaviour at the boundary
```

**This file states its items as assertions** - most begin with *Assert* - where `framework-core.md` stated behaviours in prose. Same
section name, different voice, and the difference is worth knowing when searching for a holder.

## The claim about test sensitivity, tested the only way it can be

```text
the registered check   disabled -> tests 55, pass 52, FAIL 3     restored -> clean
the scope check        disabled -> tests 65, pass 63, FAIL 2     restored -> 65 pass, 0 fail
```

**The claim is true.** *"Each of the three is load-bearing on its own - removing either check must fail a case"*: disabling the registration
lookup fails three cases, disabling the scope decision fails two. **No search could have answered this** - it is a claim about whether the
tests would notice, and the only instrument for that is to make them not notice.

**Both mutations were restored and the tree is verified clean of them**, which matters because a mutation left in place would be a change to
the framework rather than a test of it.

## The smoke matrix item, held

`interop-smoke-matrix.test.ts:21` - *"returns the same Capability Protocol result shape through Core, RPC, MCP, and Pi"* - **which names all
four transports the item requires, in one case.**

## What was not checked

The safety-shaped items of the third and fourth lists - **path traversal and reserved snapshot paths rejected**, **rollback of a failed
multi-operation patch**, and the registry and boundary items of the fourth - were read but not held. They are named here rather than
implied.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The other specifications.**
2. **The first real turn.**