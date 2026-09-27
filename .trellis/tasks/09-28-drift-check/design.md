# Design: execute the names, do not read them

## The two executed checks

| Claim in a document | How it is checked |
|---|---|
| the declaration `embedded` symbols are verifier code in that file | the module is **imported** and each symbol asserted to be an exported function |
| the fields the guide lists are the fields the tool accepts | the **mapper is called** with exactly those fields and the operation it returns is asserted |

**Why not read the source.** A text scan checks what a pattern can match; the withdrawn behaviour map is the precedent for how that ends. Where a typed check is possible - and here both are - the test imports or calls, and the only text it reads is the declaration (through its own parser) and the guide (to confirm it quotes the scripts it claims to quote).

## What the test says it does not check

Its doc comment states two limits rather than leaving a reader to assume coverage:

- **`operation=applied` is not mapped.** The mapper union has ten operations and `applied` is not among them - the tool execute handles it first, which is where its refusals live and where the host tests exercise them. A drift test cannot call the mapper for it, so it does not pretend to.
- **The guide prose is not checked.** Which surface, what to predict, whether to keep or revert: the judgments the guide exists to leave visible.

**This is the honest edge of a drift check**: it keeps names true and says nothing about meaning, and a drift test that reads as complete would be worse than one that states where it stops.

## Verification

- **The test is the check**, and it fails on a rename: an embedded symbol that stops being exported, a field the mapper stops accepting, a script the guide quotes that stops existing.
- **It changes no document.** If it needs a document changed, the document and the code have drifted and the fix is one of them, not the test.
