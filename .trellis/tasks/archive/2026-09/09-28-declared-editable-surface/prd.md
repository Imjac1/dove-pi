# The declared editable surface

## Goal

AHE's **component observability** states the requirement in one line: "every editable harness component [has] a
**file-level representation** so the action space is **explicit and revertible**". This repository has the components -
they *are* files - and nothing that says which file belongs to which component, or that the files exist.

So a proposal to edit the harness has no declared space to be bounded by, and a change manifest's `surface` names one of
seven strings with nothing behind it (`src/core/task-convergence.ts`, `CHANGE_SURFACES`). This task declares the map and
makes every entry resolve.

## Background: what the evidence says about the order

**The corpus has no failures in it.** Every `request.terminal` record on this machine says `completed`: 164 ledgers,
164 terminals, 0 failures, and **no `tool.observed` record anywhere**, because those scenarios drive prompts rather
than tools. So the *mining* half of the loop - "failure patterns from execution traces" - has nothing real to read yet,
and a first version of it could only be validated against fixtures it was handed.

The declared surface is the opposite: **verifiable by construction, today**, because every entry either resolves to a
path in this repository or does not. It is also the pillar AHE lists first, and the one the other two depend on -
experience observability maps a failure **to a component**, and the manifest (decision observability) is already built
and already names one. Component first, then experience, then the loop that reads both.

**Where this map comes from.** AHE enumerates the editable components as system prompt, tool *description*, tool
*implementation*, middleware, skill, sub-agent configuration, and long-term memory - the same seven names this
repository already carries as `CHANGE_SURFACES`, and the same set the misevolution pathways of `2509.26354` map onto.
This task does not invent a taxonomy; it binds the existing one to files.

## Requirements

- **R1 - The map is declared in the repository, one entry per component.** `.trellis/harness-surface.yaml`: the seven
  components and, for each, the workspace-relative paths that belong to it. A file may belong to more than one
  component - `src/pi-adapter/extension.ts` *is* both a tool description and middleware - and the map says so rather
  than forcing a partition that does not exist.
- **R2 - Every entry must resolve.** A path that matches nothing is refused with the entry named: a map whose entries
  do not exist is a declaration that lies, which is the defect class this project keeps finding in itself. This is
  the "explicit" half of AHE's requirement, and it is checkable without a run.
- **R3 - One copy of the vocabulary.** The map's component names must equal `CHANGE_SURFACES` exactly, asserted in
  both directions, so a component cannot be added to one and forgotten in the other.
- **R4 - The "revertible" half is stated, not assumed.** AHE's requirement has two halves and this repository satisfies
  the second by convention: one logical edit is one commit, which is what gives an edit a revert. The contract says
  so, and names the mechanism rather than implying it.
- **R5 - The map has a runtime consumer.** The `agent_task_convergence` status read reports the declared surface, which
  is AHE's own "(1) the editable surfaces of the current harness" in a proposal's bounded context. **A declaration
  with no consumer is what this project is about** - and a map read only by its test would be exactly that.
- **R6 - The map is loaded, validated and bounded.** A loader in `core` returns typed components or refuses; an
  unknown component, a missing path list, an empty list, or a path that escapes the workspace are all refusals naming
  the entry.

## Acceptance Criteria

- [ ] **AC1** `.trellis/harness-surface.yaml` declares all seven components, each with at least one path.
- [ ] **AC2** Loading it returns the components; an entry that resolves to nothing is refused and the refusal names it.
- [ ] **AC3** A component name outside `CHANGE_SURFACES`, a duplicate component, an empty path list, and a path that
      escapes the workspace are each refused.
- [ ] **AC4** The map's names and `CHANGE_SURFACES` agree in both directions (adding one without the other fails).
- [ ] **AC5** The status read reports the declared surface, bounded (names and path counts, not the whole tree).
- [ ] **AC6** The spec records the map, the resolve rule, the overlap rule and the revert convention.
- [ ] **AC7** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.

## Out of scope

- **The failure reading.** It is the next increment, and it needs this map to attribute a pattern to a component. It
  also has nothing real to read until a run fails, which the plan records rather than works around.
- **Enforcing the surface as a permission.** The fence refuses writes into protected paths today; whether an edit
  outside the declared surface should be *refused* is a control decision with its own evidence, and a map that became
  a gate would stop being a map.
- **Making the surface per-mode.** It describes the harness, not an engagement, which is why it lives in the
  repository and not in a mode file - the opposite of the fence's choice, for a reason that is recorded.
- **A CLI or tool that edits by component name.** The map names paths; turning names into edit targets is the loop's
  job, not the map's.
