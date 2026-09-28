# The goal-tool policy, read for the first time

## Goal

Find the configured goal-tool policy that every round prompt names, and hold the session behaviour against it.

## Background: a policy named 151 times and never read

Every round prompt says to follow the configured goal-tool policy before reporting a blocker, and this session has used the goal tool 151
times without reading any policy. **So the round asks where it is.**

## Requirements

- **R1 - Look for the policy** in the tool own response and in the repository.
- **R2 - Say where it is, or that it is not a document.**
- **R3 - Hold the session behaviour against it**, clause by clause.
- **R4 - Say whether the goal should be completed, with the reason.**
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The tool response is read for a policy.
- [x] **AC2** The repository is searched for one.
- [x] **AC3** The behaviour is held against the policy found.
- [x] **AC4** The completion question is answered with a reason.
- [x] **AC5** The gate passes.

## Out of scope

- **Marking the goal complete to make the round look finished.**
- **The first real turn**, which needs a Pi host.