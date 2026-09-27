# The fence: a mode declares its own protected surface, and the runtime refuses writes to it

## Goal

Give a mode a way to name the workspace paths that constitute **the harness's own control surface** - its policy,
its verifier, its ledger - and have the tool boundary **refuse writes into them**. This is the first piece of the
bounded-self-improvement scaffold: an agent may edit the harness, and cannot edit the thing that decides whether
the edit was good.

Today nothing in this tree distinguishes "the policy" from "any other file". The evidence:

- `grep protected|immutable|tamper` over `src/` returns **nothing**. There is no concept of a protected path.
- The only self-protection is coarse and total: `src/core/action-policy.ts:19`'s `FILESYSTEM_MUTATORS` plus
  `:275`'s `filesystem: read-only-source`, which refuses **every** filesystem-mutating tool or none. It cannot
  protect the policy while letting the agent write elsewhere, which is the shape a self-improvement loop needs.
- Our host's own documentation makes this the substrate's named cost: Pi's "everything else is a TypeScript
  extension, auto-discovered from `.pi/extensions/` - **an agent can write one, reload it, and continue with new
  tools**", and therefore "**an agent gets more code it can improve, and more ways to break compatibility or
  weaken a permission boundary**". `src/pi-adapter/extension.ts` **is** one of those extensions.
- Two independent risk sources point at the same control: AHE keeps recorded gains attributable by making the
  "runs directory, tracer, verifier and LLM configuration **read-only**" (`2604.25850`), and `2509.26354` finds
  misevolution arising in the **tool** pathway - "the unintended introduction of vulnerabilities in tool creation
  and reuse".

Recorded as **D8** in `.trellis/tasks/09-27-harness-scaffold-frontier/decisions.md` (Round 11 delta 3, upgraded
in Round 12), where it is a candidate that has not been taken. This task takes it.

## Background

