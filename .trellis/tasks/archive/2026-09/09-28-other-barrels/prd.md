# The other barrels

## Goal

Establish which `index.ts` barrels in `src` have consumers, and what the ones without mean.

## Background: the gap the last round named

A round measured `project-provider/index.ts` and found it load-bearing, and left the rest of the barrels out of scope in its own words.
**A barrel with no importer is an export wall with no consumer** - and the module-graph round cannot see it, because a barrel is a module
like any other and something imports *some* file in its directory.

**The measurement is a set comparison**: every `index.ts` in `src`, and every file that imports one.

## Requirements

- **R1 - Find every `index.ts` under `src`**, and what each re-exports.
- **R2 - Find every importer** of each, with what it takes.
- **R3 - Classify each barrel**: load-bearing, imported for its types only, or unreferenced.
- **R4 - An unreferenced barrel is either removed or recorded** with the reason it stays, and the suite must pass either way.
- **R5 - A check is added only if it is not a weaker duplicate** of the ones holding the surfaces above.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Every barrel is listed with what it re-exports.
- [x] **AC2** Every importer is listed with what it takes.
- [x] **AC3** Each barrel is classified.
- [x] **AC4** Anything unreferenced is removed or recorded with its reason.
- [x] **AC5** The gate passes.

## Out of scope

- **Barrels outside src**, which this measurement does not cover.
- **The load-bearing barrel a previous round settled**.
- **The first real turn**, which needs a Pi host.