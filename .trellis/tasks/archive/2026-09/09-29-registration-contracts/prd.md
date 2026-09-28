# The registration that must not change the contracts

## Goal

Decide whether the last request-runtime item can be checked, and hold it or qualify it accordingly.

## Background: the item that may be a statement about shape

The item is *assert Pi adapter registers tools/commands/shortcuts without changing core contracts*. **A previous round had to qualify an item
of this shape** - the mode id claim - because it was a statement about the shape of a codebase rather than a behaviour, and a string search
standing in for it was the defect.

**So this round asks the checkability question first.** A registration is a behaviour, but *"without changing core contracts"* may be a
structural consequence rather than something a case can observe - and if it is, saying so is the result.

## Requirements

- **R1 - Read the registering code** before deciding anything.
- **R2 - Answer the checkability question**: checkable, partly, or not, with the reason.
- **R3 - Hold the item if it can be held**, and say what the holder covers.
- **R4 - Qualify or record it if it cannot**, rather than writing a case that proves nothing.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The registering code is read, and what it registers is stated.
- [x] **AC2** The checkability answer is given with its reason.
- [x] **AC3** The item is held, or qualified, or recorded as not checkable.
- [x] **AC4** The gate passes.

## Out of scope

- **A case that proves nothing**, which is the failure mode this round is watching for.
- **The other specifications lists.**
- **The first real turn**, which needs a Pi host.