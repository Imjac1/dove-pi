# The reading names the boundary it cannot see

## Goal

The corpus now holds a **real** failure - the first one - and reading it refutes part of what the previous round
claimed. Correct that, and make the failure record say what it cannot see instead of leaving a reader to assume the name
it does carry is the cause.

## Background: the first real failure, measured

The black-box harness was run the way the suite runs it, with an unauthenticated provider, and its state was kept:

```
rpcFailure.terminal      = { origin: "provider", code: "provider-authorization-denied" }
ledgerTerminal.terminal  = { origin: "session",  code: "host-shutdown-preflight" }
terminalConsistency      = "mismatch"
diagnosticGap            = "rpc-error-not-preserved-in-ledger"

ledger records: 2 - request.received, request.terminal   (no provider.request.* at all)
```

**Two corrections follow, and the second is the important one.**

1. **The previous round claim was too broad.** It said the mechanism "is in the ledger after all, under
   `provider.request.completed` / `.rejected`". That is true when the request reached the provider - and **false for a
   preflight rejection**, where Pi refuses the request before the Dove hooks run, so no provider record is written. The
   claim was verified against a fixture **built to the shape the reading expected**, which is the failure mode this
   project keeps finding: a test that encodes the assumption it is meant to check.
2. **So for the most common real failure the ledger holds no cause at all**, and the reading reports
   `host-shutdown-preflight` as the mechanism. That name is what Dove observed, and it is not wrong - but a reader of
   the failure record has no way to learn that the cause was never in this ledger.

## Requirements

- **R1 - The reading says what it cannot see.** A failure whose terminal is `startup-failed` (the preflight closure)
  with **no** provider outcome carries a declared limit: the request ended before the agent loop started, whatever
  rejected it did so upstream of the recording hooks, and this ledger cannot name the cause. A record that has a
  provider outcome carries no such limit, because then the cause is on the record.
- **R2 - It does not guess the upstream cause.** The ledger does not hold `provider-authorization-denied`; the RPC did.
  The reading names the boundary and never imports the name it cannot check.
- **R3 - The corrected claim is corrected where it is written**: the loop specification and the module documentation that
  repeated it, so the next reader does not inherit the over-broad version.
- **R4 - The first real failure is recorded as evidence**, with the run command that produced it, so the corpus has a
  reproducible failure rather than a fixture.
- **R5 - The corpus reading shows it**, which is the first time that reading has had a failure to aggregate.

## Acceptance Criteria

- [ ] **AC1** A preflight failure with no provider outcome carries the declared limit, naming the boundary rather than a
      cause.
- [ ] **AC2** The same failure **with** a provider outcome carries none: the limit is about absence, and there is none.
- [ ] **AC3** A failure that is not a preflight closure (`failed` at the provider, a convergence refusal) carries none.
- [ ] **AC4** The corrected wording appears in the loop specification and in the module documentation, and the
      over-broad sentence is gone from both.
- [ ] **AC5** The failure script prints the limit, and the corpus reading reports the real failure with it.
- [ ] **AC6** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.

## Out of scope

- **Making Dove record the preflight rejection.** The refusal happens upstream of every hook Dove has; inventing a
   record would claim an observation the process never made. If Pi exposes it, that is a different investigation with a
   different cost.
- **Preserving this run for the repository.** It lives under the temporary directory, as every black-box run does; the
   command is recorded so it can be reproduced.
- **Widening the manifest observables**, still the open question from the previous round.
