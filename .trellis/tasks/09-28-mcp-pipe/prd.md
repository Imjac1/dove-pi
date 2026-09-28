# The other headless interface

## Goal

Drive `dove-pi mcp` the way the rpc interface was driven, and see whether it shares its shape or its defect.

## Background: the same question, named and deferred

The previous round measured the rpc interface, found that every failure left with the code the specification reserves for a JSON parse
error, and fixed it. **It named mcp as the same question and left it for its own round**, which is this one.

**Two interfaces, one implementation each**, and the interesting question is whether the second repeats the first - either the same
collapse or the same clean answer.

## Requirements

- **R1 - Establish how mcp is driven**, from the README and the code, before driving it.
- **R2 - Drive it in a temporary project**, and record what it answers and whether it exits on its own.
- **R3 - Provoke at least two failures**, and record the codes or the equivalent.
- **R4 - Say whether mcp and rpc share a shape or a defect**, with the evidence.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The way to drive it is established before it is driven.
- [x] **AC2** Its answer is recorded verbatim, and whether it exits.
- [x] **AC3** Two failures are provoked and recorded.
- [x] **AC4** The comparison with rpc is stated with evidence.
- [x] **AC5** The gate passes.

## Out of scope

- **A full MCP client handshake**, unless that is what the documented form is.
- **Interfaces needing a Pi host.**
- **The first real turn**, which needs the host.