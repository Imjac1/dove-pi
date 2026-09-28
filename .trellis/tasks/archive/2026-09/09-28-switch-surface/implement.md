# Implementation plan: the switch surface

## Ordered checklist

- [x] **1. The documented flags**: from the help and both READMEs.
- [x] **2. The accepted flags**: from argparse and the manual handling.
- [x] **3. The comparison, both directions.**
- [x] **4. Fix what is wrong, then the gate.**

## The measurement, and the two artifacts that preceded it

```text
flags the help names:      18
flags the READMEs name:    23
flags accepted nowhere:    none   (the four that looked like it belong to scripts/real-dove-blackbox.mjs)
flags accepted but undocumented:  none that are Dove own   (winget flags and argparse own --help were in the first count)
```

**The first extraction reported eleven flags accepted nowhere and sixteen accepted but undocumented.** Both directions were artifacts of
the extraction, not facts about the code:

| Artifact | Cause |
|---|---|
| eleven flags "accepted nowhere" | a regex that lost its escaping inside the program that generated it |
| four of those, again | a parser set of `src` plus `dove_pi.py` that left out `scripts/real-dove-blackbox.mjs`, which is where `--cwd`, `--prompt`, `--scenario` and `--launcher` live |
| sixteen "accepted but undocumented" | the same broken regex, plus winget own flags and argparse own `--help` |

**A probe was tried and rejected first**: asking `cmd --bogus --help` whether argparse refuses unknown arguments answers zero, because
`--help` short-circuits before the refusal. The honest probe was reading the parser and then grepping each documented flag with the grep
tool rather than a generated regex - **which is the lesson, not the finding**: the tool that cannot lose its escaping is the one to use.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
```

## Recorded, not built

1. **Pi own flags**, which Dove passes through.
2. **The first real turn**, which needs a Pi host.