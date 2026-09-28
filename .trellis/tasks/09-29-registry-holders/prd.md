# Holders for the registry four behaviours

## Goal

Hold all four behaviours of `CapabilityRegistry`, and the unknown-name refusal in particular.

## Background: a refusal observed by hand and asserted by nothing

The last round read `CapabilityRegistry` and found that `require` throws *Unknown capability* for a name it does not hold, that the suite calls
`require` seventeen times without ever asserting the refusal, **and that an earlier round of this audit had driven that refusal through the rpc
interface and recorded it.** So the behaviour is observed and unheld.

**The registry is twenty-six lines with four behaviours** - `register` refusing a duplicate, `get` returning undefined, `list` enumerating,
and `require` throwing - **and this round holds whatever is unheld, not only the one that was already found.**

## Requirements

- **R1 - Read the registry as it is**, and list its behaviours.
- **R2 - Find what holds each**, rather than assuming only the known one is unheld.
- **R3 - Add holders for the unheld ones**, in the suite that already constructs registries.
- **R4 - Add a control**, and say in each case what it holds and what it does not.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The behaviours are listed from the code.
- [x] **AC2** Each is held or named unheld.
- [x] **AC3** Holders added for the unheld ones, with a control.
- [x] **AC4** The cases state their own scope.
- [x] **AC5** The gate passes.

## Out of scope

- **Changing the registry**, which is correct as written.
- **The request-runtime items still named.**
- **The first real turn**, which needs a Pi host.