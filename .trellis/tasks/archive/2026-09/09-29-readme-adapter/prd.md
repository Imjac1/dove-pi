# The bilingual README sections

## Goal

Item 14 of the interop P1: the Chinese and English README sections carrying the adapter and plugin-reuse model.

## Background: the rule was read before either file was touched

`tests/document-drift.test.ts` holds the two front doors together, and **it compares shape rather than meaning**:

```text
headings   (text.match(/^#{2,3} .*/gm) ?? []).length
fences     (text.match(/```/g) ?? []).length
tableRows  (text.match(/^\|/gm) ?? []).length
```

**And there is no byte rule.** The comment above it records that the files were once measured at a five percent
byte difference, which is history rather than a constraint - **worth reading, because assuming a budget there
would have been the round first mistake.**

## What was written

```text
before   README.md      {headings: 31, fences: 66, tableRows: 14}
         README.en.md   {headings: 31, fences: 66, tableRows: 14}

after    README.md      {headings: 32, fences: 68, tableRows: 19}
         README.en.md   {headings: 32, fences: 68, tableRows: 19}
         drift: []
```

**One section each, in the words the PRD already uses**: one reviewed capability exposed through the Pi adapter
first and then through MCP and CLI/RPC, with a single copy of the execution logic; and a reviewed Pi plugin
package projected into observable host capabilities without registering a second Core executor. **A table names
the three adapters and the correlation ids each records, and the fenced block runs the two commands that show an
adapter is healthy.**

**The shape was checked with the rule the test uses rather than by eye**, and the counts match exactly, which is
what the drift check requires.

## Acceptance criteria

- [x] **AC1** The drift rule was read before editing either file.
- [x] **AC2** Both files carry a section on the adapter and plugin-reuse model.
- [x] **AC3** The three shape counts match, verified with the test own rule.
- [x] **AC4** The gate passes.