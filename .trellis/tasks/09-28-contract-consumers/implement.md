# Implementation plan: the consumers of the widened contract

## Ordered checklist

- [x] **1. The consumers**, from the type outward.
- [x] **2. The classification.**
- [x] **3. Fixes, if any.**
- [x] **4. The gate.**

## The consumers, on both sides of the contract

```text
consumer                       what it does                                      class
fast-path.ts:51                uses the value as the refusal reason              handles the string
cli.ts:388                     authorize: () => true                             returns a boolean
extension.ts:1566              authorize: async () => !(readOnly && writing)     returns a boolean
local-rpc.ts:26-31             passes an authorize option through                nothing supplies it
extension.ts:2672              if (!approved) on a value from ctx.ui.confirm     NOT this contract
```

## Nothing reached further than the call site

**Every consumer either handles the string or cannot produce one.** The two suppliers return booleans - the CLI always true, the adapter
true unless read-only mode blocks a writing capability, with a comment saying the host tool call is the execution decision and Dove adds no
second prompt. **Only the rpc path supplies nothing**, which is the gate the last two rounds named, and that path is where the new sentence
appears.

**And the truthiness check that prompted this round is not a consumer**: its `approved` comes from `ctx.ui.confirm`, the host dialog, which
returns a boolean. Reading it as a boolean is correct.

**So the change was as wide as its call site and no wider.** That is the honest result of checking a change: the interesting outcome is the
one where nothing needs fixing, and it is only worth believing because every consumer was read.

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **Widening further.**
2. **The first real turn.**