# Reading the usage review plan

## Goal

Read the last open task, measure its claims with the names the code uses, and say what remains.

## What the plan is

`08-28-dove-pi-usage-review` carries a 7524-character plan built from real session telemetry: ~192M prompt tokens across two
workspaces, cache hit rates of 97-99.9% in long sessions, one 169-turn session that ended in a full cold start at
179,915 input tokens with `cacheRead=0`, and tool-call profiles showing `bash` used 580 and 229 times.

**Its conclusion is sharp and it is probably right**: the cache strategy works and costs an unboundedly growing
prefix, while the deterministic reuse path never landed. Its suggestions are ordered P0 to P3 by token cost.

## The claim that was measured, and the half of it that is wrong

```text
the plan says   "the execution ledger has only project mutation; grep -c capability = 0"

the ledger      28 kind literals, including capability.started, capability.completed,
                capability.blocked, capability.approval.pending, capability.approved,
                capability.cancelled, capability.timed_out, capability.recovered

fast-path.ts    5 append sites: appendCapabilityApprovalPending, append with kind
                capability.blocked, appendCapabilityApproved, append with kind
                capability.started, and appendCapabilityTerminal
                kind literals: capability.blocked, capability.started, capability.completed
```

**So capability invocations *are* recorded in full.** What the plan actually measured was the *session tool-call
count* - `agent_run_capability` and `agent_run_recipe` at zero - which is a fact about the **model never invoking
one**, not about the **ledger failing to record it**.

**Those are different facts and the plan merged them.** The reuse-rate metric it asks for at P3 *already exists*;
what is missing is something that consumes it, and an incentive for the model to invoke at all - which is its P1.

## And that merge is this session own recurring class

```text
the count readers        a pattern built from the expected line, against a file that begins with a marker
the task name            a truncated name completed from memory
the nine word-searches   a search for the word rather than for the thing
the harness flags        four attempts at a call the existing suite already had, truncated in a read
the spec budget          statSync bytes against a rule that normalizes CRLF first
this plan                a session tool count read as a ledger gap
```

**Measuring one thing and concluding another** is the shape all of them share, and it is worth writing down
because the plan is otherwise the best-evidenced document this session has read.

## Acceptance criteria

- [x] **AC1** The plan and its research file were read.
- [x] **AC2** Its sharpest claim was measured against the code.
- [x] **AC3** The half that is wrong is named, and the half that is right is kept.
- [ ] **AC4** The plan own P0-P3 items, which are a programme rather than a round.