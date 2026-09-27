# Design: the fence

## Boundaries - where each piece lives, and why there

| Piece | File | Why there |
|---|---|---|
| The `fence` block, its types, its validation | `src/core/work-mode.ts` | The loader is where a mode's declaration becomes a typed value or a refusal. `sandbox` (`:511-540`), `gate` (`:415-509`) and `permissions` (`:310-330`) are all validated here, and `governanceVersion` already versions the format. |
| The path-scoped refusal | `src/core/action-policy.ts`, inside `evaluate` (`:248`) | This is the tool boundary, and it is where the mode's other enforceable claims are kept (`:259-285`). A control that lived only in the host would be a second place to remember. |
| The tool set the fence classifies | `src/core/action-policy.ts`, beside `FILESYSTEM_MUTATORS` (`:19`) | The policy already owns "which tools mutate". The fence scopes that set down to the tools that **carry a path**. |
| The load notification and any load-time refusal | `src/pi-adapter/extension.ts`, beside `modeRefusal` (`:1975-1990`) and the `[Dove mode] ... loaded` line (`:2034`) | D1 already established that a claim the runtime cannot honour is refused here, and that what is in force is announced here. |
| Tests | `tests/work-mode.test.ts` (loader) and `tests/host-work-mode.test.ts` (boundary) | The existing split: the loader's refusals are unit-tested, the boundary is tested through a real host with `writeFixtureMode` / `declareMode` / `startHost` / `callTool` (`tests/host-work-mode.test.ts:608-654` is the pattern). |
| The contract | `.trellis/spec/backend/personal-agent-framework-core.md`, beside `:108-129` | The sandbox's honoured-or-refused contract already lives there. |

## Step 0 - the probe, and the design change it forced

**The host's schemas were read at their source, not guessed.** The installed `@earendil-works/pi-agent-core` declares
its built-in tool inputs in `dist/harness/tools/*.d.ts`, and the answer is neither candidate the plan carried:

| Tool | Input schema | Source |
|---|---|---|
| `write` | `{ path: string, content: string }` | `pi-agent-core/dist/harness/tools/write.d.ts` |
| `edit` | `{ path: string, edits: {oldText,newText}[] }` | `.../edit.d.ts` |
| `read` | `{ path: string, offset?, limit? }` | `.../read.d.ts` |
| `bash` | `{ command: string, timeout? }` | `.../bash.d.ts` |

So the key is **`path`** for every file tool, and the host's core tool set is exactly `{read, write, edit, bash}`
(`tools/index.d.ts` exports only those four) - which independently matches the "Pi ships 4 tools" description in
`rsi-community-landscape.md` §3. Three consequences:

1. **The plan's candidate list (`file_path` first) was wrong**, and its evidence was weak for a reason worth
   recording: `tests/host-work-mode.test.ts:620` calls `read` with `{ file_path: "AGENTS.md" }`, which is **not a
   field the host's own read schema defines**. The test still passes because `callTool` asserts a *decision*, not
   a successful call - so the fixture is non-conformant with the host and the decision it pins is still valid.
   Recorded rather than corrected here: fixing that fixture is a separate small change, and AC2-AC5's tests must
   use `path`.
2. **A hardcoded tool list is not defensible.** The catalog is 57 names across installed extensions, and the repo
   has two disagreeing mutation lists already (`action-policy.ts:19` vs `extension.ts:103`). We can read the core
   host's schemas; we cannot read the other 53.
3. **Our own mutation tool is not single-path.** `agent_workspace_patch` takes `{ operations: [{ kind, path,
   content? }] }` (`src/pi-adapter/extension.ts:1846-1852`) - a *list* of targets, so the extraction has to return
   targets rather than a target.

## The mode-format contract (corrected by step 0)

```yaml
governance:
  fence:
    paths: ["modes", "tests", ".dove/effects"]   # required, non-empty, workspace-relative
    shell: denied                                # required: denied | uncovered
    targets:                                     # optional; merged over the built-in map
      notebook_edit: path
```

