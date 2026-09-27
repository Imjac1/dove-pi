# Prose does not count what the code declares

## Goal

Remove the counts that count an enumeration this repository declares, and put the reason in the guidelines - because a count
is the one part of a sentence that goes wrong silently.

## Background: the measurement, and its honest result

Thirty-three countable claims in prose across the specifications, the guide and the comments. Every one about a declared
enumeration was checked against the thing it counts:

| Claim | Declared | True? |
|---|---|---|
| "the four kinds of ending" (`harness-axes.ts`) | `TERMINAL_CLASSES` values | yes |
| "three observables" (three files) | `CHANGE_OBSERVABLES` | yes |
| "the seven components" (two files) | `.trellis/harness-surface.yaml` | yes |
| "the seven steps" (two files) | the guide own headings | yes |
| "ten operations" | the mapper union | yes |
| "the two readings" (`extension.ts`) | `verification` and `changes` | yes |

**Nothing is currently wrong**, and the last thing that was - "ten labels" - was the refusal vocabulary two rounds ago. So the
round is not a repair. It is the question of why the class produced that defect at all, and the answer is that a count in prose
is a **claim with no reader**: the sentence says three, the code says three, and nothing connects them.

## Requirements

- **R1 - A count over a declared enumeration goes away**, replaced by the name of the declaration or by the members
  themselves. "The three observables are X, Y and Z" is strictly worse than "the observables are X, Y and Z", because the
  second cannot be wrong about a number the reader can count.
- **R2 - The replacement is shorter wherever it can be.** The loop specification has 262 bytes of headroom, so a round that
  made it longer to protect a count would have spent the room it needs for the next contract.
- **R3 - Structural counts stay.** "One path may belong to two components" is not a count of an enumeration: it is a rule
  about the map, and deleting the number would delete the rule.
- **R4 - The convention is written where a writer reads it**, in the quality guidelines, **with its limit**: prose is not
  checkable, so this is a convention and not a control - and the round says which it is.
- **R5 - Nothing else changes.** No count that the measurement found true is "fixed"; only the ones that count a declaration
  are reworded.

## Acceptance Criteria

- [ ] **AC1** The count is gone at each site that counts a declared enumeration, and the sentence still says what it said.
- [ ] **AC2** The loop specification is **not larger** after the round.
- [ ] **AC3** The guideline states the convention, the reason, and that it is not enforced by a check.
- [ ] **AC4** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.

## Out of scope

- **A check for prose counts**, which cannot exist.
- **The illustrative numbers** ("two halves", "three files"), which are about an argument rather than an enumeration.
- **Retyping the enumeration into the prose as a list** where the sentence already names the members.
