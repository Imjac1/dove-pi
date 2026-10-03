# A mode's prerequisites are only discovered by being refused

## Goal

Measured: pentest refuses to run twice - DOVE_PI_FRAMEWORK_VERSION unset, and the engagement document it names not resolvable in the workspace. Both are correct fail-closed behaviour and both are invisible before the error; doctor lists machine tools (nmap and hydra null here) without connecting them to a mode that needs them.

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
