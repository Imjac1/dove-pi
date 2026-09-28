# Implementation plan: the capability names

## Ordered checklist

- [x] **1. The registry**, from `capability list`.
- [x] **2. The documented names**, from both READMEs and the help.
- [x] **3. The comparison, both directions.**
- [x] **4. Fix or record, then the gate.**

## The measurement

```text
registered capabilities:  14  (dev.* seven, web.* two, windows.host_info, workspace.inspect, code-audit.* three)
named in the READMEs:      2  - workspace.inspect, dev.project_test   both registered
named in the help:         0  - it shows capability run <name>, a placeholder
named in a mode grant:     5  - three capability names and two mode-own action names
```

**Both directions are clean, and for different reasons.** The documented names are real; the twelve the documents do not name are
discoverable by running `capability list`, which is a document that cannot go stale - unlike `cache` and `token`, which two rounds ago were
named nowhere at all.

## What the measurement did find

**Two namespaces, and nothing said so in the file where it matters.** The mode own grant lists both capability names and its own action
names, and a reader could take every dotted name for a capability. The permissions file explains the mix; the governance file did not, and
now does.

## Validation commands

```powershell
python dove_pi.py capability list
npm run typecheck
npm test
```

## Recorded, not built

1. **Capabilities no document names**, beyond recording them.
2. **The first real turn**, which needs a Pi host.