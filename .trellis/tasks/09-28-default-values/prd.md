# The defaults, as documented and as coded

## Goal

Hold every default the documents state against the default the code applies.

## Background: a ninth kind of declaration, and the one a user meets by doing nothing

| Round | Declaration held against reality |
|---|---|
| 58-68 | names, versions, variables, schema versions |
| **this** | **a default value** |

A default is the behaviour a user gets when they say nothing, which makes it the most-used value in the product and the least examined.
It is stated in prose - "quick (default)", "default: stored profile, else max" - and applied in code, in three places at least: argparse
defaults, PowerShell parameter defaults, and TypeScript fallbacks.

**A documented default the code does not use is worse than a missing document**, because the document is the only place the behaviour was
stated and it is wrong.

## Requirements

- **R1 - Extract every default the documents state**, with the line and the value.
- **R2 - Find the default the code applies**, by reading the declaration rather than inferring it.
- **R3 - Compare**, and report every disagreement.
- **R4 - Anything broken is fixed at the side that is wrong**, and verified by running the command without the flag.
- **R5 - A check is added only if it is not a weaker duplicate** of the ones holding the surfaces above.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** Every documented default is listed with its source.
- [ ] **AC2** Every coded default is listed with its source.
- [ ] **AC3** Disagreements are reported and fixed, verified by running without the flag.
- [ ] **AC4** Any check added is justified against the ones that exist.
- [ ] **AC5** The gate passes.

## Out of scope

- **Defaults Pi applies**, which Dove passes through.
- **Defaults of undocumented flags**, which are not a promise to anyone.
- **The first real turn**, which needs a Pi host.