- **`paths`** - workspace-relative **prefixes**. A file matches exactly; a directory matches its whole subtree; a
  trailing `/*` or `/**` is accepted and stripped, because that is how people write it. Non-empty: a `fence` with
  no `paths` would read as a protection while protecting nothing, which is the defect class this task exists for.
  Not a glob engine - `matchesPermission` (`src/core/work-mode.ts:566`) is a prefix matcher, not a glob matcher,
  and inventing a second, richer rule for one field is how two rules come to disagree.
- **`shell`** - **required and not defaulted.** `denied` means the mode also refuses `bash`/`powershell`, because
  the shell is the one route the fence cannot see (`extension.ts:236-249`). `uncovered` is legal and means the mode
  declares that route open. A missing or unrecognised stance is refused with both ways out named, in the shape
  `permissions.unlisted` already uses (`src/core/work-mode.ts:317`).
- **`targets`** - the path argument of a tool the built-in map does not know. The **built-in map** is the part this
  repo can verify, and it is small on purpose:

  | Tool | Targets | Evidence |
  |---|---|---|
  | `write` | `path` | host schema, read above |
  | `edit` | `path` | host schema, read above |
  | `agent_workspace_patch` | `operations[].path` | our own schema, `extension.ts:1846-1852` |

**Why the stance is required rather than a default.** The alternative - defaulting to `denied` - would silently
change a mode's tool availability; defaulting to `uncovered` would let a fence read as complete while a one-line
`bash` rewrites the policy. D2 settled this shape for `unlisted`: a default here is a policy nobody chose.

## Data flow

```
governance.yaml  ->  parseFence (work-mode.ts)  ->  WorkMode.fence  ->  createPolicy(mode)
                                                                              |
tool_call event  ->  policy.evaluate(invocation)  ->  fence check  ->  { block, reason } | allow
                        |
                        +-- pathOfMutationTool(invocation)  ->  resolvable?  ->  inside globs?
```

## The resolution rule, including the fail-closed branch

The **effective map** is the built-in map merged with the mode's `targets`. Targets are read from the
invocation's arguments by {@link readArgumentPath} (`src/core/gate-limit.ts:55`), the same extraction the mode
format already uses for `gate.target_argument`, and the built-in map's list form (`operations[].path`) yields a
**set** of targets rather than one. Then:

| Case | Decision |
|---|---|
| a target resolves, and falls inside a protected prefix | **block**, labelled `fence`, naming the mode and the prefix that decided |
| every target resolves, and none is protected | not the fence's business - the other controls still apply |
| a covered tool's target **cannot be resolved** | **block**, labelled `fence`, reason saying the target could not be classified |
| a tool that **mutates but is not in the effective map** | **block**, labelled `fence`, reason naming the tool and the two ways out |
| `bash` / `powershell` | governed by the declared `shell` stance, never by path |

**Why the fourth row exists, and why it is the airtight choice rather than the aggressive one.** The repo cannot
read the schemas of the other 53 tools in the installed catalog, so any coverage rule that rests on "we know which
tools mutate and where their path is" is a claim we cannot back. The fourth row replaces that claim with a refusal:
inside a fenced run, a mutation this repo cannot classify **does not run**, and the reason says how to allow it
(naming `targets` for the tool, or dropping the fence). That is the same disposition as the third row, extended
from "cannot classify this target" to "cannot classify this tool" - and it handles `agent_workspace_restore`
correctly without pretending it has a path: a whole-workspace rewrite with no per-file target must not run inside
a fence.

The alternative - cover only `write` and `edit`, and let the rest through - is smaller and was rejected: it makes
the fence a claim about two tools that reads as a claim about the run, which is precisely the defect
(`inventory.md`) this project keeps finding in itself.

## Ordering inside `evaluate`

The fence is checked **immediately after `denyDecision` (`:252`) and before the sandbox block (`:259`) and the
technique check (`:286`)**. Rationale: it is the only control whose subject is the harness itself, so it must be
evaluated before any control whose configuration the run could have influenced.

