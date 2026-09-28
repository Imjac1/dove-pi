# What the read-only switch actually blocks

## Goal

Measure what `DOVE_PI_READ_ONLY` blocks, rather than reading what it is supposed to.

## Background: a switch with a safety claim

The adapter authorizer consults `runtimeReadOnly()` and refuses a capability with side effects when it is set. That is a **safety claim**
about a session, and this session has learned what a claim is worth before it is measured.

**The claim has a shape worth checking on both sides**: the capability path consults it, and the tool path is a different door. If the switch
blocks one and not the other, then a session that believes it is read-only is not.

## Requirements

- **R1 - Read what the switch is and where it is consulted**, before driving anything.
- **R2 - Drive the capability path with it set**, in a temporary project, and record the answer.
- **R3 - Establish whether the tool path consults it**, and say how that was established.
- **R4 - State what the switch blocks and what it does not**, with the evidence for each.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The switch and its consultation points are listed.
- [x] **AC2** The capability path is driven with it set and the answer recorded.
- [x] **AC3** Whether the tool path consults it is answered with evidence.
- [x] **AC4** What it blocks and what it does not is stated.
- [x] **AC5** The gate passes.

## Out of scope

- **Changing the switch**, unless the measurement shows a claim that is false.
- **Modes and their own permissions**, which are a separate control.
- **The first real turn**, which needs a Pi host.