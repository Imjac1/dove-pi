# The step that survives a mode change

## Goal

Hold the mode-change item, and the two cheaper halves of the shell boundary.

## Background: a safety-shaped item and a fixed order

The item says *a mode change preserves the running-step snapshot and affects the next step*. **That is a safety claim**: changing mode in the
middle of a run must not lose where the run is. **The owner is `mode-controller.ts`**, and the order is fixed by the last round: read the
owning file, then write.

**Two cheaper halves also wait**: the `stderr` field of a shell result, and the `pwsh`-then-`powershell` fallback - both implemented, both
unasserted, and both in a module already read.

## Requirements

- **R1 - Read `mode-controller.ts`** before writing anything, and say what it does with a running step.
- **R2 - Hold the mode-change item**, or name the half that is unheld.
- **R3 - Hold the two shell halves**, asserting what each is for rather than that a call returns.
- **R4 - Add a control wherever a new assertion is added.**
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The owning file is read first, and the round says what it found.
- [x] **AC2** The mode-change item is held or named.
- [x] **AC3** The two shell halves are held, with controls.
- [x] **AC4** The gate passes.

## Out of scope

- **The Pi registration item**, which stays named.
- **Changing any behaviour.**
- **The first real turn**, which needs a Pi host.