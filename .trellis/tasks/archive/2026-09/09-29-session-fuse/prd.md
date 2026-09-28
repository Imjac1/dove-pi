# The session-size fuse

## Goal

Do the usage review P0: a fuse that reports when the prompt prefix nears the context window, or when a full
cold start has just been billed.

## Background: the defect this answers was measured by someone else

The 20260830 usage review found a fixed prefix growing to 180-210k tokens and one 169-turn session ending in a
full cold start at 179,915 input tokens with `cacheRead` at zero. Content compaction existed; conversation
compaction did not. Its P0 asks for a session-size fuse driven by cache diagnostics.

## Requirements

- **R1 - Read the diagnostics the adapter already collects**, rather than a round count or a guess.
- **R2 - Three answers**, each about something measurable.
- **R3 - An unknown window must not produce a ratio** that looks like a measurement.
- **R4 - Recommend, and do not act**: the conversation belongs to the caller.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** `cold_start` is reported when the last miss was not a warmup.
- [x] **AC2** `near_limit` fires at the ratio the review names, and names `/compact`.
- [x] **AC3** A window of zero, negative, NaN or infinity yields `ok` and a ratio of zero.
- [x] **AC4** The gate passes.