**What the fence is not.** It is not an OS sandbox (that is D1's open half, deferred) and it is not a shell
parser (that is D4's option (c)). It is a **path-scoped refusal at the tool boundary**, which is the seam this
project already uses for `sandbox.network` and `sandbox.filesystem`.

**The limit, established by reading the code rather than assumed.** `src/pi-adapter/extension.ts:236-249`
(`isReadOnlyShellCommand`) classifies a shell command by **name and regular expression only** - it strips
redirections (`:240-245`), rejects mutating command names (`:246`), and splits segments (`:247`). It **never
inspects a path**. So a shell command cannot be classified as "writes into the protected set", and the fence
**cannot see through the shell**. The design's answer is to make the mode **state** which route it took (R3)
rather than imply coverage it does not have.

**Two mutation lists that already disagree, verified.** `src/core/action-policy.ts:19`'s `FILESYSTEM_MUTATORS` is
`{write, edit, bash, powershell, replace, insert, notebook_edit}`; `src/pi-adapter/extension.ts:103`'s
`FORMAL_PRODUCT_MUTATION_TOOLS` is `{write, edit, replace, insert, delete, mkdir, agent_workspace_patch,
agent_workspace_restore}`. A fence keyed on one list would disagree with the other. This task must not add a
third list silently (R5).

**And the probe settled the path question, by reading the host rather than guessing.** The installed
`@earendil-works/pi-agent-core` declares its built-in tool inputs in `dist/harness/tools/*.d.ts`: `write` and
`edit` both take **`path`**, `read` takes `path`, and `tools/index.d.ts` exports exactly `{read, write, edit,
bash}` - which independently matches the "Pi ships 4 tools" description in the community landscape. Our own
`agent_workspace_patch` takes a **list** (`operations[].path`, `src/pi-adapter/extension.ts:1846-1852`). So a
hardcoded candidate key list was wrong, and a hardcoded *tool* list is not defensible either: the catalog is 57
names across installed extensions and we can read three schemas, not 57. `design.md` §"Step 0" records the
change this forced; R4/R5 and AC4/AC5 carry it.

**A fixture finding, recorded rather than quietly fixed.** `tests/host-work-mode.test.ts:620` calls `read` with
`{ file_path: "AGENTS.md" }` - **not a field the host's own read schema defines**. The test still passes because
`callTool` asserts a permission *decision*, not a successful call, so the decision it pins is valid and its
fixture is non-conformant with the host. The new host tests use `path`; correcting that older fixture is a
separate small change and is not in this task.

## Requirements

- **R1 - A mode can declare a protected surface.** The mode format accepts a `fence` block naming
  workspace-relative path globs. A mode that declares none is unaffected: absence means the mode makes no claim,
  which is D1's existing rule for an absent axis.
- **R2 - The declaration is validated at load, fail-closed, in the established shape.** An unrecognised key, an
  empty path list, a non-string entry, or an unrecognised shell stance is **refused with a reason naming both
  ways out**, exactly as `sandbox` is refused today (`src/core/work-mode.ts:511-540` is the model).
- **R3 - The fence states its own shell stance, and the stance is required inside the block.** `shell: denied`
  means the mode also closes the one route the fence cannot see; `shell: uncovered` means the mode declares that
  a shell command can still write into the protected set. **Neither is a default** - a default here would be a
  policy nobody chose, which is D2's rule for `permissions.unlisted`. The mode-load notification says which
  stance is in force.
- **R4 - An unclassifiable mutation does not run inside a fence.** The fence carries an **effective target
  map** (a built-in map this repo verifies, merged with an optional mode-declared `targets`). A covered tool's
  target inside a protected prefix is **blocked**; a target outside is not the fence's business; a covered tool
  whose target **cannot be resolved** is **blocked**; and a tool that **mutates but is not in the map** is
  **blocked**, with a reason naming the tool and the two ways out. Each block is labelled `fence`. The full case
  table is `design.md`'s.
- **R5 - The built-in map cannot drift from the repo's own mutation sets.** A test fails when a tool in the
  built-in map is not also a member of a mutation set this repo already keeps (`src/core/action-policy.ts:19`,
  `src/pi-adapter/extension.ts:103`). No third list is introduced that could disagree with both.
- **R6 - The contract is recorded in the spec**, beside the sandbox's honoured-or-refused contract
  (`.trellis/spec/backend/personal-agent-framework-core.md:108-129`).

## Acceptance Criteria

- [ ] **AC1** A fixture mode declaring `fence: { paths: [...], shell: "denied" }` loads, and the load
      notification names the fence and its shell stance. A mode whose `fence` omits `shell`, names an unknown
      stance, declares an empty `paths`, or declares an unknown key is **refused at load** with a message naming
      both ways out.
- [ ] **AC2** With a fence declared, a `write` / `edit` call whose `path` falls inside a protected prefix is
      blocked, the reason is labelled `fence`, and it names the mode and the prefix that decided.
- [ ] **AC3** With the same fence, a `write` whose path is outside every prefix is not blocked by the fence.
- [ ] **AC4** A covered tool called with a target that cannot be resolved is blocked, with a reason stating the
      target could not be classified.
- [ ] **AC5** A tool that mutates but is not in the effective map is blocked inside a fenced run, and the reason
      names the tool and the two ways out. `agent_workspace_patch` is covered by the built-in map instead, and a
      call whose **any** operation targets a protected prefix is blocked.
- [ ] **AC6** With `shell: denied`, `bash` and `powershell` are blocked; with `shell: uncovered` they are not
      blocked by the fence, and the run's load notification says the fence is uncovered.
- [ ] **AC7** The drift test of R5 exists and fails when a built-in-map tool is removed from the repo's mutation
      sets.
- [ ] **AC8** `npm run typecheck`, `npm test` and `tests/spec-context-budget.test.ts` pass; the spec records the
      contract (R6).
- [ ] **AC9** No shipped mode is modified by this task, so no existing behaviour changes. Whether the three
      shipped modes should declare a fence is a separate decision with its own evidence.

## Out of scope

- **The prediction record** (D5's decision-observability half). It is the second piece of the scaffold and gets
  its own task; this one only makes the protected surface real.
- **The shell parser.** `shell: denied` is the fail-closed answer to the shell's unclassifiability; making the
  shell path-aware is D4's option (c) and the largest single piece in the corpus's safety budgets.
- **Any OS sandbox.** D1's open half, unchanged.
- **Measurement.** D6's axis work is not started here.
- **Declaring fences for the three shipped modes** (AC8), and **the repo-level alternative** in which one list is
  shared by every mode (see `design.md`).
