# Action names a mode declares that nothing can produce

## Goal

Measured: code-development's source.read/source.write and code-audit's repo.read/report.write appear only in their own files, are not in the capability registry and are not host tools, so they grant nothing; a capability call using them is refused by the registered check. The spec documents the mode-authorizes-versus-build-implements gap, so this is shared doctrine - the open question is whether a mode's own action names should be declared somewhere the loader resolves.

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
