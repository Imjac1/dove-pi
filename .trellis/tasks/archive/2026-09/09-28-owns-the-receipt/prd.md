# Who owns the receipt

## Goal

Hold the six items of the audit vertical required-test list against tests, finding holders by the file that owns the behaviour.

## Background: the lesson from two rounds of pattern misses

The last two rounds found a holder the search could not by asking the **file list** instead of the pattern: the installer list was held by
`managed_installer_test.py`, and a workspace behaviour by `windows-runtime.test.ts`. **Both names were about the layer, not the feature.**

**So this round starts with the file list.** The audit vertical is about a catalog, seeds, families and a receipt; whatever owns those is the
place to look, and the list of six items is the thing to hold.

## Requirements

- **R1 - Ask the file list first**, and say which files look like owners before searching their contents.
- **R2 - Hold each of the six items against a case**, read from a case name or an assertion.
- **R3 - Name any item with no holder**, and say which file was searched before saying so.
- **R4 - Add a holder where an item is testable, unheld and safety-shaped**, and say what it asserts.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The owning files are named before their contents are searched.
- [x] **AC2** Each of the six items is held or named as unmatched.
- [x] **AC3** No item is called unheld on a single failed pattern.
- [x] **AC4** Holders added where warranted.
- [x] **AC5** The gate passes.

## Out of scope

- **The remaining lists**, which stay named as unread.
- **Changing the behaviour the items describe.**
- **The first real turn**, which needs a Pi host.