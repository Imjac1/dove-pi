# Implementation plan: the launcher no typechecker has read

## Ordered checklist

- [x] **1. Run the checker** over `bin/dove-pi.cjs` alone.
- [x] **2. Classify every report.**
- [x] **3. Fix what is real, or record that nothing is.**
- [x] **4. Prove it still runs**: `pi:smoke`.
- [x] **5. Record the include decision.**

## What the checker said, and what it turned out to be

```text
bin/dove-pi.cjs(92,43): error TS2339: Property 'PI_OFFLINE' does not exist on type '{ PI_SKIP_VERSION_CHECK: string; }'
... twelve more, all the same shape
```

**Thirteen reports, one artifact.** The spread in `{ ...process.env, PI_SKIP_VERSION_CHECK: "1" }` does not carry an index signature
into a JavaScript object literal inferred type, so every later assignment reads as a property that does not exist. Adding `--types node`
changed nothing, which ruled out the other explanation - a missing types package.

## Why reading them mattered

The shape of the error - an environment object whose type holds one key - pointed at a real defect worth ruling out: an env object built
from scratch would drop the parent environment, and a launched child would lose PATH and the rest. **The file spreads `process.env`**
(`:74`), so the child keeps it. **That is the whole value of running a checker over a file nobody had asked about**: it is not the errors
it prints, it is the question they made me ask.

## The decision

**The include stays as it is.** Putting the launcher in it would mean either a rewrite or annotations that exist to quiet a checker, and
what covers the launcher is execution: CI runs `npm run pi:smoke` for `--version` and `--help`. The reason now sits in `tsconfig.json`
beside the neighbouring decisions, so the next person does not re-run this experiment.

## Validation commands

```powershell
npx tsc --allowJs --checkJs --noEmit --target es2022 --module nodenext --moduleResolution nodenext bin/dove-pi.cjs
npm run pi:smoke
```

## Recorded, not built

1. **JavaScript checking project-wide**, which would flood the suite.
2. **The first real turn**, which needs a Pi host.