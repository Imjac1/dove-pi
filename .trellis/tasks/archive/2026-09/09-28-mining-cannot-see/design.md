# Design: the declared limit on a failure record

## The field

```typescript
export interface FailureRecord {
	// ... unchanged ...
	/**
	 * What this record cannot see, when the cause is upstream of every recording hook.
	 *
	 * Declared rather than left to be inferred: the terminal name is what Dove observed and is not the cause, and a
	 * reader who is not told that will read `host-shutdown-preflight` as an explanation.
	 */
	readonly unseen?: string;
}
```

## The rule, and why it is narrow

Populated when **both** hold: the terminal reason is `startup-failed` (the preflight closure at
`request-lifecycle.ts:287-294`) and no provider outcome was found for the request. Both halves matter:

- a `startup-failed` terminal *with* a provider record means the cause is on the record, so a limit would be false;
- any other terminal means the request reached the loop, so the preflight closure is not what happened.

**It does not name the upstream cause.** The ledger does not hold `provider-authorization-denied` - the RPC did - and
importing that name into the record would be claiming an observation this process never made. The limit names the
boundary instead, which is the part the record can support.

## The correction, in place

The previous round wrote, in the loop specification and in the module documentation, that the mechanism "is in the
ledger after all, under `provider.request.completed` / `.rejected`". Both sentences are corrected rather than deleted,
because the over-broad version is exactly what a future reader would otherwise re-derive: the provider records exist
**when the request reached the provider**, and a preflight rejection writes none. The run that showed this is recorded
with its command so it can be repeated.

## Verification and rollback

- **Unit**: the preflight failure with no provider outcome; the same with one; and a convergence refusal and a provider
  failure, neither of which carries the limit.
- **Live**: the corpus reading over the real corpus, which now holds the run this round made, and the failure script
  over that ledger.
- **Rollback** removes the field and the population rule; records stay valid because it is optional.
