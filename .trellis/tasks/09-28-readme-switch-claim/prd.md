# Do the READMEs claim to list the bootstrap switches

## Goal

Decide whether the READMEs are missing two switches or simply showing an example, by reading what they claim before changing anything.

## Background: what is already known

Last round compared the installer parameter surface and found that the contract was silent about `-Profile` and `-Verify` while
`install.ps1` accepts both and passes them through. The contract names all six now, and a test compares that list with the `param` block
in both directions.

**The READMEs name three** - `-NoPath`, `-NoFont`, `-NoExtensions` - and the open question is whether that is a gap or a sample. The
difference decides everything:

| What the README says | What it is | What to do |
|---|---|---|
| "the bootstrap accepts …" | a claim about the parameter surface | complete it, and hold it with the test |
| "run it like this: …" | an example | leave it, and say so |

**The same mistake has been made twice in this session already**: a regex that matched PowerShell own `-NoProfile` and called it an
installer switch, and a test whose pattern was stricter than the prose it read. Both were patterns read as claims. **So this round reads
first.**

## Requirements

- **R1 - Read the install section of both READMEs** and quote the sentence or example that names the switches.
- **R2 - Decide which it is**, with the quote as the evidence.
- **R3 - If it is a claim, complete it in both languages**, in the style the surrounding text already uses.
- **R4 - If it is an example, change nothing** and record why, because a sample command that listed every switch would stop being a
  sample.
- **R5 - Either way, the both-directions test keeps covering the contract**, which is the document that does claim to list them.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** The README sentences are quoted, in both languages.
- [ ] **AC2** The decision is recorded with the quote as its evidence.
- [ ] **AC3** If a change is made, both languages carry it and the installer suite still passes.
- [ ] **AC4** The gate passes.

## Out of scope

- **Changing the contract**, which now names all six.
- **Running the installer**, which writes outside the repository.
- **The first real turn**, which needs a Pi host.
