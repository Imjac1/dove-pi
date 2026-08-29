# Design

## Boundaries

- `src/core/request-plan.ts` classifies intent and supplies a minimum desired output headroom.
- `src/core/model-gateway.ts` owns provider-neutral payload decoding, output-field normalization, accounting, and validation.
- `src/core/execution-ledger.ts` owns append-only recovery projections; the Pi adapter injects the host liveness probe.
- `src/pi-adapter/extension.ts` translates Pi events, chooses the final safe output limit from the actual payload, aborts rejected operations, and records lifecycle events.

## Adaptive output contract

1. Decode the current provider payload and conservatively estimate its input tokens.
2. Determine the provider-requested output limit from a supported payload field, falling back to the model limit and then the request-plan target.
3. Compute the maximum output that fits after input plus tool/provider overhead.
4. Preserve a smaller explicit provider limit.
5. If the safe capacity meets the request-plan target, allow up to the provider-requested safe capacity; the plan target is not a hard cap.
6. If safe capacity is below the plan target, retain the target for validation so Dove first tries removing only Dove-derived context. If the final request still cannot preserve that target, abort instead of silently sending a likely-truncated request.
7. Write the chosen limit back only through known provider fields; never mutate Pi's payload object in place.

## Recovery ownership

Started capability/provider ledger records include an optional positive `ownerPid`. Recovery projections accept a host-owned liveness function and return only legacy/unowned or inactive-owner records. Core does not import OS process APIs.

## Cache stability

The system prompt contains one compact, stable Dove policy and a stable registered-capability index. Intent changes affect tail context/tool availability, not the provider prefix. Ordinary chat removes Dove project snapshots from the model view.

## Failure behavior

- Invalid or overflowing final budget: append rejection records, call Pi `abort()`, do not create a started-provider record.
- Pi without an abort boundary: rethrow the original structured budget error.
- Unknown stop reason: record `unknown`, never invent success.
- Liveness probe says owner is active: leave the incomplete record untouched.

