# Implementation plan: the other barrels

## Ordered checklist

- [x] **1. The barrels**, and what they re-export.
- [x] **2. The importers.**
- [x] **3. The classification.**
- [x] **4. Remove or record, then the gate.**

## The measurement

```text
barrels in src:  2
  project-provider/index.ts   34 lines, 9 export-star, 5 importers
  trellis-adapter/index.ts   120 lines, declares its exports, 3 importers in src + 1 in tests
```

**Both are load-bearing.** Neither is an export wall without a consumer, and nothing was removed.

## Two counts of mine, both wrong, in opposite directions

The round before this one reported **fourteen importers** for the first barrel. That was a count of *mentions* - the hits included a test
using the path inside a type assertion - and the real number of import statements is **five**.

And this round own scanner reported **one importer** for the second barrel where there are **three**, because it built its pattern from the
**repository-relative** path while imports are written **relatively**: `src/trellis-adapter/index` can never match
`from "../trellis-adapter/index.ts"`.

## What that says about the method

**This repository already has a check that resolves imports properly.** The reachability test walks relative import edges forward from the
entry points and asserts that the set of modules nothing reaches is exactly an allow-list - and it is green. Two rounds ago I removed a
text-search check because it was a weaker duplicate of that one; since then I have hand-built three more scanners of the same kind, and both
of their errors this round are errors that a resolved graph would not make.

**The honest conclusion is about my method rather than the code**: when the question is what imports what, the tool that resolves imports
is the tool to use, and the one to write only when there is not one.

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **Barrels outside src.**
2. **The first real turn**, which needs a Pi host.