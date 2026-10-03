# The black-box evidence record stopped reporting the system-prompt size

## Goal

Measured on Pi 1.0.0: inside a provider-evidence record that still exists and still reports a positive message size, systemPromptChars is no longer positive. Root cause not located - the collector may itself be losing the field silently.

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
