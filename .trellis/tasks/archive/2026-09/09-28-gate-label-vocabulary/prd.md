# One vocabulary for the refusal labels

## Goal

Make the refusal-label vocabulary **one typed thing**, so a producer cannot invent a label without a compile error, and check
the one list that is not a producer against it.

## Background: the coupling, measured

`GATE_LABELS` (`task-convergence.ts:870`) is the closed set a manifest prediction is validated against: a `gate-refusals`
prediction naming a subject outside it is **refused** (`:963`). So a label that a producer writes and the set does not carry
means **a refusal class nobody can predict** - and the producers share no type with the set:

| Producer | What it writes | Typed against the set? |
|---|---|---|
| the policy gate list (`action-policy.ts:327`) | `deny`, `scope`, `registered`, the limit and conformance gate ids, `ask` - **six** of the ten | no |
| the policy refusals (`labelled(..., "technique")` at `:440`, and the sandbox and fence checks) | `technique`, `sandbox`, `fence` | no |
| the effect boundary (`extension.ts:2701`) | `effect-claim` | no |

And the ten were counted **by hand** in an earlier round, which is how the drift was found rather than how it was prevented.

## Requirements

- **R1 - One source for the vocabulary.** The names become a `readonly` tuple, the `GateLabel` union is derived from it, and
  `GATE_LABELS` is built from the same tuple - so the union and the set cannot disagree, and the set keeps its existing
  callers unchanged.
- **R2 - The producers are typed against it.** The policy gate list, the label the policy refusals pass, and the effect
  boundary label are typed as `GateLabel`, so **a producer that invents a label fails the typecheck** rather than failing a
  prediction later.
- **R3 - The list that is not a producer is checked at runtime.** The policy gate list is a subset of the vocabulary, and
  that is asserted by building a policy and comparing - the one direction a type cannot cover, because the list is data.
- **R4 - What is covered by neither is stated.** A label in the vocabulary that no producer writes is caught by **no** check
  here: the type rejects new labels, not unused ones, and a text scan for the strings is the weak form this repository already
  withdrew once. The contract says so instead of implying coverage.
- **R5 - The vocabulary does not change.** The ten labels stay the ten labels; this is about who checks them.

## Acceptance Criteria

- [ ] **AC1** The tuple, the union and the set come from one declaration, and the set still contains the same ten names.
- [ ] **AC2** The three producer sites are typed `GateLabel`, and a scratch label outside the union fails `npm run typecheck`
      (checked by making the edit, running the typecheck, and reverting it).
- [ ] **AC3** A test builds a policy and asserts its gate list is a subset of the vocabulary.
- [ ] **AC4** The loop contract records the coupling, both checked directions, and the one that is not checked.
- [ ] **AC5** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.

## Out of scope

- **Adding a label**, or removing one: the vocabulary is a contract with the manifest.
- **A text scan for unused labels**, for R4 reasons.
- **Type-checking the vocabulary in the mode files** (`fence`, `sandbox` declarations): that is a different vocabulary with
  its own drift test.
