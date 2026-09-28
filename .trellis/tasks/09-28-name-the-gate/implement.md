# Implementation plan: naming the gate

## Ordered checklist

- [x] **1. The producers**, from the code.
- [x] **2. The run refusal**, with its error field.
- [x] **3. The comparison.**
- [x] **4. The name, then the gate.**

## The gate, named

```text
capability-invocation.ts:62-66   three conditions in one authorize callback
  !requiresApproval                 -> true    a read-only capability passes here
  approval !== "granted"            -> false   the first gate, for an unapproved caller
  options.authorize ? ... : false   -> false   THE SECOND GATE, when no approver is registered

adapters/local-rpc.ts:26-31   accepts an authorize option and passes it through; it is optional
cli.ts:388                    supplies authorize: () => true only when trustedCliApproval

the run:  status approval_denied, error "Capability approval was not granted."
```

## What the name is, and what it explains

**The second gate is `options.authorize`** - the callback the invocation service asks when a capability requires approval. The rpc adapter
**accepts it** in its constructor and **nothing supplies it**, so line 65 falls through to false and every capability that requires approval is
denied over rpc, whatever the `approval` field says.

**And that is why the two gates cannot be told apart**: the refusal is the same status and the same sentence - *Capability approval was not
granted* - whether the caller sent `granted` or sent nothing at all. The message is true of the first gate and misleading about the second.

## The candidate fix, named and not made

A message that names which of the two refused - no approver configured, or approval not granted - would separate them without touching the
status vocabulary, which is out of scope here. **It is named rather than made** because the task was to name the gate, and a user-visible
string deserves its own round with its own evidence.

## Validation commands

```powershell
<granted invoke> | python dove_pi.py rpc
npm run typecheck
npm test
```

## Recorded, not built

1. **The status vocabulary**, if the gates cannot be told apart.
2. **The first real turn.**