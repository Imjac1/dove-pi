# Implementation plan: the commands the READMEs name

## Ordered checklist

- [x] **1. The invocations**: every `dove-pi` mention in both READMEs, with its line.
- [x] **2. The claim**: what the surrounding text says they are.
- [x] **3. The check**: each name asked for its own help.
- [x] **4. Fix or record**, then the gate.

## What the comparison found

```text
commands the READMEs tell a reader to run:  doctor shell project task session capability web
                                            update repair rollback uninstall rpc mcp --version --offline
named in dove-pi --help:                    all of them except shell

shell:  5 mentions in README.md, 5 in README.en.md, a first-class entry in LOCAL_CLI_COMMANDS, runs
        (real JSON: scope, path, effectivePath, source), and absent from the CLI own help.
```

**The three other commands missing from the help** - `cache`, `token`, `extensions` - appear in neither README, which is what makes
their absence consistent and `shell` not: a user-facing command group with its own README section could not be found from the tool.
The help already carried a section of exactly that shape for `workspace`, so `shell` had a place to go.

## The check, and the two things it needed

One direction on purpose: a README may show a way in without listing everything. **The check was wrong once** - its first regex used
`\s+` and matched across a line break, reading `python .\dove_pi.py install` on the next line as a command named after `dove-pi`, which is
the pattern-is-not-a-claim class this session keeps meeting. **And it was given a negative control**: with the `shell` block removed it
fails naming `shell`; with it back it passes.

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **Completeness of the README command list**, which is not what a front door owes.
2. **The first real turn**, which needs a Pi host.