# Implementation plan: the safety items

## Ordered checklist

- [x] **1. The seven items.**
- [x] **2. Each held against a test.**
- [x] **3. Holders where warranted.**
- [x] **4. The gate.**

## All seven, held, and most of them verbatim

```text
snapshot verification detects changed, missing and extra    windows-runtime.test.ts:30   "snapshots, detects drift, and restores files plus additions"
restore returns content and file set                         windows-runtime.test.ts:30   the same case
a failed patch rolls back what succeeded                     windows-runtime.test.ts:48   "rolls back a patch when an operation fails"          verbatim
path traversal and reserved snapshot paths are rejected      windows-runtime.test.ts:59   "rejects traversal and reserved snapshot paths"        verbatim
the registry exposes the fixed development names             development-capabilities.test.ts:17
dev.node_version through Fast Path, structured output        development-capabilities.test.ts:32   verbatim
non-zero, timeout and missing tool at the boundary           capability-protocol.test.ts:58 and bootstrap_installer_test.py:266
```

## The holder existed the whole time, under a name my pattern could not have matched

**I searched for a file named after the feature - `workspace`, `snapshot`, `transaction` - and there is no such test file.** The suite is
`windows-runtime.test.ts`, named after the *layer*, and it holds four of the seven items in an order that mirrors the list.

**That is the fifth time this session has read *no match for my pattern* as *no holder***, and the failure this time was a filename rather
than a phrase. **The counts it produces are candidates, and the conclusion needs the file that owns the behaviour, which is not always the
file named after it.**

## A second thing worth recording

**The first attempt to start this task failed**, because the check context named `src/core/workspace-transaction.ts` - a file I invented. The
workflow refused an empty `check.jsonl`, which is the guard doing its job on the same mistake in a different place: **the guess that costs
nothing when it is a search costs a refusal when it is a curation.**

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The twelve other specifications.**
2. **The first real turn.**