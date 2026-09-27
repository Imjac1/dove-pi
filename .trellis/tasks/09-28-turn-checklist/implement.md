# Implementation plan: the turn, executable

## Before writing

Load `trellis-before-dev`; read the schema of `agent_task_convergence`, the four script headers, and the loop contract turn
section. Curate `implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [x] **1. Prerequisites** with the check for each, including the Pi host and the formal native task.
- [x] **2. The seven steps**, each with the call, the fields and the expected reading.
- [x] **3. The boundaries** where they are acted on.
- [x] **4. Failure modes**: what a missing reading means at each step.
- [x] **5. Verify the guide against the schema and the scripts**, correcting any drift found.
- [x] **6. The guides index** links it.

## The check that makes this a guide rather than a memory

Ten claims were verified against the thing that owns each one, all of them passing: the `applied` operation and the `commit`
and `predictedRegressions` fields against the tool schema, the three observable names against the parser, the `cite:` line
against the failure script, the usage forms of the three scripts against their own headers, `verdictOnly` against the ledger
appender, and `verifiedBy` against the declaration.

That is the difference between this and a document written from a working session: the guide says which of its parts were
checked, so a reader knows where to look when reality moves.

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/spec-context-budget.test.ts
node --import tsx scripts/harness-corpus.mts | Select-Object -First 12
```

## Risky files

| File | Risk | Mitigation |
|---|---|---|
| The guide | Instructions that drift from the tools are worse than none. | Every field and command is checked against the schema and the script headers in this task, and the guide says which parts were checked. |
| The guides index | A guide nobody can find is a file. | The index is updated in the same commit. |

**Rollback** deletes the guide and reverts the index.

## Recorded, not built

1. **Running the turn**, which the guide is for.
2. **The loop specification split**, still waiting for a contract that needs the room.