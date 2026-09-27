# Implementation plan: the verifier is outside the loop

## Before writing code

Load `trellis-before-dev`; read `.trellis/spec/backend/personal-agent-harness-loop.md` and
`.trellis/spec/backend/personal-agent-project-context.md` (both are edited). Curate `implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [x] **1. The split, in one script with assertions.** Extract the axis block, the decision block, their three matrix rows
      and their three test lines; move them into the records specification; refuse on an ambiguous or missing marker;
      assert no continuation is left orphaned.
- [x] **2. Correct the one sentence that says where the axis lives** - it was written when the axis moved *into* the loop
      specification, and it would otherwise contradict the move back.
- [x] **3. The boundary contract** in the loop specification, in the room the split made.
- [x] **4. Measure**: both files under 24 KiB, the loop specification with more than 1 KiB of headroom, the budget test
      green.
- [x] **5. Run the readings** - the corpus and the failure readings are described by the contracts that moved, and a
      specification move must not change what they do.

## The two things the split taught

1. **The file is CRLF, and splitting on a bare newline leaves a carriage return on every line** - so a strict equality
   against a line read from the file matched nothing, and the script refused twice before the cause was found. It now reads
   the line ending from the file and joins with the same one, so a move cannot silently rewrite every line.
2. **The continuation check earned its place.** The previous split left an orphan because it matched bullets by line
   prefix; this one refuses when the line after an extracted block looks like a continuation, which is the exact failure it
   was written from.

Measured: the loop specification went 24,232 -> 20,749 and then to **22,688** with the boundary contract written - 1.9 KiB
of headroom where it had 344 bytes - and the records specification took the two groups and sits at 21,674.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
node --import tsx --test tests/spec-context-budget.test.ts
node --import tsx scripts/harness-corpus.mts
```

## Risky files

| File | Risk | Mitigation |
|---|---|---|
| Both specifications | A move can split a wrapped bullet, which is exactly what happened last time. | Range extraction with markers asserted, and a check that the following line is not a continuation. |
| The budget test | It asserts each file second-level headings, so a heading carried along by mistake fails. | Headings are not moved: the two groups are bullets under existing scenarios. |

**Rollback** is a checkout of the two files.

## Recorded, not built

1. **The finer map** that would let the harness decide whether an edit is a verifier change.
2. **The Pi-hosted turn**, unchanged.