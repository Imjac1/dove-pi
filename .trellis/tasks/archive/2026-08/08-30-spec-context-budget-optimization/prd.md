# Optimize Trellis specification context budget

## Goal

Ensure every implementation/check agent receives complete, relevant Dove runtime contracts instead of a silently truncated prefix, while preserving all existing executable guidance and avoiding a larger default prompt budget.

## Background

- `.trellis/spec/backend/personal-agent-runtime.md` is approximately 68 KB.
- Trellis defaults `context_injection.max_file_bytes` to 32,768 bytes and truncates oversized referenced files with a warning.
- The file currently contains the root runtime/adapter/request contract plus ten independently routable scenarios. Individual sections range from roughly 1 KB to 12 KB, so topic-level files can remain comfortably below the cap.
- Historical memory search found no earlier decision that conflicts with this split.

## Requirements

- Replace the monolithic runtime spec with a compact routing document and topic-specific code-spec files.
- Preserve every existing contract, signature, validation rule, example, test requirement, and design decision without semantic rewriting during the move.
- Group scenarios by implementation ownership so task manifests can inject only the relevant topic file.
- Keep every routed runtime spec below the 32,768-byte per-file default with useful headroom; target 24 KB maximum.
- Update all active task `implement.jsonl` and `check.jsonl` references that point at the monolith.
- Add a deterministic local regression check that fails when a routed spec exceeds the chosen project budget, the router references a missing file, or the monolith regrows executable scenario bodies.
- Keep the global Trellis context limits unchanged; increasing `max_file_bytes` is not a solution.
- Do not change Dove runtime behavior, public APIs, installer behavior, or Pi extension behavior.

## Acceptance Criteria

- [x] `personal-agent-runtime.md` is a concise index/router and is below 8 KB.
- [x] Every routed runtime code-spec is below 24 KB and therefore below Trellis' 32 KB injection cap.
- [x] The aggregate split content preserves all original top-level runtime sections and scenario headings.
- [x] Active task context manifests reference the smallest relevant routed specs and `task.py validate` emits no oversized-file warnings.
- [x] A checked-in automated test detects missing router targets, files above the project budget, and a regrown monolith.
- [x] Existing Node, installer, doctor, Pi smoke, and diff checks remain green.

## Out of Scope

- Raising global context or model token limits.
- Rewriting product requirements or deleting contracts for brevity.
- Splitting unrelated guides/specs that are already within budget.
- Changing normal end-user system prompts or provider request budgeting.
