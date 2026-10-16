# The host version is read silently, and says nothing when it cannot be read

## Goal

`getPiVersion()` (`src/pi-adapter/host-version.ts:8`) answers one question - which Pi build is this - and the product
reads that answer as identity. Measured 2026-10-17 against Pi `1.0.0`: when it **cannot** answer, it returns the string
`unknown` and says nothing else at all - no warning, no log line, no record, no refusal.

## Background (measured 2026-10-17)

- **The success path, run rather than read**: in this repository `getPiVersion()` returns `"1.0.0"`.
- **The failure path, run rather than inferred.** `host-version.ts` depends only on node builtins, so it was copied
  verbatim into a directory whose every ancestor holds no
  `node_modules/@earendil-works/pi-coding-agent/package.json` and run with this repository's own tsx:
  `RETURNED "unknown"` - **one line of output**, no warning, no log, no throw.
- **Why the failure is reachable.** The first path walks up from the module's own directory looking for the host's
  `package.json` (`:21`-`:33`); the fallback `require("@earendil-works/pi-coding-agent")` (`:15`) throws in 1.0, because
  that package's `exports` map no longer offers a main entry. Any layout where the upward search fails - a different
  install shape, a bundled copy - lands on the silent `unknown`.
- **Nothing holds it.** **0** files under `tests/` and `scripts/` mention `getPiVersion` or the `host-version` module.

**User value.** A control that reads as a control while answering nothing is the class this repository has cleared
twice. A reader of a record saying `unknown` cannot separate "the host is older than the field" from "the reading is
broken", and neither can any consumer that branches on the value.

## Requirements

- **R1** A version that **could not be read** must be distinguishable from a version that is genuinely unknown to the
  product, and the difference must be visible without opening this file.
- **R2** The behaviour when the read fails is one of *refuse*, *warn* or *record*. Silent degradation is the defect;
  which of the three is chosen is this task's decision to state, not to leave implicit.
- **R3** Whatever is chosen, the text names the cause the code can actually check - the search that failed and where it
  looked - rather than a cause that reads well.
- **R4** **Zero behaviour change on the success path**: with a readable host package the returned value is unchanged.

## Acceptance Criteria

- [x] **AC-1** The states are distinguishable **by measurement**, not by inspection. **Amended while implementing:** the
      clause first named the third state as *a host older than a field the product reads*, which this reading cannot see
      at all - that is a missing-API failure belonging to whatever reads the field, not to the version reader. The
      third state that this code can actually tell apart is *found, and its manifest carries no `version`*.
      Measured in `tests/host-version.test.ts`: a readable host (`unreadable: false`, a real version, `foundAt` set, and
      the last path tried equal to the file read); a host that cannot be found (`unreadable: true`, `foundAt` undefined,
      `searched` non-empty); and a manifest that was found and declares nothing (`unreadable: false`, `version:
      "unknown"`, `foundAt` under the fixture) - which is the distinction the old single word collapsed.
- [x] **AC-2** A case holds the failure path. Measured before this task: **0** files under `tests/` or `scripts/` named
      `getPiVersion` or the module, so the silent `"unknown"` was reintroducible without a red. Now:
      `tests/host-version.test.ts`, two cases, both passing. It states what it does **not** hold - the fallback
      `require` path, and any opinion about which version the host should be - and it asserts the precondition its
      unreadable case needs (that no directory above the temp root holds a host package) rather than assuming it.
- [x] **AC-3** The failure is visible where a reader would look, naming what was searched. `readPiVersion` carries
      `searched`, `describePiVersionFailure` builds the sentence from it, and `pi.on("session_start")` in
      `src/pi-adapter/extension.ts` notifies once per session when `unreadable` - the same place the keepalive warning
      already reports. The sentence names the paths walked rather than claiming the host is missing, because the walk is
      what this code can check.
- [x] **AC-4** Gates: re-run after the module, the case and the session-start warning: `npm run typecheck` exit 0,
      `npm test` **1001 pass / 0 fail** (999 before, plus this file's two cases), `npm run test:installer` OK, and the
      task-artifact corpus at 0 problems. The citation door this edit turned red - **16 of 18** mount points, the two
      above the insertion having not moved - is green again at 4 pass / 0 fail after the repoint.

## Out of Scope

- Changing which host version this repository pins to.
- Any change to how the version is *displayed* in the status line.
- Support for a host whose package layout this task has not measured.
