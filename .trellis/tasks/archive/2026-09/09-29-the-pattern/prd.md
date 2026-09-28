# The pattern, counted, and the list emptied

## Goal

Count how often the session drew a conclusion about a machine it had not measured, and work through what remains of that list.

## Background: three falsifications in four rounds

```text
round 134   the timeout firing was made checkable rather than declared unreachable
round 142   the fallback was declared not checkable from outside, and round 152 falsified it
round 154   update --check was declined for a network that exists
```

**Three times in four rounds the reason for not doing something was a claim about the machine.** So the pattern is worth counting in the
record rather than in memory, and the remaining candidates are worth working through one by one.

## Requirements

- **R1 - Count the pattern in the record**, by the phrases the session used for it.
- **R2 - List what remains of the can-not-be-done conclusions**, and classify each as tested or untested.
- **R3 - Test any that is untested and cheap.**
- **R4 - Say plainly whether the list is empty.**
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The pattern is counted from the record.
- [x] **AC2** The remaining conclusions are listed with a classification.
- [x] **AC3** Any untested one that is cheap is tested.
- [x] **AC4** Whether the list is empty is stated plainly.
- [x] **AC5** The gate passes.

## Out of scope

- **A conclusion restated instead of tested.**
- **Changing the machine.**