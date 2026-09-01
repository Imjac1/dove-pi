# Database Guidelines

## Overview

The first release has no database or ORM. Compact project goals belong to `.dove/state.json`, while execution records are append-only user-level JSONL/artifacts. Legacy Trellis files are read-only compatibility input.

## Query Patterns

- Read project state through the normalized `ProjectProvider` interface.
- Use provider revisions, file hashes, and mtimes to invalidate stale projections.
- Keep raw provider output outside model context; pass normalized records and source references.

## Migrations

Native state uses a versioned decoder and atomic temp-file rename. Unknown or malformed versions are preserved and reported; legacy project files are never migrated in place.

## Naming Conventions

Use `taskId`, `stepId`, `executionId`, `dispatchId`, `providerRevision`, and `artifactRefs` consistently. Provider IDs are opaque strings and must not be converted into local numeric IDs.

## Common Mistakes

- Adding an in-memory or SQLite mirror of native or legacy goals.
- Treating a provider revision as a Pi session ID.
- Writing `.trellis` files from any Dove runtime path.
