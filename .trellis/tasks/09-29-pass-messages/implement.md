# Implementation plan: passing the message count

## Ordered checklist

- [x] **1. Read the region the wiring goes in.**
- [x] **2. Check the local name is free.**
- [x] **3. Edit twice: the guard call and the fuse call.**
- [x] **4. The gate.**

## Validation commands

```powershell
npx tsx --test tests/pi-adapter.test.ts tests/context-guard.test.ts
npm test
```

## The next real step on this line

```text
what      a case whose handler sees a session past the turn cap
why       the cap is wired and unheld, and unlike the fuse notice it *can* be held: the count is an
          argument, so a case can supply a hundred and fifty-one entries and a small cap
where     tests/pi-adapter.test.ts, which already builds the handler and a fake context
```
