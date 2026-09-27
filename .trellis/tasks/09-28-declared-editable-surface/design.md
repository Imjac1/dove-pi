# Design: the declared editable surface

## Boundaries - where each piece lives, and why there

| Piece | File | Why there |
|---|---|---|
| The declaration | `.trellis/harness-surface.yaml` | It describes **this repository harness**, which is a property of the repository and not of an engagement - so it lives in the declaration tree beside the specs and the workflow, and it is versioned with the code it names. |
| The vocabulary and the parse | `src/core/harness-surface.ts` (new, pure) | The component names already exist in `core` (`CHANGE_SURFACES`); the parser and the resolve check are pure given an injected existence predicate, so every refusal is a unit test rather than a fixture run. |
| The read | `src/pi-adapter/extension.ts`, in the convergence status read | The filesystem is the adapter's; the map is a reading and the tool result is where a proposing model looks. |
| The contract | `.trellis/spec/backend/personal-agent-framework-core.md` | The evidence-plane scenario already owns this axis's reading; the surface is a second reading of the same plane. |

## The declaration, with every entry verified to exist

```yaml
version: 1
# Every editable harness component, as paths in this repository. AHE lists the seven (2604.25850 §3.3); this
# file is what binds the names to files. A path may appear under two components - extension.ts *is* both a tool
# description and middleware - because the map describes what a component is, not a partition of the tree.
components:
  system-prompt:      [AGENTS.md, modes]
  tool-description:   [src/pi-adapter/extension.ts]
  tool-implementation: [src]
  middleware:         [src/core/action-policy.ts, src/pi-adapter/extension.ts]
  skill:              [.agents/skills]
  subagent-config:    [src/pi-adapter/subagent-provider.ts, .codex/agents]
  long-term-memory:   [.trellis/spec, .trellis/workspace, .trellis/tasks]
```

All fourteen entries were checked to exist before this design was written (step 0 of the plan), which is the point of
R2: the map is only a map if its entries are real.

## The loader

```typescript
// src/core/harness-surface.ts
export interface HarnessComponent { readonly name: ChangeSurface; readonly paths: readonly string[]; }
export interface HarnessSurface { readonly version: 1; readonly components: readonly HarnessComponent[]; }

/** Parse and refuse: unknown key, unknown component name, duplicate component, empty or absent path list. */
export function parseHarnessSurface(text: string): HarnessSurface;

/**
 * The entries that resolve to nothing, given the caller's own existence check.
 *
 * The predicate is injected rather than imported so this stays pure: the adapter passes the filesystem, the test
 * passes a set of names, and both exercise the same rule.
 */
export function unresolvedSurfaceEntries(surface: HarnessSurface, exists: (relativePath: string) => boolean): readonly string[];
```

**One copy of the vocabulary.** The parser refuses a component whose name is not in `CHANGE_SURFACES`, and a test
asserts the two sets are equal in **both** directions - so a component added to one and forgotten in the other fails,
which is the drift this repository has already paid for once (the two mutation lists).

## Why the map is repository-level when the fence was not

The fence is declared **per mode** (`governance.fence`, one entry per session's policy) and its design recorded a
repository-level alternative as the better factoring to revisit. This map takes that alternative - not to contradict
that decision, but because the subject differs: a fence is a control an engagement imposes on a run, while the surface
is the shape of the harness itself, which does not change per engagement. Same repository, two declarations, two
subjects, and the difference is written here so neither looks like an oversight.

## The "revertible" half, stated

AHE's requirement is "explicit **and revertible**", and this repository satisfies the second half by convention rather
than by mechanism: **one logical edit is one commit**, which is what gives an edit a revert and what a manifest's
`fix` field describes. The contract says so and names the convention, because a requirement half of which is assumed
is the shape of claim this project keeps finding false.

## The consumer, and why it must exist

The map is reported by the `agent_task_convergence` **status read**, bounded to component names and path counts:

```json
{ "surface": { "system-prompt": 2, "tool-description": 1, "...": 3 }, "surfaceIssue": "(absent when the map is fine)" }
```

That is AHE's "(1) the editable surfaces of the current harness" in the bounded context a proposal is made from. It
also settles the failure mode this whole task is about: **a declaration read only by its own test is an inert
declaration**, and the reachability gate would say so - the module would land on the allow-list with the reason "read
by nothing", which is a reason this task should not need to write.

**A missing or malformed map is reported, not fatal.** `surfaceIssue` carries the reason and the rest of the status
read is unaffected: the map is evidence about the harness, not a precondition for reading a task's acceptance state.

## Corrected at implementation: which root the map belongs to

This design said the read would resolve `.trellis/harness-surface.yaml` from the **workspace**. The host test refused
it, and it was right to: the map names *this harness's* components - the adapter, the modes, the skills - while a run
happens inside whatever project the user is working in. In the test's temporary workspace every entry looked missing
for a map that was there all along.

**The fix, and the rule it establishes**: the declaration is resolved from the **harness's own root** (the extension
module two directories up), and its entries resolve against the **same** root - resolving the declaration one way and
the entries another is what produced eleven false misses out of fourteen entries. A project-level harness map would be
a different declaration with its own paths; it is recorded, not built.

That is the second time in this task that a test corrected a claim made in prose, which is the pattern this whole
project is built on: the map is a declaration, so a claim about where it lives is checkable, and checking it took one
run.

## Verification and rollback

- **By construction**: every entry resolves, both vocabularies are equal, and the seven components each have a path.
  No run is needed, which is exactly why this increment comes before the one whose evidence does not exist yet.
- **Rollback** deletes the file, the module and the status-read line: nothing else reads the map, no record is written,
  and the revert is free. Stated because the last two tasks both had non-free rollbacks.
