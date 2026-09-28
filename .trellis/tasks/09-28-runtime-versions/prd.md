# The runtime versions, as declared and as enforced

## Goal

Hold every statement of a minimum runtime version against the code that enforces it.

## Background: a sixth kind of declaration

| Round | Declaration held against reality |
|---|---|
| 58-64 | command, switch, subcommand, capability and field names |
| **this** | **a minimum version number** |

A version requirement is stated in more places than any name is:

| Place | What it says |
|---|---|
| the release manifest | `runtime: { python: ">=3.10", node: ">=22.19.0" }` |
| the workflows | `node-version: 22.19.0`, `python-version: "3.11"` |
| the bootstrap | prerequisite checks before anything is installed |
| the READMEs | what a user is told to install |

**A minimum declared in one place and enforced in another can disagree**, and the failure mode is the worst kind for a user: told they
are fine, then refused by the tool. **The enforced value is the source of truth**, and finding it means reading the check rather than the
prose.

## Requirements

- **R1 - Find every place a minimum version is stated**, with the line.
- **R2 - Find the place it is enforced**, by reading the check rather than the documentation of it.
- **R3 - Compare**, and say for each difference which side is wrong - a loose doc or a strict check.
- **R4 - Fix at the side that is wrong**, and verify by running the check.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** Every statement of a minimum is listed with its source.
- [ ] **AC2** The enforcement point is identified and quoted.
- [ ] **AC3** Differences are reported with the side that is wrong.
- [ ] **AC4** Anything fixed is verified by running the check.
- [ ] **AC5** The gate passes.

## Out of scope

- **Raising a minimum**, which is a product decision.
- **Pi own version**, which the release locks exactly and a previous round settled.
- **The first real turn**, which needs a Pi host.
