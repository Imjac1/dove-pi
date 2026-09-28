# Implementation plan: the three undocumented commands

## Ordered checklist

- [x] **1. The dispatch**: how each is routed and what it takes.
- [x] **2. What each does**, and who invokes it.
- [x] **3. The public surface**: is it stated anywhere.
- [x] **4. The classification**, per command, with evidence.
- [x] **5. The gate.**

## The classification, and what decided it

```text
command       in READMEs   in --help   who calls it                       verdict
extensions    no           no          this router, to reconcile the     internal by construction
                                       profile it just installed (:536)
token         no           no          the CLI dispatch only (cli.ts:222) user-facing, unfindable
cache         no           no          the CLI dispatch only (cli.ts:26)  user-facing, unfindable
```

**Nothing in the repository stated which commands are public** - the only hit for such a phrase was about cross-engagement isolation -
which is why the absence of three commands read as an oversight rather than a convention. **So the fix is a statement, not three
descriptions**: `INTERNAL_CLI_COMMANDS` sits beside `LOCAL_CLI_COMMANDS`, and the difference between them is exactly what the help names.

## Both directions, and the control for the new one

The test asserts that a command in the set and not in the exceptions is named in the help, **and** that an exception is not named there.
The first direction was already proven live by the previous round failing on `shell`; the second got its own control here - naming
`extensions` in the help makes it fail with *"an internal command is named in the help, so it is not internal"*, and removing it makes it
pass.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
```

## Recorded, not built

1. **README documentation for each**, which is a product decision.
2. **The first real turn**, which needs a Pi host.