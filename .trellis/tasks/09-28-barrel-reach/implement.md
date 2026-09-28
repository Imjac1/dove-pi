# Implementation plan: the barrel

## Ordered checklist

- [x] **1. The importers**, and what they take.
- [x] **2. The reachability of the five.**
- [x] **3. Act or record.**
- [x] **4. The gate.**

## The measurement: the barrel is alive

```text
importers of project-provider/index.ts:  14
  src:    cli.ts, adapters/mcp.ts, commands/task.ts, commands/session.ts, trellis-adapter/context.ts,
          pi-adapter/extension.ts, context/interoperable.ts
  tests:  context.test.ts, interoperable-context.test.ts, pi-adapter.test.ts, project-provider.test.ts, task-cli.test.ts
  other:  scripts/benchmark-interop.mts
what they take: createProjectProvider, NativeProvider, discoverProject, initializeNativeProject,
                nativeTaskArtifactPath, ProjectContextSnapshot, ProjectProvider, summarizeProjectContinuation
```

**The barrel is the directory public surface and it has consumers**, so the five symbols the previous round left alone are reachable
through it. They are offered and unclaimed, which is what a published API looks like, not what dead code looks like.

## Why the previous round stopped where it did

The barrel publishes nine modules with `export *`, so **every** export of `contracts.ts`, `discovery.ts` and `manifest.ts` is part of its
surface whether or not anything names it. **"Unused export" is not a category that applies to a barrel**: the search could see the names, and
could not see the wall. This round measured the wall and found it load-bearing.

**Nothing was changed.** The five stay, the barrel stays, and the note the last round wrote about its own limit is now a measured fact rather
than a caution.

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **Other barrels**, not covered here.
2. **The first real turn**, which needs a Pi host.