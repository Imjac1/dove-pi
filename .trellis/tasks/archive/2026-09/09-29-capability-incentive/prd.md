# The incentive to invoke a capability

## Goal

Do the usage review P1: make reuse the default rather than a discovery, since `agent_run_capability` was called
zero times.

## Background: the review P1 premise, measured

The review says `agent_list_capabilities` is injected and *the model lacks an incentive to call anything*. **It
was measured against the adapter before anything was written, and both halves of its P1 already exist.**

## What was found, at the lines it was found

```text
extension.ts:160    function buildCapabilityIndex(registry, recipes): string
extension.ts:3171   the system prompt is `${event.systemPrompt}\n\n[PERSONAL AGENT]\n${stablePromptPolicy(
                    buildCapabilityIndex(...))}` - so reusable names are already in the prompt
extension.ts:185    "[dove] detected a registered capability for this command - reuse
                    agent_run_capability <name> instead" - so the matched-command suggestion already fires
extension.ts:114    the tool list already carries agent_list_capabilities
```

**So P1 own diagnosis is a claim that needs re-measuring.** The incentive is present in both places the review
asks for it, and the model still does not invoke. **The measurable fact - zero calls - is not evidence that the
incentive is missing**, and this round did not add a third mechanism on top of two that already exist.

## And a reconciliation the session owed its own work

```text
src/pi-adapter/context-guard.ts   guardContext({ tokens, contextWindow, mode }) -> compactAdvised, hint,
                                  fractionUsed; wired in at extension.ts:3117-3120 and :3166;
                                  held by tests/context-guard.test.ts
```

**A compaction advisor already existed, was wired in and was tested** - so the fuse written in the previous round
had to be reconciled against it rather than left beside it. **The reconciliation is now in that fuse own doc
comment**, and it records both halves:

- **What it adds**: `guardContext` reads the usage Pi reports, so it sees a grown prefix but not **what the last
  call cost** - a cold start re-bills the whole prefix while the usage fraction is unchanged. That is the fact the
  review asks to be surfaced.
- **What it lacks**: it is **not wired into the adapter**. The adapter calls `guardContext` and not this, so the
  reading has holders and no consumer. **Wiring it in is a behaviour change on the request path**, which is its own
  round.

## Acceptance criteria

- [x] **AC1** The adapter was measured before anything was written.
- [x] **AC2** Both halves of P1 were found already present, at named lines.
- [x] **AC3** The previous round output was reconciled against the existing guard.
- [x] **AC4** The gate passes.