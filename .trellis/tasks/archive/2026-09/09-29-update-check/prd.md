# The check that needed a network nobody measured

## Goal

Measure whether this machine has network access, and run `update --check` if it does.

## Background: a read-only command declined for an unmeasured reason

`dove-pi update --check` documents itself as *reporting available stable updates **without changing anything***. **An earlier round declined to
run it because it needs the network** - and never measured whether the network exists. **That is the same defect as the fallback two rounds
ago**: a conclusion about a machine that was not tested.

## Requirements

- **R1 - Measure the network**, and record how - a probe whose failure is informative.
- **R2 - If there is one, run `update --check`** and record its exit code and output.
- **R3 - Read what it did to the tree**, before and after.
- **R4 - If there is no network, say so plainly**, and say what that means for the command own claim.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The network is measured, and the method named.
- [x] **AC2** The command is run if it can be, with output recorded.
- [x] **AC3** The tree is compared before and after.
- [x] **AC4** The gate passes.

## Out of scope

- **Running any command that changes the machine.**
- **The first real turn**, which needs a Pi host.