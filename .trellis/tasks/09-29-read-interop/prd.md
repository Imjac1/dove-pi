# Reading the interop layer P1

## Goal

Read the next open task, measure its claims against the names the code uses, and find what is missing.

## Background: a plan with no checkboxes, and a PRD whose criteria are ticked

`08-27-dove-interop-layer` is P1 and in progress, with `createdAt: 2026-08-27` and no update timestamp. **Its
`implement.md` is a fourteen-item plan with no checkboxes at all**, so the file cannot say what is done - but its
`prd.md` carries checked acceptance criteria, and **they match what was measured**.

## What was measured, using the names the code uses

```text
PRESENT  #3 benchmark harness        scripts/benchmark-interop.mts          (ran in round 145)
PRESENT  #5 invocation service       src/core/capability-invocation.ts
PRESENT  #6 MCP discovery/execution  src/adapters/mcp.ts, src/cli.ts
PRESENT  #7 CLI/RPC invocation       src/adapters/local-rpc.ts
PRESENT  #12 interop smoke matrix    tests/interop-smoke-matrix.test.ts

CLAUDE.md         4 files, including src/context/interoperable.ts
agent skills      4 files, including src/pi-adapter/extension.ts
MCP               15 files
capability proto  9 files
```

**The PRD criteria and the measurement agree**: a capability invoked through Pi returns the same record as a
direct Core call; the protocol has a semver contract with six outcome fixtures; a minimal MCP adapter exists
without importing Pi into Core; a CLI/RPC adapter shares the ledger correlation ids; and a project with
`AGENTS.md`, `CLAUDE.md` or Agent Skills produces one normalized projection.

## The one gap, and why it was not closed this round

```text
item 14   update the Chinese and English README sections with the adapter and plugin-reuse model
README.md      15198 bytes   adapter=0  MCP=6  plugin=0  capability=5
README.en.md   26521 bytes   adapter=0  MCP=6  plugin=1  capability=6
```

**Both READMEs mention MCP and neither uses the words the item names.** That is a real, bounded gap - **and it
was not closed here, deliberately**: the two files are held against each other by a drift check, so a bilingual
edit that keeps them parallel is not a thing to attempt in the last few minutes of a round. **The task stays
open, and the gap is now named rather than left to be rediscovered.**

## Acceptance criteria

- [x] **AC1** The plan and the PRD criteria were read.
- [x] **AC2** The claims were measured using the names the code uses.
- [x] **AC3** The gap is named precisely.
- [ ] **AC4** The README sections, which is the work that remains of this task.