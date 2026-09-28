# The one action, named exactly

## Goal

Name the exact command that would open the first real turn, and the exact reason it is not run.

## Background: a permission boundary deserves to be stated precisely

The list of can-not-be-done conclusions is one item, and its reason is not a missing capability - `update --check` shows Pi is installable from
here - **but that installing it changes this machine**. **A boundary stated as *may this machine be changed* is worth stating exactly**: which
command, what it would do, and who could lift it.

**This round reads, and does not run.** The install path is documented in the launcher help, and the help is a file.

## Requirements

- **R1 - Read the launcher help** for the command that installs the runtime or Pi.
- **R2 - Name the exact command**, with the version it would act on.
- **R3 - Say exactly what it would change**, in terms of the machine rather than the repository.
- **R4 - Say who could lift the boundary**, and record rather than assume their answer.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The command is named from the help, not from memory.
- [x] **AC2** What it would change is stated precisely.
- [x] **AC3** Who could lift the boundary is stated.
- [x] **AC4** Nothing is installed, and the tree is unchanged.
- [x] **AC5** The gate passes.

## Out of scope

- **Running the install, in any form.**
- **Requesting escalation.**