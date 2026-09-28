# Implementation plan: the read-only switch

## Ordered checklist

- [x] **1. The switch and its consultation points**, read first.
- [x] **2. The capability path**, driven with it set.
- [x] **3. The tool path**, answered with evidence.
- [x] **4. The statement, then the gate.**

## The switch, read first

```text
extension.ts:266-267   /^(1|true|yes|on)$/i on DOVE_PI_READ_ONLY
consulted at           1059 (throws), 1447 (project task change), 1566 (capability authorizer),
                       1693 (convergence metadata), 2013 (workspace restore), 2042 (workspace patch)
reported at            1854-1855, inside the agent_doctor report under runtime
```

## Two findings, both measured

**One: the switch lives in the adapter, so the rpc entry point does not consult it.** All ten references are in `extension.ts`. Driven with
`DOVE_PI_READ_ONLY=1`, a writing capability over rpc is denied - **and the message says why**: *No approver is configured for this host*, not
that the session is read-only. **The outcome is the same and the reason is different**, which is exactly what the last round message made
visible.

**Two: the tool doctor reports it and the CLI doctor does not.** `runtime.readOnly` and `runtime.readOnlyReason` are set in the `agent_doctor`
report; the standalone doctor carries no such field, which is why a walk for any `readOnly` key in its output found nothing.

## Why neither is fixed here

**Neither claim is false.** The switch blocks what it says on the paths it guards - the project task change, the convergence metadata, the
workspace restore and patch, and the capability authorizer inside the adapter - and the doctor that a host reads reports it. What the
measurement adds is scope: **it is an adapter control rather than a runtime property, and only one of the two doctors says so**. Widening it
or reporting it in the other doctor are design decisions, and this round was to measure.

The fixture was removed and this repository is untouched.

## Validation commands

```powershell
$env:DOVE_PI_READ_ONLY="1"; <granted invoke> | python dove_pi.py rpc
npm run typecheck
npm test
```

## Recorded, not built

1. **Changing the switch**, unless a claim is false.
2. **The first real turn.**