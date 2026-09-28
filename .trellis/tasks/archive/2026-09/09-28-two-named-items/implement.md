# Implementation plan: the two named items

## Ordered checklist

- [x] **1. Both file lists.**
- [x] **2. The four-claim item.**
- [x] **3. The identity cluster.**
- [x] **4. The gate.**

## The continuation item, held in the assertions themselves

```text
"goal continuations aggregate once"       pi-adapter.test.ts:303   assert.equal(activeToolSets.length, consecutiveChatCount,
                                                                  "natural-language continuation must not churn the ...")
"the continuation kinds"                  pi-adapter.test.ts:305   the message matches current|selected|single_candidate|ambiguous|none
"and it does not tell the agent to read the status tool"   pi-adapter.test.ts:306   assert.doesNotMatch(..., /Read agent_project_status/)
```

**A four-claim line, and three of its claims are held by three assertions in one case.** The fourth - the doctor projection - is not
checked here and is named as such.

## The identity cluster, not located, with every search listed

```text
extension-identity.test.ts            4 cases    the identity suite, and the cluster is not in it
release-manifest.test.ts              3 cases    paths and the list itself
release_readiness_installer_test.py   9 cases    all bundle integrity: tag, commit, checksum, asset set, archive entries, workflow order
release_installer_test.py             2 identity cases - strict validation, which is held, and not this cluster
managed-install-status.test.ts        1 case     reports degradation without mutating it
"additive" across all tests           3 hits     policy and ledger records, not identity decoding
"legacy" across all tests            66 hits     install profiles and cache policy
```

**Not located, which is not the same as unheld.** A cluster whose holder I could not find, after six suites and two phrases, is a cluster I
could not place - and six of my searches this session have been wrong for pattern reasons, so the honest entry is the list above rather than
a claim that nothing holds it.

## A bonus the list did not ask for

`managed-install-status.test.ts:9` - *"reports managed extension degradation from local state **without mutating it**"* - a safety-shaped
claim about a *report* not being a *change*, in the suite the file list surfaced because this round searched for "status" rather than for
"release".

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The other lists.**
2. **The first real turn.**