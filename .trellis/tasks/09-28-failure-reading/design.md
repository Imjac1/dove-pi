# Design: the failure reading

## Boundaries

| Piece | File | Why there |
|---|---|---|
| The request id on a refusal | `src/pi-adapter/extension.ts`, the four `appendGateRefused` sites | The ledger contract already accepts `requestId` and writes it into `correlation`; the call sites have the live id in scope and pass nothing. |
| The reading | `src/core/failure-reading.ts` (new, pure) | It is a function of ledger records, like the axis, so every case - including the corpus with no failure in it - is a unit test. |
| The classification | reused from `src/core/harness-axes.ts` | `classifyTerminal` decides which terminals are failures, so the reader and the SSM axis cannot disagree about what a failure is. |
| The printed reading | `scripts/harness-failures.mts` (new) | Same disposition as the axis and the behaviour map: prints, never asserts, exit 0. |
| The contract | `.trellis/spec/backend/personal-agent-project-context.md` | The convergence/evidence contract already lives there and has room. |

## The record

```typescript
export interface FailureRecord {
	readonly requestId: string;
	readonly class: "failure";                 // from classifyTerminal, the axis's rule
	readonly reason: string;                   // the RequestTerminalReason, usually "failed"
	readonly mechanism: {                      // what the reason collapses and the envelope keeps
		readonly code: string; readonly origin: string; readonly retryable: boolean; readonly summary?: string;
	};
	readonly refusals: readonly { readonly gate: string; readonly reason: string }[];
	readonly convergence?: { readonly state?: string; readonly acceptanceId?: string };
	readonly resources?: TaskResourceObservation;
	readonly component: ChangeSurface | "unattributed";
	readonly componentEvidence: string;         // the row that decided it, or why nothing did
}
export interface FailureReading {
	readonly requests: number;
	readonly failures: readonly FailureRecord[];
	readonly unrefused: number;                 // refusals with no request id: not attributed, and counted
	readonly corpus: readonly string[];         // what this corpus does NOT contain
}
```

**`reason` is the class and `code` is the mechanism**, which is the distinction Self-Harness requires and says is
usually missing. `terminalForFailure` (`extension.ts:565-573`) builds codes that name the cause exactly:
`provider-attempt-limit`, `retry-refused-after-effect`, `model-budget-rejected`, `provider-authorization-denied`,
`startup-conflict`. A record that kept only `reason: "failed"` would throw that away.

## Attribution: by id, never by position

A refusal is attached to a request by `correlation.requestId`, which R1 makes present. **Position is not a fallback
and that is deliberate**: `issueRequestHostAbort` settles a previous request's terminal, and a refusal can therefore
land after the next request has been received - a positional rule would attribute it to the wrong request. A refusal
with no id is counted in `unrefused` and reported, because guessing is the thing R1 removes.

## The component table, stated with its evidence

| Evidence in the record | Component | Why |
|---|---|---|
| a `gate.refused` record of any label | `middleware` | the policy that refuses is `src/core/action-policy.ts`, which the surface declares under `middleware`. |
| terminal `origin: "convergence"` | `middleware` | the convergence refusal is built in the tool-call path. |
| terminal `origin: "progress-guard"` | `middleware` | the guard sits in the same path. |
| terminal `code: "retry-refused-after-effect"` | `middleware` | the effect boundary refuses the replay. |
| terminal `origin: "model-budget"` | **`unattributed`** | the gateway is `src/core/model-gateway.ts`, and the surface declares `src` wholesale as `tool-implementation` - a claim that would point nowhere. **This is a finding about the map, not about the failure**: `tool-implementation: [src]` is the right shape for "what is editable" and too coarse for "which component caused this". |
| terminal `origin: "provider"` (any other) | `unattributed` | the cause is outside the harness; a provider outage is not one of our components. |
| anything else | `unattributed` | the evidence does not determine a component, and an invented attribution would point an edit at the wrong file. |

## The two gaps the corpus has, both reported rather than papered over

1. **No failure exists in the recorded corpus.** 164 ledgers, 164 `completed` terminals, no `tool.observed` record. The
   reading therefore reports "0 failures across N requests" **and** what the corpus lacks, so a quiet corpus is
   distinguishable from a broken reader.
2. **A failing tool leaves no record at all.** `appendToolObserved` is called only when `event.isError !== true`
   (`extension.ts:2798`), because the same write is what offers the `[Dove observable: ledger:tool:<id>]` marker a
   passing criterion may cite. So a failure record cannot name the tool that failed. **This task does not change it**,
   and the reason is not laziness: recording an errored tool would also make its id citable by a *pass*, which is a
   change to the citation rule rather than a telemetry fix. Recorded as a decision for whoever wants it.

## Verification and rollback

- **By fixture, because the corpus has no failure**: constructed ledger records exercise every branch - each
  mechanism, an unattributed refusal, an unfamiliar code, an empty corpus. The live reading is then run for the
  corpus observation it prints.
- **Rollback** removes the reading and the four `requestId` lines. The ledger records already written stay readable,
  so nothing is corrupted; what is lost is the attribution on refusals recorded before the change.
