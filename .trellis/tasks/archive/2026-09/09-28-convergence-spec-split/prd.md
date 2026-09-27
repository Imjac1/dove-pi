# The convergence contract gets its own specification

## Goal

Give the records specification its room back by moving out the block that does not belong there - which fixes a structural
mistake at the same time.

## Background: the measurement, and what it shows about the shape

The records specification is at **24,245 of 24,576 bytes**. Measuring it section by section shows why:

| Lines | Bytes | Heading |
|---|---|---|
| 8-204 | 10,588 | the numbered sections the specification is built from (`## 1.` through `## 8.`) |
| 205-392 | **13,657** | `### Formal Task Convergence State` and its own `### 1.` through `### 7.` |

**Two things are wrong with that block, and the second is the interesting one.** It is 13.7 KB of a different subject inside
a specification about native state, legacy compatibility and context - and it is a **scenario written at `###` level, after
`## 8. Tests Required`**, so the document says that the convergence scenario is a subsection of the tests section. The
specifications written since have the shape `## Scenario: ...` with `### 1.` under it, and this block is that shape one level
too deep.

## Requirements

- **R1 - The block moves out whole**, from its heading to the end of the file, into a routed specification of its own, and
  becomes `## Scenario: Formal Task Convergence State` with its subsections unchanged beneath it.
- **R2 - Both files end up well inside their caps**, with the moved file carrying the contracts that are about records: the
  convergence contract, the observation, the manifest, the terminal classification, the decisions and the applied commit.
- **R3 - The router and the budget test are updated together**: a link and a selection rule, the new name in the routed list
  in link order, and its second-level headings declared. A specification nobody routes to is a file, not a contract.
- **R4 - Nothing is rewritten in the move.** The block is relocated verbatim apart from its top heading level, and the one
  sentence in it that says where something lives is checked rather than assumed.
- **R5 - The move is by range with asserted boundaries**, and the continuation check that caught the last split orphan is
  applied again - a block that ends mid-bullet is a moved defect, not a moved contract.

## Acceptance Criteria

- [ ] **AC1** The new specification holds the block under `## Scenario: Formal Task Convergence State`, and the records
      specification no longer contains it or any fragment of it.
- [ ] **AC2** The records specification keeps its eight numbered sections and its own tests and error matrix, and both
      files are under 16 KiB with the new one under 20 KiB.
- [ ] **AC3** The router links the new specification, its selection rule says when to read it, and the budget test lists it
      in link order with its heading - and passes.
- [ ] **AC4** In the moved text, every cross-reference still names a file that exists, and the sentence about where the
      failure reading lives is either still true or corrected.
- [ ] **AC5** `npm run typecheck`, `npm test`, `npm run test:installer` and `npm run doctor` pass.

## Out of scope

- **Splitting further.** If the new file is comfortable and the old one is comfortable, the subject boundary is where it
   should be; a third specification is a decision for when one of them is full again.
- **Rewriting the moved contract.** It is a relocation. Any prose that is wrong is a separate finding.
- **The Pi-hosted turn**, unchanged.
