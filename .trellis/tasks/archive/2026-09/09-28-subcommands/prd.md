# The subcommands the usage strings name

## Goal

Complete the command audit one level down: hold every subcommand the documents name against what the dispatch handles.

## Background: three rounds of the same shape

| Round | Surface | Result |
|---|---|---|
| 58 | the commands the READMEs name, against the help | `shell` was documented and undiscoverable |
| 59 | the commands the router knows, against the help | `cache` and `token` were unfindable; `extensions` is internal |
| 60 | the switches the documents name | clean, once the extraction stopped lying |

**The subcommands are the layer below all three**, and they are named in the same places: the usage strings inside `src/cli.ts`, and the
README sections that show a reader what to run.

**The trap is the same one, and it has caught this session four times**: the pattern is not the claim. A subcommand is dispatched by a
string comparison somewhere, and the honest way to find it is to read the dispatch - not to infer it from a usage line.

## Requirements

- **R1 - Extract every subcommand the usage strings and the READMEs name**, per parent command.
- **R2 - Read the dispatch for each parent command** and list what it actually handles.
- **R3 - Report both directions**: a documented subcommand the dispatch does not handle, and one it handles that no document names.
- **R4 - Anything broken is fixed at the side that is wrong.**
- **R5 - A check is added only if it is not a weaker duplicate** of the command-level ones.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** Both lists exist, per parent command, with their sources named.
- [ ] **AC2** The comparison is reported in both directions.
- [ ] **AC3** Anything broken is fixed and verified by running it.
- [ ] **AC4** Any check added is justified against the three that already exist.
- [ ] **AC5** The gate passes.

## Out of scope

- **Pi own subcommands**, which Dove passes through.
- **The blackbox script**, whose flags a previous round settled.
- **The first real turn**, which needs a Pi host.
