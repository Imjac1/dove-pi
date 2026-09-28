# Implementation plan: do the READMEs claim to list the switches

## Ordered checklist

- [x] **1. Read both install sections** and quote what they say about switches.
- [x] **2. Decide: claim or example.**
- [x] **3. Act on the decision, or record it.**
- [x] **4. The gate.**

## The decision, with the quote it rests on

```text
README.en.md:66  "To avoid changing PATH/fonts or to skip optional extensions, download the script and pass advanced switches:"
README.en.md:70  .\install.ps1 -NoPath -NoFont -NoExtensions
README.md:63     "需要避免修改 PATH/字体或跳过可选扩展时，先下载脚本再传入高级开关："
```

**An example, not a claim.** The sentence frames the command as a way to reach a purpose, and it says *advanced switches* in the plural
without saying that is all of them. **A sample command that listed every switch would stop being a sample**, so the READMEs are not
wrong and nothing in them changed.

## What was built instead

The example must still be **true**, and that is checkable in one direction: a switch an example names and the script does not declare is a
command that fails when a reader copies it. The installer suite now asserts that, while the **contract** - the document that does claim
to list the surface - keeps the both-directions check. **Two assertions, two documents, each held to what it actually says.**

Installer suite: 115 to 116 tests, OK.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
```

## Recorded, not built

1. **Running the installer**, which writes outside the repository.
2. **The first real turn**, which needs a Pi host.