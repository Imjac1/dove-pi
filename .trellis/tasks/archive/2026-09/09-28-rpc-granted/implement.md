# Implementation plan: the granting half

## Ordered checklist

- [x] **1. The approval vocabulary.**
- [x] **2. The granted invocation.**
- [x] **3. Before and after.**
- [x] **4. The statement, then the gate.**

## The runs

```text
approval union: not_required | granted | denied | unavailable      (capability-protocol.ts:36)
capability-invocation.ts:64:  if (approval !== "granted") return false;   <- one gate, and granted passes it

dev.project_test  granted       -> status "approval_denied"    a workspace_write capability
dev.typecheck     granted       -> status "failure"            it RAN, and failed on the empty temporary project
dev.node_version  not_required  -> status "success"
files before 2, after 2
```

## What the two answers say together

**`granted` does open the gate**, and `dev.typecheck` is the proof: it reached execution and failed on the environment rather than on
permission. **And it does not open it for a writing capability**: `dev.project_test` is denied with the same `granted` value that let the
other one through.

**So there are two gates, and one status.** Approval is one of them; something else refuses a capability that declares `workspace_write`, and
**a caller cannot tell the two apart**, because both arrive as `approval_denied`. That is the same shape as the error-code collapse two rounds
ago, in the one place where being able to tell them apart matters most.

## What this round did not establish

**Which other gate refuses the write.** The round intended to read the full denial envelope for its `error` field and did not get that far -
the second attempt produced no output at all. Naming the gate is the honest next step, and it is not named here because it was not measured.

The fixture was removed and this repository is untouched.

## Validation commands

```powershell
<request with approval granted> | python dove_pi.py rpc
npm run typecheck
npm test
```

## Recorded, not built

1. **Effect classes beyond approval.**
2. **The first real turn.**