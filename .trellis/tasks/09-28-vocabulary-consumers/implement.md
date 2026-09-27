# Implementation plan: the vocabulary consumers get typed

## Before writing code

Load `trellis-before-dev`; read the vocabulary declaration and the two consumer sites. Curate `implement.jsonl` /
`check.jsonl`. **Curate and start in this same turn**, which the previous round skipped and recorded as a slip.

## Ordered checklist

- [x] **1. The decision channel**: type `appendChangeDecided` verdict, and follow the typecheck to the adapter call site.
- [x] **2. The isolation set**: type it against the vocabulary and fix what the typecheck then reports.
- [x] **3. Prove the isolation check fires**: rename a label in the vocabulary, run the typecheck, revert.
- [x] **4. The contract**: the composite channel, the reader-versus-writer rule, and the one thing neither check covers.
- [x] **5. The gate**, and a check that no test needed changing - if a test needed changing, the typing caught something real
      or the typing is wrong, and the round has to say which.

## The proof, and what it showed

```text
rename `fence` in the vocabulary -> npm run typecheck
  5 errors: 4 in src/core/action-policy.ts, 1 in src/core/harness-axes.ts
revert -> 0 errors
```

**Four of the five came from the producers**, which is the previous round typing the label a refusal carries - the check doing
its job on a rename it was not written for. **The fifth is this round**: without it the axis would have kept printing an
isolation refusal count that had quietly stopped counting fence refusals, and its own test would have kept passing because it
asserts its own two literals.

That is the class of defect this repository calls a declaration that is no longer true: a number in a reading, backed by a set
that no longer matches the vocabulary it came from.

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/harness-axes.test.ts tests/harness-readings.test.ts
```

## Recorded, not built

1. **A recursive type for composites**, with the reader already performing the decomposition.
2. **The rest of the survey**: the mode file vocabularies, whose loader refusals are their own check.