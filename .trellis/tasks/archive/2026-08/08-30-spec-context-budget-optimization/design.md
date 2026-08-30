# Design: Trellis runtime specification context budget

## Architecture

Keep `.trellis/spec/backend/personal-agent-runtime.md` as the stable entry point and route to five ownership-oriented files:

1. `personal-agent-request-runtime.md`: root runtime contract, adapter firewall, request planning, provider budget.
2. `personal-agent-capability-runtime.md`: Capability Protocol, adapters, dispatch calibration, workspace transactions, reusable development capabilities.
3. `personal-agent-project-context.md`: structured Trellis context, project-provider firewall, and skill discovery.
4. `personal-agent-extension-runtime.md`: optional extension profiles/doctor and Dove extension identity/authority.
5. `personal-agent-managed-install.md`: managed installation, release, update, repair, and launcher contracts.

The router contains a short scope table, selection rules, and links. It does not duplicate the full contracts.

## Migration Contract

- Move sections mechanically first; do not summarize them while splitting.
- Preserve heading text and relative order within each destination.
- Add a brief scope/related-spec preamble to each new file.
- Update backend `index.md` and task manifests after files exist.
- Existing links to `personal-agent-runtime.md` remain valid because it remains the canonical router.

## Budget Enforcement

Add a Node test under `tests/` that:

- reads the router and its declared runtime-spec links;
- asserts each target exists;
- asserts the router is at most 8,192 bytes;
- asserts each target is at most 24,576 bytes;
- asserts the router does not contain migrated `## Scenario:` bodies;
- asserts the expected migrated top-level headings are present exactly once across the router and topic files.

The project budget is deliberately below Trellis' default 32,768-byte truncation boundary to leave room for future edits.

## Compatibility and Rollback

- No product code changes are required.
- Old deep links into moved headings may no longer resolve; the router's explicit topic table is the supported replacement.
- Rollback is a documentation-only recombination, but must not be used to bypass the budget test.
- Global `.trellis/config.yaml` injection limits remain untouched.

## Trade-offs

- Five files add navigation overhead, but match existing ownership boundaries and allow task-specific injection.
- A size-only check cannot judge semantic duplication, so the test also checks router shape and heading coverage.
- Mechanical preservation is favored over aggressive editing; content deduplication can be a later reviewed task.
