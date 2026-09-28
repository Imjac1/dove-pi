# Implementation plan: the environment variables

## Ordered checklist

- [x] **1. The documented variables**, from both READMEs and the help.
- [x] **2. The read variables**, from `src` and the Python side.
- [x] **3. The comparison, both directions.**
- [x] **4. Fix or record, then the gate.**

## The measurement

```text
read by the code:        27 DOVE_PI_ variables
set by the launcher:      7  (DOVE_PI_EXTENSION_* four, DOVE_PI_FRAMEWORK_VERSION, DOVE_PI_WORKSPACE_MODE and _OVERRIDE)
named in a document:      4  (DOVE_PI_SUBAGENT_EXECUTABLE, DOVE_PI_SUBAGENT_PREFIX_ARGS, DOVE_PI_HOME, DOVE_PI_SHELL_TIMEOUT_SECONDS)
named nowhere:           16  including the prefix fuse off switch, the context budget pair and the state directory
```

**No dead knobs**: all four documented variables are read. **And sixteen read variables were named nowhere**, several of them plainly for a
user - a knob a user cannot find is a knob that does nothing, and its failure is quiet, because the shell accepts the setting and the tool
behaves as if it were absent.

## What was built, and the check that had to be rewritten

The help names them in two classes: the ones a user may set, and the ones the launcher overwrites for the extension it starts. A check
asserts that every variable the help names is one the code reads.

**That check failed its own control twice, the same way both times.** The help text lives inside `dove_pi.py`, so searching that file
found a planted name in the very block that names it. The Python side is parsed with `ast` now, which sees reads rather than text - and the
control passes only in the state where the planted name makes it fail.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
```

## Recorded, not built

1. **Variables Pi owns**, which Dove passes through.
2. **The first real turn**, which needs a Pi host.