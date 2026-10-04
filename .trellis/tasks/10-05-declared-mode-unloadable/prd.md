# A declared work mode cannot load, because modes/ is not where a run can see it

## Goal

Measured: with .dove/mode.json declaring code-development, the extension reads the declaration and refuses it - workMode=failed, modeRefused: Work mode code-development could not be loaded: missing-file. The declaration is read, so the failure is the directory. The mode root is resolved relative to the working directory, which for a field run is the project being worked on, while this repository's modes/ lives in this repository. A user who declares a mode in their project therefore cannot get one, and nothing says so until the extension's own status line is read. Open question for the design: the runner passes a mode root, the mode directory is located relative to the extension, or the refusal names where it looked.

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
