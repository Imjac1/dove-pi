# Implementation plan: the two promises

## Ordered checklist

- [x] **1. Both rows in full.**
- [x] **2. The implementation, by behaviour.**
- [x] **3. What holds each.**
- [x] **4. The method, then the gate.**

## Both answered, and both were already held

```text
promise                                              implementation                        holder
122 duplicate project authorities                    context/interoperable.ts conflicts    tests/interoperable-context.test.ts:25
                                                     built at :49 and :63, projected in
                                                     cli.ts:95 and adapters/mcp.ts:45
123 evidence naming credential material              isSensitiveProjectPath                tests/context.test.ts:251
                                                     trellis-adapter/index.ts:55, used at
                                                     :45, :50 (it throws), :71, interoperable.ts:111
```

**Neither is unheld and neither was a lead.** The previous round was right to refuse the stronger claim on two failed searches, and this one
answered the lead it recorded.

## The method, which is the real product of the round

**The prose above the table is a dictionary.** The rows say *duplicate project authorities* and *credential/key material*; the paragraphs
above them say **`conflicts`** and **`.env*`, credential/secret/token, private-key names, key extensions**. Searching for the document own
words found both implementations in one call each.

**The previous round searched for names I invented** - `excludeCredential`, `isCredential`, `key material`, `credentialMaterial` - and every
one of them does not exist, which is why two rounds of searching found nothing and one of reading found everything.

**The correction this makes to the previous record**: it called the two rows *leads rather than findings*, and that was already too weak -
both are implemented and both are held. The caution was right; the wording understated what was there.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **Adding the missing behaviour.**
2. **The first real turn.**