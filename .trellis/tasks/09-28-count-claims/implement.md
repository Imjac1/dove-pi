# Implementation plan: prose does not count what the code declares

## Before writing code

Load `trellis-before-dev`; read the seven sites and the guideline file. Curate `implement.jsonl` / `check.jsonl` and start the
task in this same turn.

## Ordered checklist

- [x] **1. The seven replacements**, each read in place afterwards.
- [x] **2. The convention** in the quality guidelines, with the reason and the honest limit.
- [x] **3. Measure the loop specification** before and after, and confirm it did not grow.
- [x] **4. The gate** and a diff review of every sentence touched.

## The measurement, before and after

```text
.trellis/spec/backend/personal-agent-harness-loop.md   24,314 -> 24,306 bytes
nine sites replaced, none longer than what they replaced (one was, and was shortened)
```

**The first replacement grew the file by four bytes** - "the observables it may name" is longer than "three observables" - and
the acceptance criterion said the specification must not be larger. It was shortened to "by its observables", which is three
bytes shorter than the original phrase. That is the whole reason the criterion exists: a count protected by adding words spends
the room the next contract needs.

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/spec-context-budget.test.ts
```

## Recorded, not built

1. **The illustrative numbers**, which are about an argument rather than an enumeration.
2. **A check for prose counts**, which cannot exist.