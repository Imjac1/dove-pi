# Three first-class commands with no document anywhere

## Goal

Find out what `cache`, `token` and `extensions` are, and whether anything states which commands a user is meant to run.

## Background: the step after last round

Last round held the READMEs against the CLI help and found `shell` documented but undiscoverable. Three commands are further out:

| Command | In the READMEs | In `--help` | In `LOCAL_CLI_COMMANDS` |
|---|---|---|---|
| `shell` | yes, a section each | **no** | yes |
| `cache` | no | no | yes |
| `token` | no | no | yes |
| `extensions` | no | no | yes |

**So they are runnable and undocumented in both directions.** That is either a convention - internal commands that exist for maintenance -
or it is three commands nobody can find out about. **The difference is whether anything says which is which**, and that is the measurement:
what each one does, and whether the repository states a public surface at all.

**The rule from a previous round applies**: read what the thing *is* before deciding what its absence means. A command that prints a
maintenance summary and is invoked by another command is internal by construction; one that a person is expected to run is not.

## Requirements

- **R1 - Read how each of the three is dispatched**, and what subcommands it takes.
- **R2 - Read what each does**: whether it changes state, and whether another command or the installer invokes it.
- **R3 - Establish whether the repository states a public surface** - a list, a convention, or a comment - and quote it if it does.
- **R4 - Conclude per command**: internal by construction, internal by convention, or user-facing and undiscoverable.
- **R5 - The fix, if any, is a statement rather than a new document**: naming which commands are internal is worth more than describing
  three of them in passing.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** Each command is read, and what it does is stated.
- [ ] **AC2** Whether the repository states a public surface is answered with a quote or with "nothing states it".
- [ ] **AC3** Each command is classified, with the evidence for the classification.
- [ ] **AC4** Any change is a statement of the boundary rather than a description of three commands.
- [ ] **AC5** The gate passes.

## Out of scope

- **Documenting each command in the README**, which is a product decision.
- **Removing a command**, which is not what an undocumented one asks for.
- **The first real turn**, which needs a Pi host.
