# The headless interface, driven by a pipe

## Goal

Send a JSON-RPC request to `dove-pi rpc` through a pipe, in a temporary project, and read the answer.

## Background: the last surface this environment can reach

A previous round set `rpc` and `mcp` aside as needing a host. **The README documents a form that does not**: a single request piped into the
command, with `diagnostics/status` as the example method. That is the headless interface automation uses, and it has never been run here.

**It is also the one interface with a documented request shape**, which makes it checkable: the README says what to send, so the round can
send exactly that and hold the answer against what the docs promise.

## Requirements

- **R1 - Create a temporary project** and drive the interface there, never in this repository.
- **R2 - Send the documented request** and record the response verbatim.
- **R3 - Send one malformed request** and one unknown method, and record both refusals.
- **R4 - A process that does not exit is closed with a timeout**, and the round says whether that happened.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** The documented request is sent and its response recorded.
- [ ] **AC2** Two refusals are provoked and recorded.
- [ ] **AC3** Whether the process exits on its own is stated.
- [ ] **AC4** The fixture is removed and this repository is untouched.
- [ ] **AC5** The gate passes.

## Out of scope

- **mcp**, which is the same question and can wait for its own round.
- **Clients that connect over a socket**, since the documented form is a pipe.
- **The first real turn**, which needs a Pi host.
