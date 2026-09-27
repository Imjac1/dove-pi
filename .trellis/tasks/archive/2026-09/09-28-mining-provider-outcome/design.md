# Design: the provider outcome on a failure record

## Boundaries

| Piece | File | Why there |
|---|---|---|
| The field | `src/core/failure-reading.ts` | The reading is where a failure becomes a record; the provider outcome is one more thing the ledger holds about it. |
| The print | `scripts/harness-failures.mts` and `scripts/harness-corpus.mts` | Both already print a failure record, and a mechanism the reader cannot see is the defect this task exists to fix. |
| The finding | the loop specification | The observable boundary is a fact about the instruments, and the loop specification is where the instruments are described. |

## The record

```typescript
export interface ProviderOutcome {
	readonly stopReason: string;
	readonly httpStatus?: number;
	readonly diagnostic?: string;
}

export interface FailureRecord {
	// ... unchanged ...
	/** Where the provider itself landed, when the ledger holds it. A second vocabulary, kept separate. */
	readonly provider?: ProviderOutcome;
}
```

**Why the two vocabularies stay two.** The terminal code is Dove own name for what it observed (`host-shutdown-preflight`);
the provider outcome is the provider own (`stopReason: "error"`, `httpStatus: 401`). A single merged code would claim a
translation nobody performs - and the true statement is that the ledger holds **two facts about one failure**, each from
the boundary that saw it. Naming that honestly is also what makes the next step possible: a reader can decide the
terminal is the right mechanism for a *criterion* and the provider outcome is the right one for an *outage*, without the
record having pre-empted them.

## Where it comes from

`provider.request.completed` carries `stopReason` and `usage.httpStatus`; `provider.request.rejected` carries a
diagnostic (`execution-ledger.ts:296-301`). Both correlate by request id, so the reading matches on the id - never on
ledger position, the same rule the refusals follow and for the same reason.

The reading takes the **last** provider record for the request, because a request can take several provider calls and the
one that failed is the one that matters; if the last is not an error, the field is omitted rather than filled with a
success, since a failure record reporting a healthy provider would be worse than reporting nothing.

## The finding this cannot fix

The change manifest judges an edit by three observables: a criterion status, a criterion verification state, and a
refusal count. **"This failure is now named correctly" is none of them**, so an edit like this one cannot be predicted in
the closed set and its verdict would read `unobserved`. That is a boundary of the instruments rather than a defect in
them - and it is recorded in the loop specification, because the loop next needs to decide whether to widen the set or to
accept that instrument improvements are judged by a person.

## Verification and rollback

- **Unit**: a terminal `host-shutdown-preflight` plus a provider error with a status gives both, with no third code; a
  failure with no provider record gives none; a rejected provider gives its diagnostic; a request with a *successful*
  provider call and a failing terminal gives no provider outcome.
- **Live**: run both scripts and confirm a record shows what it holds.
- **Rollback** removes the field and the two print lines; the records stay valid because the field is optional.
