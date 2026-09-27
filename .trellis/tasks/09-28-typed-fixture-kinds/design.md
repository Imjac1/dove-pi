# Design: typing the fixture kind, and what it found

```typescript
import type { ExecutionRecordKind } from "../src/core/contracts.ts";
function record(kind: ExecutionRecordKind, stepId: string, details: Record<string, unknown>, requestId = "req-1"): string
```

**What it found: nothing.** The readings suite passes 5 of 5 with the kinds checked, and the ledger kinds named anywhere in the
suite are `request.received`, `request.terminal`, `gate.refused`, `change.applied`, `change.decided` and
`task.convergence.observed` - all declared. So the suite had never made the mistake the probe made, and **that is the answer to a
question nobody had asked**, which is what a correctness check is worth.

**Why it is still worth doing**: the probe made the mistake, and the probe was written the same way a fixture is - by hand, from
memory. The typing removes the possibility rather than the instance.

**One boundary kept**: `kind` literals that are *not* ledger kinds (a document kind, a project artifact kind) are left alone. The
typing belongs on the ledger-line builder, not on every `kind` field in the suite.
