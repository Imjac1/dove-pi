# Implementation plan: the second extension-runtime list

## Ordered checklist

- [x] **1. The claims**, split out.
- [x] **2. The file list.**
- [x] **3. Each claim held or named.**
- [x] **4. The gate.**

## The list, split into claims, and where each one landed

```text
path canonicalization                        extension-identity.test.ts:11   "without treating wrapper text as identity"
version and digest drift                     extension-identity.test.ts:22   "in-sync, version drift, and same-version divergence"
selection precedence, stale-claim replacement  extension-identity.test.ts:34
equality across Windows slash/case aliases   extension-identity.test.ts:11   the same case
managed -e is unconditional                  extension-identity.test.ts:27   "keeps managed authority unless ..."
an explicit override fails closed            extension-identity.test.ts:27   the unless-branch is the fail-closed one
unrelated plugins remain untouched           extensions.test.ts:247          "does not touch unrelated user packages"   verbatim
additive decoding / strict validation / legacy unknown   PARTLY
```

**One cluster is not located and is named as such**: *strict validation* is held - `release_installer_test.py:113`, a release identity must
include the advertised version, and `:168`, an archive id must match the direct manifest identity - but **additive identity decoding and the
legacy `unknown` behaviour were not found**. The list itself says they live in *release/readiness/status tests*, and two of those suites were
searched.

## The surprise: the list I deferred is held too

**This round set the first list aside and it turned out to be held by the same two files**, so reporting it as deferred would have been
wrong in the direction of understating the suite:

```text
settings before the single TUI renderer, and no default profile with another authority   extensions.test.ts:32, :90, :57
missing packages warn without network calls                                              extensions.test.ts:39   verbatim
invalid load order and conflicting max authorities are detected                          extensions.test.ts:85, :69
```

**The fourth item of that list - goal continuations aggregating once, cache evidence per turn, Auto making no tool calls - points at
`pi-adapter.test.ts`**, which holds continuation kinds and is not checked here.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The first list.**
2. **The first real turn.**