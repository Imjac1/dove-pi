# Implementation plan: the surface

## Ordered checklist

- [x] **1. Read harness-surface.yaml.**
- [x] **2. Map every path this span changed against its components.**
- [x] **3. Classify the ones outside rather than counting them.**
- [x] **4. The gate.**

## Validation commands

```powershell
npx tsx --test tests/harness-surface.test.ts
npm test
```

## What would be a finding rather than a category

```text
a stray edit   a changed path in a directory no component describes and no reason covers
none here      the thirteen are the READMEs, the launcher, the map, a Pi extension, and the scripts that
               consume the readings - each a category, and the map own comment covers them all
```
