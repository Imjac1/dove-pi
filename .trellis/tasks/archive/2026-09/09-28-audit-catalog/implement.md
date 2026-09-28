# Implementation plan: the audit catalog

## Ordered checklist

- [x] **1. The catalog and its parser.**
- [x] **2. Whether a test parses the shipped one.**
- [x] **3. Validation, and what it claims.**
- [x] **4. Hold or record, then the gate.**

## The measurement: the shipped file is the one under test

```text
catalog:        modes/code-audit/catalog/typescript.json   schema_version 1, language typescript, 11 categories
product reads:  capabilities/code-audit.ts:57  DEFAULT_CATALOG = the same path
test parses:    tests/code-audit-seed.test.ts:9-13  the same path, with parseCatalog
asserts:        schemaVersion 1, language typescript, 11 categories, every family accounted for
```

**My premise was wrong**: I wrote that nothing watches the catalog, and the suite parses the shipped file - the same path the capability
reads - and asserts its shape. That is the reading a fixture-based test would not give, and it is the one that matters here.

## The count, and why this one is the good kind

The test asserts that there are **eleven categories**, which is exactly the thing the house rule calls a claim with no reader. **Here it has
one**: adding or removing a category fails the suite, so the number is a held fact rather than a sentence. That is worth noting beside the
rule, because the rule is about counts nobody checks, not about counts.

**Nothing was fixed and no check was added.** The catalog is parsed, validated and held, and a second check would be the weaker duplicate a
previous round taught this session to stop writing.

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **New patterns**, which is a review decision.
2. **The first real turn**, which needs a Pi host.