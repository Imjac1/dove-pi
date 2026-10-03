# The likeliest way to write .dove/mode.json on Windows breaks it

## Goal

Measured: PowerShell 5.1 Set-Content -Encoding UTF8 writes ef bb bf, JSON.parse rejects the BOM, and the product correctly reads the declaration as exists-but-unreadable. The schema was right. The trap is that the most natural command on this platform produces a file the product cannot read.

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
