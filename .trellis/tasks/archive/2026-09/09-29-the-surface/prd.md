# The surface that bounds every turn

## Goal

Read `harness-surface.yaml`, which bounds every turn, and hold this span own changes against it.

## What the surface is

```text
seven components, the AHE enumeration, bound to files:
  system-prompt       AGENTS.md, modes
  tool-description    src/pi-adapter/extension.ts
  tool-implementation src, tests
  middleware          src/core/action-policy.ts, src/pi-adapter/extension.ts, two tests
  skill               .agents/skills
  subagent-config     src/pi-adapter/subagent-provider.ts, .codex/agents
  long-term-memory    .trellis/spec, .trellis/workspace, .trellis/tasks
```

**And the rules are strict**: every entry must resolve, a path matching nothing is refused when the map loads, and a
test asserts these names agree with `CHANGE_SURFACES` in both directions. **Two components - `skill` and
`subagent-config` - have no `verifiedBy` entry, and the file says why**: *a component with no entry here means
nobody has stated what verifies it, which is a fact about our knowledge*. **That is the honest form of a gap, and
it is the same form this session has been using.**

## What the check found

```text
paths changed since the span began   1156
inside a declared component         1143
outside every component               13

  .pi/extensions/notify.ts        .trellis/harness-surface.yaml
  README.en.md                    README.md
  dove_pi.py                      scripts/build-release-manifest.mts
  scripts/harness-axes.mts        scripts/harness-corpus.mts
  scripts/harness-failures.mts    scripts/harness-rounds.mts
  scripts/release-roots.mts       scripts/trellis-convergence.mts
```

**The thirteen are not noise and they are not a defect either**, and the map own comment says why: *this describes
what a component is, not a partition of the tree*. **A README is not part of the harness action space, and neither
is the launcher, the map itself, or the scripts that consume the readings the components produce.**

**Three of them are worth naming anyway**, because a reader would ask:

- **`README.md` and `README.en.md`** are what the drift check calls *the only pair of user-facing documents in this
  repository*, and they are not an editable component. That is defensible - they are not the action space - **but
  it means the two files a user reads are outside the map that says what may be edited.**
- **`scripts/*.mts`** consume the readings. The readings are components; their consumers are not. **The map binds
  components to files, and a consumer of a component is neither.**
- **`dove_pi.py`** was changed twice in this span and is outside every component, which is consistent with the map
  describing the *harness* rather than the *installer* that ships it.

## And the point of the check: this span work is inside

**1143 of 1156 changed paths fall inside a declared component**, and the ones that do not are the categories above
rather than stray edits. **Reading the map and mapping against it is checking, which is why this was worth a round
where two surveys had already answered *nothing left*.**

## Acceptance criteria

- [x] **AC1** The surface is read, with its seven components and its two deliberate gaps.
- [x] **AC2** This span changes are mapped against it.
- [x] **AC3** The paths outside are classified rather than counted.
- [x] **AC4** The gate passes.