**Correction (2026-09-27, at implementation): the `gates` array is deliberately left alone.** This section first
said the fence "earns a label in the `gates` array". It does not, and the reason is visible in the code: that array
is the **fallback** label for a reason that does not carry its own (`extension.ts:2364` reads
`/^\[([a-z-]+)\]/` first), `sandbox` and `technique` are the precedent for a labelled control that is not in it,
and `tests/action-policy.test.ts:117` asserts the array exactly. The label in the reason is what makes the control
enumerable; adding a name to `gates` would have been a fourth, silently different meaning for "the gates".

## The one alternative we rejected

**A repo-level list** (`.dove/harness.json`, following the `.dove/project.json` / `.dove/mode.json` convention)
would declare the protected surface once for every mode, which is what AHE does - its read-only set is a property
of the harness workspace, not of a task. It is the better factoring once more than one mode wants the same list,
and the reason to reject it now is cost, not principle: it adds a file type, a load path, a validation surface,
a failure mode for a missing/malformed file, and a precedence question (repo list vs mode list) - and none of
those are needed to make the first protected surface real. **Recorded so the next task can revisit it with
evidence** rather than rediscover it.

## Two boundaries implementation found, recorded rather than papered over

1. **The fence inherits the policy's existing split, and the lease is what gates it.** `tool_call` runs the *name-only*
   half (`denyDecision`) first, then `if (!requestLifecycle.activeLease()) return;` (`src/pi-adapter/extension.ts:2301`)
   - so the half that reads arguments, which the fence is, **runs only inside an active request**. The split exists
   for a good reason (arguments must be final before a gate reads them, and the host re-validates nothing after a
   mutation), and the fence does not change it. What it means: **a tool call with no request lease is not
   fence-checked.** In practice tool calls happen inside an agent turn, but the honest statement is the boundary, not
   the practice - and the first host-level version of these tests failed exactly here, because they called the tool
   without opening a request. Fixed in the tests, recorded here.
2. **The host prefixes a refusal with the mode, so a reason carries two labels.** The returned text is
   `[Dove mode <id>] [fence] ...` (`:2391`), which is why the reason assertion matches the label rather than
   anchoring on it - and the *ledger* records `fence` alone as the gate (`:2377` parses the label out). The control is
   identifiable in both places, which is the property that matters.

## Compatibility, migration and rollback

- **No shipped mode changes** (AC8). A mode without a `fence` block loads and behaves exactly as today, so the
  change is additive and cannot alter an existing run.
- **`governanceVersion`** is bumped only for a mode that declares a fence. Nothing shipped does.
- **Rollback** is deleting the block from the mode and the reader from the policy. No persisted state, no
  migration, no schema version to unwind. The one thing that must not be rolled back silently is the spec entry:
  if the fence is removed, the contract it describes is removed with it.

## What this enables - and the loop it is for

This is the scaffold's first piece, not the loop. Recorded here because the pieces are only meaningful as an
order someone intends to build:

1. **The declared surface** (this task) - component observability. A mode names what is editable and what is
   fenced, so the action space is explicit and the verifier is out of reach.
2. **The prediction record** (next task) - decision observability. A `prediction` recorded beside a change,
   checked in the next round by the resolver that already exists (`unresolvedAcceptanceEvidence`,
   `src/pi-adapter/extension.ts:548`, called at `:1569` and `:1549`). Schema-sized: `contracts.ts:72-76` carries
   `passed`/`failed`/`waived` with `evidenceRefs` and no prediction.
3. **The failure record** (then) - experience observability. Self-Harness requires the verifier-level cause and
   the causal mechanism to be **separate** fields, plus a record of the passing behaviours a proposal must not
   regress; `contracts.ts:81`'s finding shape has neither.
4. **The loop** (last) - mine from the ledger, propose a bounded edit to a declared surface, predict, verify
   against held-in **and** held-out, with the misevolution pathway named per edit (`2509.26354`).

**The label is bounded self-improvement, deliberately.** The community's test is which layer persists - output,
system, or the verifier as well - and raising the verifier "without capturing the signal" has no public
demonstration. Steps 1-4 build the second rung and stop there; step 4's loop is only legitimate because step 1
puts the verifier outside what it can edit.
