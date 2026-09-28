# The replay, with the ledger path known

## Goal

Build the isolated archived-scenario replay: no duplicate request persistence and no duplicate tool execution.

## Background: the ledger path was one grep away, and the flags were four attempts away

The previous round named the missing fact: where the driver writes the ledger. **It is `<stateDir>/execution.jsonl`**,
with `stateDir` at `resolve(scenarioRoot, "dove-state")` - and `scenarioRoot` is in the run summary, so the test
can build the path exactly rather than guessing it.

## Requirements

- **R1 - Replay the archived scenario through the public launcher**, with the faux provider.
- **R2 - Read the ledger the run wrote**, and count the duplicates the acceptance criterion names.
- **R3 - Say what the ledger cannot show**, rather than implying it can.
- **R4 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The scenario runs in isolation, under a temporary root.
- [x] **AC2** No tool call identifier ran twice.
- [x] **AC3** The requests received do not exceed the prompts in the scenario.
- [x] **AC4** The gate passes.