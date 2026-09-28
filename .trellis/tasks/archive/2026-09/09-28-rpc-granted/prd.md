# The half of the boundary that lets something through

## Goal

Measure whether an approved writing capability runs, which is the half the previous round left unmeasured.

## Background: a gate that never opens is a wall

The previous round drove `capabilities/invoke` for a read-only capability and for a writing one, and found that `unavailable` and `denied`
both produce `approval_denied`. **It never sent `granted`**, so the boundary was measured on the refusing side only.

**The executing side is safe to measure in a temporary project**: `dev.project_test` runs the repository declared test script, and a
temporary directory has no `package.json`, so the capability is expected to *fail* there - which is a result, and it changes nothing on this
machine.

## Requirements

- **R1 - Read the approval vocabulary first**, so the value sent is one the code accepts.
- **R2 - Send `granted` for a writing capability** in a temporary project, and record what comes back.
- **R3 - Compare the file set before and after**, because a granted write is supposed to change something.
- **R4 - Say whether the gate opens**, with the evidence, and what it means if it does not.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The vocabulary is read and the value named.
- [x] **AC2** The granted invocation is recorded verbatim.
- [x] **AC3** The temporary project is compared before and after.
- [x] **AC4** Whether the gate opens is stated with evidence.
- [x] **AC5** The gate passes.

## Out of scope

- **Effect classes beyond approval**, which the capability declarations cover.
- **Running any of this in this repository.**
- **The first real turn**, which needs a Pi host.