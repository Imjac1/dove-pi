# Implementation plan: the other specifications lists

## Ordered checklist

- [x] **1. Every list**, read.
- [x] **2. The three safety-shaped ones.**
- [x] **3. Holders by owning file.**
- [x] **4. The gate.**

## The most security-shaped list is fully held, much of it verbatim

```text
zip-slip is rejected                     managed_installer_test.py:1086  test_safe_extract_rejects_zip_slip
checksum rejection                       managed_installer_test.py:1068  test_checksum_failure_keeps_current_release
corrupt state blocks without pruning     managed_installer_test.py:473   test_corrupt_state_blocks_update_without_pruning_releases
only one process owns the lock           managed_installer_test.py:250   test_separate_process_cannot_take_live_lock
no interleaving between activation and persistence   managed_installer_test.py:607  reconciles_components_under_lock
same-version update downloads nothing    managed_installer_test.py:895   test_same_version_update_does_not_download_or_run_npm
```

**And it holds more than the list asks**: a sibling-prefix path boundary at `:101`, and duplicate and link entries in the same archive at
`:1096`. Fifty cases in that file, and the eight items are not a strain on it.

## The convergence list: one item held strongly, one pointed elsewhere

**The replay item is held the way a list would hope**: `task-convergence.test.ts:45` is parameterised over the shared traces in
`fixtures/task-convergence-traces.json`, asserting the expected state after every event - so every shared trace, incrementally, by
construction. **Two of its other items point outside that suite**: the fail-closed one names the *Pi tool boundary*, and a search for it
there found nothing.

## The audit vertical list was read and not checked

**Six items about receipt integrity** - a broken regex, an unknown field, an empty category and a missing prefix rejected; seeds found in a
vulnerable fixture and none in a clean one; every mandatory family counted including at zero; the five ways a receipt fails; and dropping a
seed changes the digest. **Read, named, not checked.**

## My patterns failed three more times

```text
"lock"    matched "blocked"      the substring, in 282 results
"lease"   matched "release"      329 results, because release contains lease
"tests/convergence"              a directory I assumed, which does not exist
```

**That is the sixth time this session has read a pattern miss as an absence.** The counts a search returns are candidate lists; the answer
comes from the file that owns the behaviour, and this round found it twice by asking the *file list* instead of the pattern.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The other ten lists.**
2. **The first real turn.**