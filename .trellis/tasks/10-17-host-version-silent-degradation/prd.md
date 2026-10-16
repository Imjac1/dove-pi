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

- [ ] **AC-1** The states are distinguishable **by measurement**, not by inspection: a readable host, an unreadable host,
      and a host older than a field the product reads.
- [ ] **AC-2** A case holds the failure path. Today nothing does: no file under `tests/` or `scripts/` names
      `getPiVersion` or the module, so this defect can be reintroduced without a red.
- [ ] **AC-3** The failure is visible where a reader would look - the warning, the log or the record - and the sentence
      it carries names what was searched.
- [ ] **AC-4** Gates: `npm run typecheck` clean, `npm test` 0 fail, `npm run test:installer` OK.

## Out of Scope

- Changing which host version this repository pins to.
- Any change to how the version is *displayed* in the status line.
- Support for a host whose package layout this task has not measured.
