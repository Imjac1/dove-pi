# Implementation plan: the corpus summary

## Ordered checklist

- [x] **1. The file list.**
- [x] **2. The summary function.**
- [x] **3. The four items.**
- [x] **4. The gate.**

## The sharpest item has its own case, named after it

```text
harness-corpus.test.ts:41   classifies terminals with the axis rule, and reports the failures as failure records
harness-corpus.test.ts:48   splits a composite refusal label and counts one with no request id as unrefused
harness-corpus.test.ts:56   says why a corpus with no failure has none, instead of only saying zero
harness-corpus.test.ts:65   does not say it when the corpus holds a failure      <- the negative claim, as its own case
harness-corpus.test.ts:71   says nothing to read when there is nothing at all
```

**The owner is `src/core/harness-corpus.ts`, and the sentence is a named constant**: `EMPTY_FAILURE_NOTE`, above a function documented as
*"What this corpus does **not** contain, and - where it is known - why it does not."* The negative claim is not an absence of behaviour; it is
a constant with a case that proves the constant is not printed when it should not be.

## The surface item, split into what is held and what is not

```text
the map resolves against the real tree       HELD   harness-surface.test.ts:33, and twelve more about naming what does not resolve
the three answers of the check               NOT located as such - inside, outside with offenders named, unresolved
                                             harness-readings.test.ts has a comment naming a fourth answer, so the verdicts live there
```

**Thirteen cases hold the map and its refusals, and they are not the item**: the item is about the *check own three answers*. The reading suite
is where those live, and only a comment was found there, so this half is named rather than claimed.

## The client-account item is not located

**One hit, and it is a comment.** The item - a client account lands only on the failure whose request it names, and leaves the other failures
in the same ledger alone - was searched for by *client*, *account*, *lands* and *only its*, and no case names it. **Named, not concluded.**

## And the round paid a small toll to the same class of error

**The check context named `src/core/harness-readings.ts`, and there is no such module** - `harness-readings.test.ts` exists and the modules are
`harness-corpus`, `harness-axes`, `harness-round`, `harness-surface` and `harness-verifier`. **The workflow refused an empty `check.jsonl`**
again, which is the guard catching an assumed name for the second time.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The request-runtime lists.**
2. **The first real turn.**