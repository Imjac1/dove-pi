# The installer parameters, as declared and as accepted

## Goal

Compare the switches the bootstrap is documented to accept with the ones its `param` block declares, in both directions.

## Background: why this and not a run

The installer cannot be run here: it installs into `%LOCALAPPDATA%\DovePi`, touches PATH and fonts, and a run would change the machine.
**Its parameter surface can be read instead**, and it is a surface two documents make claims about:

| Document | Claim |
|---|---|
| `.trellis/spec/backend/personal-agent-managed-install.md` | "A downloaded `install.ps1` additionally accepts `-NoPath`, `-NoFont`, `-NoExtensions`, and an HTTP/HT…" |
| `README.md` / `README.en.md` | the switches a user is told about |
| `install.ps1` | the `param` block, which is what actually decides |

**Both directions matter**: a switch a document promises and the script does not accept is a user-visible lie, and a switch the script
accepts that no document names is one nobody will find. This is the same shape as the index, the path and the release-root checks: a
declaration naming things, compared with the things.

## Requirements

- **R1 - Read the `param` block** and the switch names it declares.
- **R2 - Read every switch the two documents name**, including the README in both languages.
- **R3 - Compare both directions** and report the differences, with the document and line for each.
- **R4 - Whatever the comparison finds is the round**: a promise with no switch is fixed by the script or by the document, and a switch
  with no document is fixed by naming it. **No change is made before the comparison is reported.**
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** The three lists exist, with their sources named.
- [ ] **AC2** The comparison is reported in both directions.
- [ ] **AC3** Anything it finds is fixed at the side that is wrong, and the fix is verified.
- [ ] **AC4** The gate passes.

## Out of scope

- **Running the installer**, which writes outside the repository.
- **Changing what a switch does**, which is not what a missing name is.
- **The first real turn**, which needs a Pi host.
