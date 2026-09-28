# Implementation plan: the Python module graph

## Ordered checklist

- [x] **1. The graph**: every import in `installer`, `dove_pi.py`, `scripts`, `tests`.
- [x] **2. The entry points**, named by hand with reasons.
- [x] **3. What is left**, read one by one.
- [x] **4. Remove or record**, then the gate.

## The measurement

```text
python modules in installer/:  6
total candidates:              9
entry points excluded by hand: dove_pi.py, every scripts/*.py, every __init__.py
orphans:                       0
```

**Clean, like the TypeScript side.** So the round went to the refinement - modules named by tests and by nothing in the product - and that is
where it found something, though not what it was looking for: **seven modules are in that position, and one of them is a whole subsystem**
(`loop-runner`, `dispatcher`, `checkpoint`, two adapters, and two of this harness own readings).

## What that refinement actually found

**`tests/harness-reachability.test.ts` already asserts exactly this**, and more: it resolves import edges forward from the entry points
and holds the unreachable set to an allow-list **in both directions**, with a reason and a milestone per entry. Its own header names the
defect it was built for - twelve of thirty-five modules under `src/core` were loaded by nothing that runs.

**So the check I wrote two rounds ago was a weaker duplicate of it**, and the assertion I wrote this round was a third list for the same
claim. The text search reports a module as reached when another unreachable module names it; the resolved graph does not. **A second home
for one claim is how two lists come to disagree.**

`tests/module-graph.test.ts` is removed. The Python measurement stands as a measurement and does not get a check of its own, because the
lesson is not to build a weaker one.

## Validation commands

```powershell
python -m unittest discover -s tests -p "*installer*_test.py"
npm run typecheck
npm test
```

## Recorded, not built

1. **Unused functions inside live modules**, which this round does not measure.
2. **The first real turn**, which needs a Pi host.