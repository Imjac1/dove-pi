# The release gate, given artifacts built from this tree

## Goal

Exercise the one release link this environment has never run: the readiness check, with artifacts built from this repository.

## Background: what is measured and what is not

| Link | Status |
|---|---|
| `npm run typecheck`, `npm test`, `test:installer`, `doctor`, `pi:smoke` | run here, all green |
| `release:manifest` | run here: builds, and its digest is stable across two builds |
| `release:check` | **never given anything to check** - round 48 measured that it requires five arguments and nothing more |

**And it is the gate that decides whether a release may ship**: it validates the checksum against the archive, the archive against the
manifest, that the archive own `release.json` matches the published one, and the bootstrap. If artifacts built from this tree cannot pass
it, that is worth knowing here rather than at a release.

**It only reads**, so it is safe to run: no install, no network, no `%LOCALAPPDATA%`.

## Requirements

- **R1 - Build what the release workflow builds**: a stage of the shipped roots plus `release.json`, zipped, with its checksum, and the
  bootstrap beside it.
- **R2 - Run the gate on them** exactly as the workflow does, and report its verdict.
- **R3 - If it fails, the failure is the finding**: the message says which of the four validations refused, and that is reported rather
  than worked around.
- **R4 - If it passes, that is recorded as a measurement**, not as a change: the round has nothing to fix and says so.
- **R5 - The artifacts are built in a temporary directory** and removed, so the repository is untouched.

## Acceptance Criteria

- [ ] **AC1** The four artifacts exist in a temp stage and the manifest inside the archive matches the published one.
- [ ] **AC2** `release:check` runs with the five arguments and its exit code and message are recorded.
- [ ] **AC3** The repository is clean afterwards.
- [ ] **AC4** The gate passes: typecheck, the suite and the spec budget test.

## Out of scope

- **A real install**, which writes to `%LOCALAPPDATA%` and is not this round.
- **Publishing anything**, which is a release owner decision.
- **The first real turn**, which needs a Pi host.
