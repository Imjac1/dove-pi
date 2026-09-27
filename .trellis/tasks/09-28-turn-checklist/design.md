# Design: a guide, not a gate

## Shape

```
.trellis/spec/guides/harness-loop-turn.md
  prerequisites (with how to check each)
  the seven steps, each with: the command or tool call, the exact fields, the reading to expect
  the two boundaries, at the step where they are acted on
  what to do when a step does not produce its reading
```

**Why a guide and not a specification.** A routed specification is a contract the harness enforces and the budget test
measures; this is instructions for a person, with judgments the guide deliberately keeps visible. It also has no size budget,
which matters because a checklist that must be compressed is a checklist that loses its fields.

## What makes it verifiable

- **Fields are quoted from the schema**, and the guide says so where it matters ("the schema spells this `predictedFixes`,")
  so a reader knows which parts are checked and which are advice.
- **Commands are the scripts own usage lines**, and the guide names the script each one comes from.
- **Two of the readings can be run in this repository** even though the turn cannot: the corpus and the failure readings work
  against ledgers under the temporary directory, and the guide shows them so a person can see the instruments answering
  before the turn they belong to exists.

## Verification

- **Against the schema**: every operation and field named in the guide is grepped for, and the guide is corrected where it
  drifted - the check that makes this different from a document written from memory.
- **Against the scripts**: every invocation is run where it can be, and the ones that need a turn are marked as such rather
  than left untested and unlabelled.
