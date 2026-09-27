# Implementation plan: the bootstrap leftover

## Ordered checklist

- [x] **1. Both indexes**: drop the How to Fill These Guidelines section, keep the table and the language line.
- [x] **2. The check**: name the skill line the rule comes from.
- [x] **3. The gate**, and the index check still passing.

## What the measurement settled

```text
files containing the boilerplate phrase      2   (both index.md; no template, no script, no registry)
local Trellis scripts                        6   (none writes a specification)
content guidelines spot-checked              3   (all project-specific: single-package TypeScript, no database or ORM, errors across boundaries)
and the rule the test enforces came from     .agents/skills/trellis-spec-bootstrap/SKILL.md, checklist line 40
```

**The reason a previous round left the text alone was wrong.** It said a tool update may rewrite it; the footer on the managed block
says the *block* may be overwritten, and these files are project content. Nothing in this repository regenerates them.

**And the rule was never mine**: the bootstrap skill already required an index to match its file set, in one checklist line, and it
was not being kept - the backend index was missing three specifications, the harness loop among them.

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/document-drift.test.ts
```

## Recorded, not built

1. **The skill own text**, which is tool content.
2. **The first real turn**, which needs a Pi host.