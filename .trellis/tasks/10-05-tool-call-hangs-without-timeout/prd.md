# A tool call can hang forever, and the shell timeout only covers a whitelist

## Goal

Measured on a real project: a bash tool call started at 19:08:37.113 and never returned; the event stream recorded nothing for six minutes thirty-three seconds, stderr was zero bytes, and only the outer nine-hundred-second watchdog ended the run with harness_timeout. The harness does set a two-hundred-forty-second timeout, but applyAdaptiveShellTimeout applies it only when the command matches a whitelist regex - go test, npm test, pytest, cargo test and the like - and its own comment says ordinary commands are untouched because the Pi bash tool intentionally has no default timeout. So any long command outside that list has no protection at all, and the agent debugging a caching question is exactly the case that runs one. The design question the task holds: widen the list, make the timeout default and let the list only shorten it, or record the absence so a reading can tell a hang from slowness.

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
