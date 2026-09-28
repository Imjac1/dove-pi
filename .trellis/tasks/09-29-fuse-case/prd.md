# The fuse case, written down and then written

## Goal

Give the fuse wiring a holder of its own, using everything the previous round established.

## Background: the previous round left the tree at HEAD and the plan on the table

It could not land the case. It did establish *why* the case has to be its own - the notices are one-shot per
`extension(api)` call, because the flags are closure state - and it wrote down the entry shape and the tool to
use. **This round used all of it.**

## What the case does

```text
1  a billed cold start    two messages six minutes apart, the second reading no cache
                          -> one notice, naming idle, which is the miss reason the entries carry
2  a grown prefix is not this reading business
                          every sample read its cache, so the ratio is 140300 of a 128000 window;
                          the guard raises its own hint and the fuse stays quiet
3  the control            an identical third turn reports nothing, because the flag is one-shot
```

**Step 2 is the one worth explaining.** The wiring reports `cold_start` only, because the guard already covers a
grown prefix - **and this session keeps recording the failure of building a second mechanism beside one that
works.** So the assertion is that *no fuse notice* appears, not that nothing does.

## And three measurements that replaced three guesses

```text
the fuse on the staged entries   inspectCacheDiagnostics(warm) -> promptTokens 140300, miss reason unset,
                                 fuse near_limit at ratio 1.096; and the cold pair -> idle, cold_start
                                 - measured by running it, because the case failing did not say which side was wrong

the wiring                       extension.ts:3133 requires fuse.state === "cold_start"
                                 - so near_limit not notifying is the design, and the *test* had the stages swapped

the indentation                  "interface FakeContext {" with no leading tab, not one
                                 - two edit attempts failed because the anchor was written from expectation,
                                   which is the ninth time this session has done that
```

## And two operational facts about the tools

**`tools.read` truncates twice over**: it returned 661 lines of a 1394-line file, and it truncates long lines
inside those. **And `tools.edit` matches against that truncated view**, so an anchor past the truncation point
cannot match however correct it is - which is what round 189 own refusal was. **Reading with an `offset` near the
target is the workaround, and measuring the exact whitespace with Node is the way to get an anchor right.**

## Acceptance criteria

- [x] **AC1** The case is its own, with its own `extension(api)`.
- [x] **AC2** A cold start is reported, and a grown prefix is left to the guard.
- [x] **AC3** A control holds the one-shot flag.
- [x] **AC4** The gate passes, and the adapter suite is one case longer.