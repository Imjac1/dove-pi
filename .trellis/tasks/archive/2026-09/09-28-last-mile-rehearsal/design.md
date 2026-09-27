# Design: a real commit, two surfaces, one reading

## Why the root commit

```text
git rev-list --max-parents=0 HEAD   ->  resolvable in any clone, shallow or fresh
it touches .agents/skills           ->  the skill component, by the declaration
and not src/ or tests/              ->  so a tool-implementation change reads outside, with files named
```

**A hard-coded sha would pass here and be wrong in a clone with a different history**; the root commit is the one commit every clone
has. **And one commit giving both answers** is what makes the test worth writing: the same edit is inside one surface and outside
another, which is the property the declaration was built for and the guide describes.

## What the fixture supplies, and what it takes from the repository

```text
from the fixture:   the workspace, the convergence record, the ledger with the applied and decided records
from this repo:     the commit, and git itself
```

**The reading resolves the commit in the harness root**, so a temp workspace can name a commit of the real repository - which is the
arrangement that let the chain be checked by hand in earlier rounds, now written down as a test.

## The guide addition

```text
bring back: the ledger and the convergence record
why:        they are what let the run be read afterwards, and the mining step reads them
```

**Short, because it is the last thing in the procedure and a reader is tired by then.** Two artifacts, one reason.
