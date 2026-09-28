# The change manifest and the verdict it feeds

## Goal

Establish what a change manifest is, and whether a manifest written by hand in a temporary project can exercise the verdict machinery.

## Background: the session oldest subject, approached from the outside

The verdict compares what a change predicted against what the ledger observed, and every part of it has been read, tested and audited here.
**What has never happened is a change manifest being read by the machinery in this environment**, because a manifest is written by a tool the
agent calls, and there is no agent.

**A manifest written by hand is not the real turn** - it does not test the tool that writes one, and this round must say so. **What it could
test is everything downstream of the manifest**: the read, the observables, the comparison, the verdict. That is worth knowing before deciding
whether it is worth doing.

## Requirements

- **R1 - Read what a manifest is**, where it lives, and what shape it must have, before writing one.
- **R2 - Read who writes it and who reads it**, and say which half a by-hand manifest can exercise.
- **R3 - Decide whether to write one**, on the evidence, and say what it would and would not test.
- **R4 - If it is written, exercise the read and record what the machinery says**, including any refusal.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The manifest shape and its location are stated.
- [x] **AC2** Its writer and its reader are named.
- [x] **AC3** The decision is made on evidence, and what a by-hand manifest cannot test is stated.
- [x] **AC4** If written, the machinery is run against it and the result recorded.
- [x] **AC5** The gate passes.

## Out of scope

- **Pretending a by-hand manifest is the real turn.**
- **The tool that writes one**, which needs an agent.
- **The first real turn**, which needs a Pi host.