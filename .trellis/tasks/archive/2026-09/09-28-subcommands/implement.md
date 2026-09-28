# Implementation plan: the subcommands

## Ordered checklist

- [x] **1. The documented subcommands**: from the usage strings and the READMEs.
- [x] **2. The handled subcommands**: read from the dispatch.
- [x] **3. The comparison, both directions.**
- [x] **4. Fix or record, then the gate.**

## The measurement

```text
parent     named in a usage string                          handled
project    init, doctor, bind native, update                4 of 4
task       list, current, status, continue, verify,         10 of 10
           convergence, create, start, finish, archive
shell      status, set, reset                               3 of 3
web        status, auth                                     2 of 2
workspace  status, set                                      2 of 2
session    list, record                                     2 of 2
capability run                                              1 of 1
token      audit                                            1 of 1
cache      audit                                            1 of 1
```

**Clean, and the READMEs name subsets of these** - nine of the ten task subcommands, three of them in the help - which is what a way in
is allowed to be. That reading is the same one a previous round gave the switch list, and it is why the checks in this file are
one-directional.

**No check was added.** The usage strings are prose in the same files as the dispatch, so a textual comparison would be a pattern
pretending to be a claim - the class this session has met five times. The measurement is recorded where the surface is already documented
layer by layer instead.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
```

## Recorded, not built

1. **Pi own subcommands**, which Dove passes through.
2. **The first real turn**, which needs a Pi host.