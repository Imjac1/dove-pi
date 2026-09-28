# The one shipped file no typechecker has ever read

## Goal

Find out whether the stable launcher has defects a typechecker would catch, since nothing has ever looked at it that way.

## Background: what is and is not covered

| Cover | What it holds |
|---|---|
| `tsconfig.json` include | `src/**/*.ts`, `tests/**/*.ts`, `scripts/**/*.mts`, `.pi/**/*.ts` |
| `bin/dove-pi.cjs` | **not included** - it is `.cjs` |
| CI | runs it: `npm run pi:smoke` executes `--version` and `--help` |

**So the launcher is executed but never checked**, and it is the file the PATH entry points at. Six kilobytes of argument handling is
exactly the shape of code where a typechecker earns its keep.

**The measurement is direct**: run a checker over that one file with JavaScript checking on, and read what it says. **A clean report is a
result** - it would say the launcher is simple enough not to need the coverage the rest of the tree has - and anything it finds is a
finding.

## Requirements

- **R1 - Run a checker over `bin/dove-pi.cjs` alone** with JavaScript checking enabled, and record its output verbatim.
- **R2 - Read what it finds rather than counting it**: each report is either a real defect, a missing annotation, or noise from checking a
  CommonJS file that was never written for a checker.
- **R3 - Fix what is real**, at the smallest size that removes the defect, and keep the file working: `pi:smoke` is the proof.
- **R4 - If nothing is real, change nothing** and record the measurement, because adding annotations to a file that is fine is churn.
- **R5 - Consider the standing decision**: whether the launcher belongs in the project include, and say what would have to change for it
  to be worth it.
- **R6 - The gate passes**: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** The checker output for that file exists, verbatim.
- [ ] **AC2** Every report is classified, not just counted.
- [ ] **AC3** Anything fixed leaves `pi:smoke` passing.
- [ ] **AC4** The include decision is recorded either way, with the reason.
- [ ] **AC5** The gate passes.

## Out of scope

- **Rewriting the launcher**, which is not what a missing check asks for.
- **Turning on JavaScript checking for the whole project**, which would flood the suite.
- **The first real turn**, which needs a Pi host.
