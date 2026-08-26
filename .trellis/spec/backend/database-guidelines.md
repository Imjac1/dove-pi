# Database Guidelines

## Overview

The first release has no database or ORM. Project-management data belongs to Trellis files, while Dove execution records are append-only local JSONL/artifacts. Do not introduce a second task/spec database as a fallback.

## Query Patterns

- Read project state through the normalized `ProjectProvider` interface.
- Use provider revisions, file hashes, and mtimes to invalidate stale projections.
- Keep raw provider output outside model context; pass normalized records and source references.

## Migrations

Trellis template migrations are delegated to the official Trellis `update` behavior. Dove must snapshot first, surface conflicts and `.new` sidecars, and never silently overwrite user-modified files.

## Naming Conventions

Use `taskId`, `stepId`, `executionId`, `dispatchId`, `providerRevision`, and `artifactRefs` consistently. Provider IDs are opaque strings and must not be converted into local numeric IDs.

## Common Mistakes

- Adding an in-memory or SQLite mirror of Trellis tasks.
- Treating a provider revision as a Pi session ID.
- Writing `.trellis` files directly from an adapter consumer.
