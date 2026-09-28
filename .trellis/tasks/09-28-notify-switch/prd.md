# A toast on every instruction, documented nowhere and impossible to turn off

## Goal

Give the notification extension the switch this repository already knows how to write, and document behavior that ships.

## Background: the measurement

`.pi/extensions/notify.ts` is a Windows toast notifier. Measured:

| Fact | Where it comes from |
|---|---|
| it ships | `scripts/build-release-manifest.mts:69` includes the whole `.pi` root |
| it loads in every session | Pi own docs: `.pi/extensions/*.ts` is auto-discovered |
| it fires on every settled instruction | `pi.on("agent_settled", ...)` with a 1.5 second debounce |
| **it cannot be turned off** | the handler is unconditional: no config, no environment variable, no mode gate |
| **it is documented nowhere** | nothing in `README.md`, nothing in any specification |

**So a user gets a system notification on every instruction, from an extension they were never told about, and has no way to stop it.**
That is the class this project treats as a defect: behavior that exists with no declaration beside it.

**The switch writes itself**: `DOVE_PI_PREFIX_FUSE` is off when it reads `"0"`, `"off"` or `"false"`, and that three-spelling idiom is
already this repository answer to a switch.

## Requirements

- **R1 - The extension reads `DOVE_PI_NOTIFY`**, off for `"0"`, `"off"` or `"false"`, **on by default** so nothing changes for anyone
  who does not set it.
- **R2 - The predicate is a named exported function**, so the spellings are testable without spawning a process or a toast.
- **R3 - The extension header says what the switch is**, where a reader of that file looks.
- **R4 - The specification documents the behavior**: what fires, when, the debounce, and the switch - in the extension runtime
  specification, which owns this subject and had nothing to say about it.
- **R5 - A test covers the spellings and the default**, because an off switch with a wrong spelling is an off switch that does not work.
- **R6 - The gate passes**: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** `notificationsEnabled` is exported and reads the three off spellings plus the default.
- [ ] **AC2** The handler consults it before notifying.
- [ ] **AC3** The file header names the variable and the spellings.
- [ ] **AC4** The extension runtime specification has a contract for the extension, its debounce and its switch.
- [ ] **AC5** The test asserts each spelling and the default.
- [ ] **AC6** The gate passes.

## Out of scope

- **Changing the message text**, which is Chinese in a project whose primary README is Chinese.
- **Choosing a different transport**, which is the extension own and works.
- **The first real turn**, which needs a Pi host.
