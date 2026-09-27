# The vocabulary consumers get typed

## Goal

Finish the survey: the live drift was found and fixed, and **two couplings remain untyped** - the verdict a decision record carries,
and the axis isolation set that would silently stop matching if a label were renamed.

## Background: the survey, measured

After the previous round removed the eleventh label, the string literals written through the untyped channels were measured:

| Channel | Literals found | Verdict |
|---|---|---|
| `gate` on a refusal | `ask`, `deny`, `effect-claim` | all in the vocabulary, and the channel **cannot** be typed as one label |
| `verdict` on a decision | `confirmed`, `contradicted`, `pending`, `unobserved` | all valid, and the channel is `string` |

**So there is no live drift left, and two latent ones.** The first is cheap to close: `appendChangeDecided` takes
`verdict: string` while its only producer returns a typed union, so the channel is wider than the value it carries.

**The second is the one worth finding**: the axis keeps `ISOLATION_CONTROLS` as a `ReadonlySet<string>` holding `sandbox` and
`fence`. Its own test asserts those two literally, so if a label in the vocabulary were renamed the axis would **silently stop
counting it as an isolation refusal** - the reading would keep printing a number, and the number would be wrong.

## Requirements

- **R1 - The decision channel is typed**: `appendChangeDecided` takes the verdict union, so a caller cannot write a verdict
  outside it. A reader of an old record still tolerates whatever is on disk, which is why the *reader* stays a string.
- **R2 - The isolation set is typed against the vocabulary**, so a rename breaks the axis at the point where it would
  otherwise go quietly wrong.
- **R3 - The one channel that must stay untyped says so**: a refusal gate may be a **composite** (`deny+scope+registered+ask`
  is a legal ledger value, and the reader splits it), so typing it as one label would be wrong. The contract states that, and
  states what the typecheck therefore does not cover: a typo in a computed label.
- **R4 - The survey itself is recorded where the vocabulary is documented**, in the one place that already lists the labels -
  so the next person asking the same question starts from the answer rather than from the search.

## Acceptance Criteria

- [ ] **AC1** `appendChangeDecided` takes the verdict union, and the adapter passes what it has without a cast.
- [ ] **AC2** The axis isolation set is typed against the vocabulary, and a scratch rename of a label in the vocabulary fails
      `npm run typecheck` (checked by making the edit, running the typecheck, and reverting it).
- [ ] **AC3** The contract states the composite channel, why it stays a string, and what neither check covers.
- [ ] **AC4** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.

## Out of scope

- **Typing every string in the ledger**: the survey measured the ones that carry a vocabulary, and the rest are free text.
- **A template-literal type for composites**, which would need a recursive type to cover a composite of any length and would
  buy a check the reader already performs by splitting.
- **The mode files vocabularies**, whose loader refusals are their own check.
