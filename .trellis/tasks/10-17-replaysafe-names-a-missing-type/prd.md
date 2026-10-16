# replaySafe names a host type that does not exist: the comment should name the declaration we have

## Goal

`src/core/invocation-disposition.ts:19` says the field `replaySafe` is *"named after what `pi-agent-core` calls it
(`HarnessTool.replay: "never" | "safe"`)"*, and gives the reason the vocabulary was borrowed: a future Pi version would
persist a per-invocation record of the same kind this repository keeps, so adopting the host's word later would be a
replacement rather than a rewrite.

**The host type that sentence names does not exist.** Searched 2026-10-17 across all four installed `@earendil-works`
packages at `1.0.0` - `pi-agent-core`, `pi-coding-agent`, `pi-tui`, `pi-ai` - for `HarnessTool` and `replaySafe` in every
`.d.ts`, `.js`, `.mjs`, `.md` and `.json`: **0 files**. In `pi-agent-core` the string `harness` does not occur at all
(**0 files**), so the stub that sentence describes has not changed shape - it is gone. The 2026-10-03 measurement had
already recorded that the borrowed vocabulary had no support in the pinned `0.84.3` and that the accurate statement was
*"declared in the stub harness"*; 1.0 removes the declaration too, which leaves the sentence naming a type no installed
host has. In this repository `HarnessTool` occurs **once**, in that comment.

**User value.** A reader arrives at this comment to learn why the field is not called `idempotent`, and leaves believing
the repository is holding a place open for a host concept. There is no such concept to hold a place for. This is the class
this repository keeps finding - a declaration that stopped being true - and it sits in a file whose whole subject is
dispositions.

## Requirements

- **R1** The comment states the name's **source**, and that source must be a declaration that exists. The one in hand is
  this repository's own: `DECLARED_TOOLS` at `src/core/invocation-disposition.ts:51`, whose entries carry `replaySafe`
  per tool.
- **R2** The sentence about a **future** host version either goes, or is rewritten so it cannot be read as a fact about
  the installed host. The measurement above is what a rewritten sentence has to be consistent with.
- **R3** **No behaviour change.** This is a comment: the field, `InvocationClassification` at `:38`, `DECLARED_TOOLS` and
  every call site stay exactly as they are.

## Acceptance Criteria

- [x] **AC-1** The comment names a declaration that exists in this repository, and `HarnessTool` is never presented as
      something the host has. **Amended in two places while implementing, both recorded rather than quietly moved:**
      (i) the AC first asked for a `file:line`, and pinning one inside a source comment would reproduce the sibling
      defect this task family is about - `work-mode.ts:303` cites a path that stopped existing - because no door walks
      line numbers inside a comment; the paragraph names `DECLARED_TOOLS` instead. (ii) `HarnessTool` survives **twice**
      under `src/`, both inside the paragraph that records it as absent from the installed host, because a correction has
      to name what it corrects and a search for the name should land on the paragraph that settles it.
- [x] **AC-2** No sentence in the file claims a host vocabulary the installed packages do not carry; the 1.0
      measurement is cited. Measured: the paragraph carries the search, its date, the version, and what was not found.
- [x] **AC-3** **Zero behaviour change**, shown rather than stated: the diff is 12 insertions and 4 deletions, all
      inside the file's opening comment block - checked by filtering the unified diff for any changed line that is not a
      comment line, which found none.
- [x] **AC-4** Gates: `npm run typecheck` clean, `npm test` 0 fail, `npm run test:installer` OK. All three re-run after
      the edit: typecheck exit 0, the suite `fail 0`, the installer `OK`, and the task-artifact corpus at 0 problems.

## Out of Scope

- Renaming the field, or the `readOnly` / `replaySafe` / `network` trio it belongs to.
- Any behaviour change in `src/core/invocation-disposition.ts`, including its name table.
- Whether the host will ever carry such a concept: not this task's question, and not answerable from this machine.
