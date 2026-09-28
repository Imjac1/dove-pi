# The two conclusions that lean on the layer fact

## Goal

Test the layer fact that two not-checkable conclusions lean on, rather than quoting it.

## Background: two qualifications and one shared reason

Two claims were qualified rather than held: **the mode id claim** (a vertical mode id in executable code under `src/core` would be a framework
defect, but a workspace mode shares the name `pentest`) and **the registration second half** (the adapter registers into the host and does not
change core contracts). **Both lean on the same fact**: `src/core` imports nothing from the Pi side, which the layer check holds.

**A previous round re-tested a not-checkable conclusion and falsified it**, because the machine had not been measured. **This round tests the
fact both conclusions lean on**, instead of repeating the conclusion.

## Requirements

- **R1 - Re-run the layer check**, and record what it reports now.
- **R2 - Test the fact directly**, by listing what `src/core` imports and what imports from `modes/`.
- **R3 - Say whether the fact is strong enough to carry both qualifications.**
- **R4 - If it is not, name what it cannot cover.**
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The layer check is re-run and its report recorded.
- [x] **AC2** The fact is tested directly, not quoted.
- [x] **AC3** Whether it carries both qualifications is stated.
- [x] **AC4** Anything it cannot cover is named.
- [x] **AC5** The gate passes.

## Out of scope

- **Repeating a conclusion instead of testing it.**
- **Changing any module.**
- **The first real turn**, which needs a Pi host.