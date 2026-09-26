# Ground truth: what actually runs in this repository

- Method: transitive import reachability from four entry points, plus a check of the Trellis hooks
- Date: 2026-09-26
- Author: the main session, not a sub-agent

This file exists because an earlier finding was reached by a cruder method (searching for the string
`core/<name>`) and a sub-agent reached a third answer by a fourth method (counting textual references).
Three methods, three answers. This is the one that is defensible, and the disagreements are recorded below
because they are the reason to trust this one rather than any of them.

## Method

For every `.ts` under `src/`, collect relative import edges by reading `from "./x"` specifiers and
resolving them. Then walk forward from the four entry points:

```text
src/cli.ts
src/pi-adapter/extension.ts      <- the Pi host, the only thing that runs
src/adapters/local-rpc.ts
src/adapters/mcp.ts
```

78 of 92 modules under `src/` are reachable. Of the 35 in `src/core`, **12 are not**.

## Independently re-derived on 2026-09-26, before M0 hard-codes it

Re-run as a fourth method, written from scratch rather than reusing this file's code, with the same four
entry points and the same relative-import walk. Result, identical:

```text
src modules: 92   reachable: 78   unreachable: 14
src/core:    35   unreachable in core: 12
additionally unreachable: adapters/loop-pi-agent-core.ts, adapters/loop-scripted.ts
```

So the allow-list M0 starts with is these 12, and the two adapters are the 13th and 14th entries outside
`src/core`. **The count is now confirmed by two independent implementations rather than carried forward.**

**A trap the re-derivation hit, and that M0's test must not fall into.** The first attempt reported *24*
unreachable modules in `src/core` and 102 reachable ones out of 92 - impossible, and the impossibility is what
caught it. The cause: `pathlib` collapses `.` in a path but **not** `..`, so `src/core/../x.ts` became a
second, phantom node key, and every real module that was reached through a `../` specifier (including
`evidence-sarif.ts`, `capability-runtime.ts` and `task-convergence.ts`) looked unreachable.

```text
naive walk   -> 24 unreachable, and the extra 12 are all false positives
normalized   -> 12 unreachable, matching this file
exit status  -> the same in both cases, exit 0
```

**A reachability test that does not normalize `..` fails loudly here, but the general form is worse: it
reports a plausible larger number.** M0's test must normalize the resolved path, and must assert the
reachable count as well as the unreachable set - a test whose only assertion is "this list is empty" cannot
tell a broken walk from a clean tree. This is the same class as the trailing-`?` catalog defects in
`09-26-dove-code-audit-vertical`: a check that reports clean because it never looked.

## The 12 unreachable modules, and why the list matters

```text
loop.ts               loop-runner.ts        the loop and its reference implementation
gate-limit.ts         gate-conformance.ts   both gate semantics
work-mode.ts                                the declarative mode loader
authority.ts                                the grant graph
capability-scope.ts                         typed capabilities outside model context
effect-ledger.ts                            effect identity and exactly-once
checkpoint.ts                               action-boundary checkpoints
context-admission.ts                        the admission boundary
dispatcher.ts         dispatch-policy.ts    (pre-existing, from before this work)
```

**These are not a random sample.** They are the layers designed by tasks `09-25-dove-base-agent-framework`
and `09-26-dove-code-audit-vertical`. In other words: **the framework work of the last two tasks is the
part nothing reaches.**

## The loop is a closed island

`loop.ts` has five referrers, and **every one of them is itself unreachable**:

```text
adapters/loop-pi-agent-core.ts    unreachable
adapters/loop-scripted.ts         unreachable
core/gate-conformance.ts          unreachable
core/gate-limit.ts                unreachable
core/loop-runner.ts               unreachable
```

Five files that reference each other and are reached from nowhere. The Pi adapter built in `09-25` is
inside the island too.

## What IS reached, and how

```text
core/task-convergence.ts   extension.ts -> core/task-convergence.ts
core/subagent.ts           cli.ts -> pi-adapter/subagent-provider.ts -> core/subagent.ts
core/capability-runtime.ts extension.ts -> capability-invocation.ts -> fast-path.ts -> capability-runtime.ts
core/evidence-sarif.ts     extension.ts -> runtime.ts -> capabilities/code-audit.ts -> core/evidence-sarif.ts
```

Note the fourth line. The evidence plane is reached **through the audit vertical** - the thing `09-26` built
is better wired than the framework it was built on.

## The three disagreeing answers, kept

| Method | Answer | Where it is wrong |
|---|---|---|
| string search for `core/<name>` in `src/` | "9 modules are test-only" | misses transitive reachability entirely |
| sub-agent textual reference count | "8 modules are orphaned", including `task-convergence.ts` and `subagent.ts` | those two ARE reachable, through `extension.ts` and `cli.ts`; a textual count cannot tell "referenced" from "reached" |
| **transitive reachability from entry points (this file)** | **12 unreachable, and they are exactly the recent framework layer** | says nothing about whether a module is *useful*, only whether it can execute |

## The Trellis side is wired, and this is the contrast that matters

`.codex/hooks.json` registers two hooks - `UserPromptSubmit` -> `inject-workflow-state.py` and
`SubagentStart` -> `inject-subagent-context.py` - and their effects are visible on disk: the session file
`.trellis/.runtime/sessions/dove-pi-workspace.json` and every task artefact were written by them during
this session.

So the repository has **one harness that runs** (Trellis: taskification, context injection, specs, journal,
subagents, PRD planning, post-mortems) and **one layer that does not** (`src/core`'s 12), and the user's
nine requested capabilities are closer to the first than to the second.

## What this does not establish

- Whether the 12 are *worth* wiring. Reachability is not value.
- Whether any of them is reachable at runtime by a path this static walk cannot see (dynamic import,
  string-built specifier). None was found, but the walk only reads static `from` clauses.
- Whether `.trellis`'s nine are well implemented. That they run is established; that they are good is not.
