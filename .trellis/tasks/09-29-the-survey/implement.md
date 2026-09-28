# Implementation plan: the survey

## Ordered checklist

- [x] **1. Run get_context.py --mode record.**
- [x] **2. Archive the three whose work finished.**
- [x] **3. Leave the one whose criteria are unchecked.**
- [x] **4. Record the one the survey filters.**

## Validation commands

```powershell
python ./.trellis/scripts/get_context.py --mode record
npm test
```

## Next round, precisely

```text
the task      08-28-dove-pi-usage-review, open on disk, absent from the survey
its plan      twenty-three unchecked boxes across P0 to P3
each box      either done - P0 and the wiring - or measured as already existing - P1, P2, P3
the work      check each one *and say which it is*, rather than ticking a list
```
