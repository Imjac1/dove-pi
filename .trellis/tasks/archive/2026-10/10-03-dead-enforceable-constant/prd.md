# A constant nothing reads, where the refusal actually happens

## Goal

Measured: src/core/work-mode.ts:207 defines ENFORCEABLE_SANDBOX and nothing in the repository references it, while the real load-time refusal of unenforceable sandbox claims lives in src/pi-adapter/extension.ts:2244-2258. A named set that reads as the enforcement point and is not one.

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
