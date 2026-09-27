# A section that restates rules whose owners are elsewhere

## Goal

Turn a restatement into a pointer, and keep the one rule that has no other home.

## Background: three measurements

**1. The file is not becoming a specification.** 4,996 bytes, 83 lines - under a fifth of the budget a routed specification carries, and
not linked from the router. The worry that it was growing into a second spec is answered by the number.

**2. The section restates four rules that already have owners.** `## Formal Convergence Quality Gate` states:

| Rule | In the routed convergence record |
|---|---|
| findings tied to an `AC-*` | yes, two lines |
| only blocking and regression findings fixed in scope | **no, nowhere** |
| two semantic no-progress reviews, then one checkpoint | yes |
| `ready_to_finish` stops product mutation | yes, five lines |
| resources are observation-only | not there - the loop specification owns the closed observable set, which has no resource observable |

**3. The identifiers are all real.** Every code-shaped token the quality guidelines and the convergence record name resolves in `src` -
54 of them in the record, and the two misses in the guidelines are the tool name `tsx` and the file `tsconfig.json`. So the section is
redundant rather than wrong.

**And the middle row is why this is worth a round**: a rule with no home is a rule nobody maintains, and it is the one that governs what
a formal task fixes versus records.

## Requirements

- **R1 - The rule that is only here stays here**, stated as this repository rule rather than as a summary of the contract.
- **R2 - The other four become pointers**, each naming the specification that owns it - the same rule the project applies to citations
  and index rows: name the thing rather than copy it.
- **R3 - Nothing is lost**: the section still reads as a checklist for a reviewer, which is what its file is for.
- **R4 - The measurements are recorded** in the task, including the negative - the file is small and its identifiers are real.
- **R5 - The gate passes**: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** The section states the scope rule as this repository own, and names the owners of the other four.
- [ ] **AC2** Each owner named is a specification that exists and covers that rule - checked by reading, since the owners are prose.
- [ ] **AC3** The file stays under 6 KiB, so the round did not replace the restatement with a longer one.
- [ ] **AC4** The three measurements are in the task.
- [ ] **AC5** The gate passes.

## Out of scope

- **A duplication check**, which cannot be mechanical: two sentences saying the same thing in different words are not comparable.
- **Moving the section to a specification**, which would make a reviewer checklist into a contract.
- **The first real turn**, which needs a Pi host.
