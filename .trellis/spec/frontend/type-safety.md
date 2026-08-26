# Type Safety

## Overview

TypeScript is used throughout the core and Pi adapter with `strict` compilation. Host payloads and provider documents are normalized at their boundaries.

## Type Organization

Cross-layer contracts live in `src/core/contracts.ts`; provider contracts live under `src/project-provider`; Pi-specific types stay in `src/pi-adapter`.

## Validation

Use TypeBox schemas where a Pi tool or external payload needs runtime validation. Treat Trellis Markdown/JSON as project data and preserve source labels when injecting it into context.

## Common Patterns

- Prefer discriminated unions for event kinds and route decisions.
- Use type guards for unknown JSON values.
- Use opaque strings for provider/task/execution IDs.
- Accept only `fast`, `standard`, and `ultra` in Dove mode contracts; Pi thinking levels and extension profiles use separate settings.

## Forbidden Patterns

- `any` in public contracts.
- Unchecked casts from Pi or Trellis payloads into core types.
- Reusing one ID field for Pi session, Trellis task, and Dove execution identity.
