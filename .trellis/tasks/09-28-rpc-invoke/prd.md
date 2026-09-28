# The approval boundary, over the interface that serves it

## Goal

Run the two rpc methods left unrun, and measure what happens at the approval boundary.

## Background: the safety-relevant path that has never been driven

The rpc server serves `capabilities/list`, `capabilities/invoke` and `diagnostics/status`, and only the third has been run. **`invoke` is
the one that carries an approval field**, and it is the entry to the capability pipeline from outside the CLI - so it is where the approval
boundary can be observed rather than read.

**The boundary has two sides worth measuring**: a read-only capability, which should not need approval, and a writing one, which should be
refused without it. A previous round measured that four capabilities declare `workspace_write` and none was run, because running one would
change the machine - **this drives the request and observes the refusal, which changes nothing**.

## Requirements

- **R1 - Run `capabilities/list`** and record what it returns.
- **R2 - Invoke a read-only capability** and record the result.
- **R3 - Invoke a writing capability with approval unavailable**, and record the refusal.
- **R4 - Drive it in a temporary project**, and remove the fixture afterwards.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** `capabilities/list` is run and its answer recorded.
- [x] **AC2** A read-only invoke is run and its result recorded.
- [x] **AC3** A writing invoke without approval is refused, and the refusal recorded.
- [x] **AC4** The fixture is removed and this repository is untouched.
- [x] **AC5** The gate passes.

## Out of scope

- **Invoking a writing capability with approval**, which would change this machine.
- **Clients that connect over a socket.**
- **The first real turn**, which needs a Pi host.