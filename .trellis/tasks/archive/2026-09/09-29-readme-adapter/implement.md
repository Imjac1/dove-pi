# Implementation plan: the bilingual README sections

## Ordered checklist

- [x] **1. Read the drift rule.**
- [x] **2. Write one matching section in each file.**
- [x] **3. Verify the shape with the test own rule.**
- [x] **4. The gate.**

## Validation commands

```powershell
npx tsx --test tests/document-drift.test.ts
npm test
```

## What item 14 asked for, and where it now is

```text
"Update Chinese and English README sections with the adapter and plugin-reuse model plus integration examples"

README.md and README.en.md both end with a section naming the three adapters, the correlation ids each records,
and the two commands that report adapter health - in Chinese and in English, structurally identical.
```

## Recorded, not built

**The interop task stays open until this lands**, and its other thirteen items were measured present in the
previous round. **When this commits, `08-27-dove-interop-layer` has nothing left that was measured missing.**
