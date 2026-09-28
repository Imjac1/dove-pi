# Implementation plan: reading the interop layer

## Ordered checklist

- [x] **1. Read the plan and the PRD criteria.**
- [x] **2. Measure the claims with the code own names.**
- [x] **3. Name the gap.**
- [ ] **4. Close it: item 14, the bilingual README sections.**

## Validation commands

```powershell
npm test
```

## Next round, precisely

```text
the gap       item 14: Chinese and English README sections with the adapter and plugin-reuse model
             plus integration examples. Both files mention MCP and neither mentions adapters.
the constraint tests/document-drift.test.ts holds the two READMEs against each other, so the edit has to
             keep them parallel - which is why it is its own round rather than a tail-end addition
the task      08-27-dove-interop-layer stays open until that lands
```
