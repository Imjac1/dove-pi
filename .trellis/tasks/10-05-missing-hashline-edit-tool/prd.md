# The host does not provide the hashline edit tool, and the harness says so but runs on

## Goal

Measured: the extension's own status output prints that the current Pi host does not provide the hashline edit tool, and points the reader at installing it. The agent then worked on a real library without those editing tools, and its single change fixed nothing and broke a test that had been passing. The harness knows and states the fact, and continues, so the session looks the same from the outside as one that had the tools. Open question for the design: refuse the session, degrade with the degradation recorded where the reading will show it, or treat the tool as optional and say why.

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
