# doctor prints raw JSON, and says nothing human about an absent managed install

## Goal

Measured: doctor with no --json flag still prints a JSON wall covering node, platform, shell, workspace, tools, managedInstall and adapters; it reports installed false while help promises update, repair and rollback, and it reports an effective shell of Git Bash on a Windows-first product.

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
