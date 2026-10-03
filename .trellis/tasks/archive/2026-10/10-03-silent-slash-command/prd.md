# A slash command in a non-interactive prompt is swallowed, exiting zero

## Goal

Measured: pi -p --mode json /status exits 0 with a single session event and no output, so a script that drives the product with a slash command looks like it worked and did nothing.

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
