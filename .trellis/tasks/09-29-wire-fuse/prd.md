# Wiring the fuse into the request path

## Goal

Give the session fuse a consumer, without duplicating the advice an existing guard already gives.

## Background: a reading with six holders and no caller

The previous round measured that `context-guard.ts` already advises compaction, is wired in, and is tested - and
that the fuse answers a **different question**: `guardContext` reads the usage Pi reports, so a cold start
re-bills the whole prefix at full price while `fractionUsed` is unchanged. **It was written without knowing that,
was reconciled in the last round, and was still unwired.**

## Requirements

- **R1 - Wire it at the site where the guard is already called**, rather than somewhere new.
- **R2 - Its own one-shot flag**, so two independent notices are not one repeated.
- **R3 - An undefined window must not produce a ratio**, which the fuse already guarantees.
- **R4 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The fuse reads the diagnostics the adapter already collects.
- [x] **AC2** It notifies once, under its own flag, beside the guard rather than inside it.
- [x] **AC3** An undefined context window is passed as zero, which the fuse answers `ok` for.
- [x] **AC4** The gate passes.