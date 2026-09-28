# Implementation plan: the ten modules nothing reaches

## Ordered checklist

- [x] **1. List the register with sizes and reasons.**
- [x] **2. Check the references where the entries looked transitive.**
- [x] **3. Correct the two entries whose wording had gone stale.**
- [x] **4. The gate.**

## Validation commands

```powershell
npx tsx --test tests/harness-reachability.test.ts
npm test
```

## What would make an entry removable

```text
a consumer on an entry-point path   the definition of done the check states
a deletion                          for code nothing wants, which is a decision rather than a cleanup -
                                    and the two pre-existing entries are candidates a person should judge
```
