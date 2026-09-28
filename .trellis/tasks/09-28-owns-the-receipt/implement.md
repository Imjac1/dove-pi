# Implementation plan: who owns the receipt

## Ordered checklist

- [x] **1. The file list**, asked first.
- [x] **2. The six items.**
- [x] **3. Holders where warranted.**
- [x] **4. The gate.**

## The file list, asked first, found the owner immediately

```text
the eight candidates: cache-audit, code-audit-claim, code-audit-derive, code-audit-mode,
code-audit-seed, code-audit-vertical, token-audit, fixtures/representative-tool-catalog.ts
the owner: code-audit-seed.test.ts - and this time the name does match the behaviour
```

**Asking the file list cost one command and named the owner.** The last two rounds each spent a search first, and both searches were wrong
for a reason that the file list would have shown: `lock` is inside `blocked`, `lease` inside `release`, and there is no `convergence`
directory.

## All six items, held, most of them verbatim

```text
the catalog loads; a broken regex, unknown field, empty category,
  missing prefix each rejected        :17, :24, :33   four cases, one per fault
seeds in the vulnerable fixture, none in the clean one, suffixes applied   :41, :61   verbatim
every mandatory family has a count, including zero                        :47   "including the ones at zero"
two runs agree on every seed and on the digest                            :67   "byte-stable ... on every seed and on the digest"
a missing family, an extra family, a version mismatch, a missing hash,
  a missing count each fail the receipt                  :145, :153, :160, :167   five cases, one per way
dropping a seed changes the digest                                        :193   "a seed digest that binds it to the seeds it describes"
```

## And it holds more than the list asks

`:55` a hit is keyed by family, file and line so one line yields at most one seed per family; `:75` it refuses to scan with no source root;
`:107` it matches both the plain and the suffixed form; and `:178` **treats an unreadable file as a gap, and a gap blocks a clean claim** -
which is the safety-shaped one, and it is not on the list at all.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The remaining lists.**
2. **The first real turn.**