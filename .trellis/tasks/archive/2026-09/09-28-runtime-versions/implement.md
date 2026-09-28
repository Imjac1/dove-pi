# Implementation plan: the runtime versions

## Ordered checklist

- [x] **1. The statements**: manifest, workflows, bootstrap, READMEs.
- [x] **2. The enforcement**: read the check.
- [x] **3. The comparison.**
- [x] **4. Fix or record, then the gate.**

## The measurement: seven places, one answer

```text
package.json:11              engines.node ">=22.19.0"
the release manifest         runtime { python ">=3.10", node ">=22.19.0" }
installer/release.py:26      EXPECTED_RUNTIME, compared exactly
check_release_readiness:63   the same comparison, exact
install.ps1:367-368          [version]'3.10.0' and [version]'22.19.0'
dove_pi.py:180 / :63         sys.version_info < (3, 10) and MIN_NODE = (22, 19, 0)
both READMEs                  "Python 3.10+" and "Node.js 22.19+"
```

**They agree.** Two of the places compare the manifest exactly, so a drift there fails the readiness check and therefore a release.

## What was held and what was not

**The enforcer was held by nothing.** `MIN_NODE` is the comparison the launcher makes before it will run at all, and the manifest is a
declaration *about* it: if they disagree, a user is told one thing by the release and refused by the tool. The check asserts the enforcer
against the declaration, for both variables - the node constant and the python comparison, which is a literal rather than a constant and
is read as one.

**And it was given a negative control**: lowering `MIN_NODE` makes it fail with the two versions side by side, and restoring it makes it
pass.

## Validation commands

```powershell
python dove_pi.py --help
npm run test:installer
npm test
```

## Recorded, not built

1. **Raising a minimum**, which is a product decision.
2. **The first real turn**, which needs a Pi host.