# Quality Guidelines

## Overview

The terminal UI is verified through adapter smoke tests and command/tool behavior tests rather than browser snapshots.

## Forbidden Patterns

- Keyboard-inaccessible features.
- Color-only status meaning.
- A second status renderer collecting duplicate Pi/provider telemetry.
- UI callbacks that mutate Trellis files or execute arbitrary shell text.

## Required Patterns

- Provide command equivalents for shortcuts.
- Show degraded provider and approval states in plain text.
- Keep status refresh near 1 Hz except for critical transitions.
- Preserve Pi's native model picker and exit controls.

## Testing Requirements

Run `npm run pi:smoke` plus the full TypeScript test suite for changes that affect commands, tools, mode, provider status, or status rendering.

## Code Review Checklist

- Can the feature be used without Nerd Font or color?
- Is responsibility kept in core/provider rather than UI glue?
- Are exact provider values distinguished from estimates?
- Are command help and README examples updated?
