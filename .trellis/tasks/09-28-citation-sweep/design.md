# Design: the sweep, and the one prohibition worth adding

## The rewrite rule

| Before | After | Why |
|---|---|---|
| `` `terminalForFailure` (`pi-adapter/extension.ts:565-573`) `` | `` `terminalForFailure` in `pi-adapter/extension.ts` `` | the symbol was already named; the range added nothing a reader cannot find |
| `` `deny` (`pi-adapter/extension.ts:2292`) `` | `` `deny` (`pi-adapter/extension.ts`) `` | and when it moved, the citation did not follow |
| `` `extension.ts:2377` falls back to `gates.join("+")` `` | `` the adapter falls back to `gates.join("+")` `` | a sentence can name the actor instead of the position |

**The last row is the one that improves the prose.** Several of these citations existed because the writer wanted to point at a
place rather than name the thing; deleting the position makes the sentence say who does it, which is what a reader needs.

## The check

A prohibition, in the file that already checks what documents name, because the failure mode is a pattern: a comment in
`src/` or `tests/` citing `<something>.ts:<digits>`. Two allowances, both stated in the code that enforces them:

- **`types.d.ts`** - the Pi host own type file, pinned by version, not ours to keep in sync,
- **`scripts/mode-behaviour-map.mts`** - the withdrawn map, whose citations are the finding that produced the withdrawal.

**What the check cannot do, said in its comment**: it forbids a pattern, so it cannot tell whether the file a citation names
is the right one. A prohibition is a floor, not a proof, and a check that reads as proof would be worse than none.

## Verification

- **The sweep is verified by the check**, and the check is verified by seeding a citation, watching it fail, and removing it.
- **The two repairs are verified by reading the cited symbol in the file now**, rather than by assuming the sweep found the
  right place: both are already named in the sentence that cites them.
