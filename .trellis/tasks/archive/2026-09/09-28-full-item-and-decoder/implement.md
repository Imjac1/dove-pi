# Implementation plan: the full item and the decoder

## Ordered checklist

- [x] **1. The item, in full.**
- [x] **2. The decoder, by what src exports.**
- [x] **3. The tests, searched for that name.**
- [x] **4. The gate.**

## The item in full: 264 characters, five claims, and two of them never read

```text
"... Auto makes zero setActiveTools calls, doctor reports schema drift without reverting it,
 and doctor exposes the same terminal/resource projection as diagnostics/status."
```

**For three rounds this item was carried with its last two claims unread**, because a 190-character read cut it at *doc*. That is the
failure this session keeps naming - a partial view read as the whole - and it happened to the thing I was using to check other things.

**The two claims are worth having found.** The fourth is safety-shaped: *doctor reports schema drift without reverting it*, which is the same
shape as the status suite case found last round, a report that is not a change. **The fifth is exactly what an earlier round audited**:
`agent_doctor` and the CLI doctor sharing the `requestDiagnostics` projection, which that round held. So the fifth claim is held by work
already done, and the fourth is not checked here.

## The decoder question, asked the right way round

**No `decode*` function in `src` is about an extension identity** - `core/task-convergence.ts` has seven and they are about convergence, and
`context-snapshot.ts` decodes a restored snapshot. **The identity lives on the Python side**, in the installer:

```text
installer/release.py:125,134,138   "release.json has an invalid Dove extension identity" / "is incomplete"
installer/manager.py:75-76         sha256 over tag, version and identity - the identity digest
installer/manager.py:153           "identity digest; leave it unknown instead of inventing a divergent ..."
```

## The cluster, split three ways

```text
strict validation of a release identity   HELD      release_installer_test.py:113 and :168
additive identity decoding                not established - what "additive" means here was not found
the legacy unknown fallback               the code has it at manager.py:153, and no test names it
```

**The third line is a lead, not a conclusion.** The only `unknown` in `managed_installer_test.py` is about unknown root files on uninstall,
which is a different unknown - and *no test names it* is precisely the reading that has been wrong six times this session.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **Further word-searches.**
2. **The first real turn.**