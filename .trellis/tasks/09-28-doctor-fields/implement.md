# Implementation plan: the doctor projection fields

## Ordered checklist

- [x] **1. The output**: run doctor, read the two projections.
- [x] **2. The contract**: the field names it lists, with lines.
- [x] **3. The comparison, both directions.**
- [x] **4. Fix or record, then the gate.**

## The measurement

```text
doctor requestDiagnostics:  ["schemaVersion"]
contract names:             schemaVersion, lastTerminal, lastResourceObservation
doctor subagent:            ["provider","configured","available","reason","activeRuns"]
contract names:             provider, configured, available, and a sanitized reason   - all four present
```

**One difference, and reading the builder narrowed it.** The two missing fields are emitted only when the ledger holds a terminal or a
resource record (`execution-ledger.ts:73-74`), and the interface marks both optional - so the code never overstated anything. **The prose
was the one place that did**, and a consumer writing `doc.requestDiagnostics.lastTerminal` would get `undefined` silently on a fresh
workspace.

## What was held and what was not

The **presence** case is asserted in three suites. The **absence** case, which is what a fresh workspace gets and what a real doctor run
showed here, was held by nothing. It is now - and the assertion is the behaviour itself rather than a pattern over it: **the key is
omitted, not present with an undefined value**, which is what a consumer iterating keys sees.

## Validation commands

```powershell
npm run doctor
npm run typecheck
npm test
```

## Recorded, not built

1. **The rest of the doctor output**, which the contract does not bound.
2. **The first real turn**, which needs a Pi host.