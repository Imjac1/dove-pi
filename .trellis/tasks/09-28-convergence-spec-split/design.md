# Design: the convergence record, as its own specification

## Where the line is

| Specification | Subject | After the split |
|---|---|---|
| `personal-agent-project-context.md` | native state, legacy compatibility, context and cache, diagnostics | 10,588 bytes, eight numbered sections |
| `personal-agent-convergence-record.md` (new) | the convergence contract and the records around it: criteria, findings, the observation, the manifest, the terminal classification, the decisions, the applied commit | about 13.9 KB |

**The name says what the file is about**, and the subject is already written as a scenario: the block has scope, signatures,
contracts, an error matrix, good/base/bad cases, tests and wrong-vs-correct - the shape the specifications written since use,
one heading level too deep.

## The move

- **Range**: from `### Formal Task Convergence State` to the end of the file. The tail of a file is the safest possible
  block to move: the end marker is the end of the file, and the only assertion needed is that the start is where it should
  be and that nothing before it belongs to it.
- **One line changes level**: the heading becomes `## Scenario: Formal Task Convergence State`, because in its own file it
  is the scenario rather than a subsection of a tests section. Everything under it keeps its level, so the document that
  results has the same shape as the loop specification.
- **The new file gets a short head** naming what it holds and where the surrounding state is documented, so a reader who
  arrives at it from the router knows what is not in it.

## The cross-references the move has to keep true

The moved text mentions other specifications (the failure reading lives in the loop specification, the request runtime
documents `request.terminal`). Those sentences are checked after the move: a relocated contract that points at a file which
no longer carries the thing is exactly how a document becomes a lie without anyone editing a false sentence.

## Verification and rollback

- **By measurement**: both files under their caps with real headroom, and the budget test - router, link order and headings
  - green.
- **By the same checks as the last two splits**: range extraction with asserted markers, and the continuation check that
  caught the orphan the first split produced.
- **Rollback** is a checkout of the touched files, plus deleting the new one.
