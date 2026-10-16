# Implementation: bump, replay, tag, verify

## Before `task.py start`

- [ ] Curate the manifests with **spec/research documents only** - the loader refuses code paths. The page that matters
      here is `.trellis/spec/backend/personal-agent-managed-install.md`, because this child's first reading is what an
      install says it is, and its acceptance is what a user's launcher fetches. `implement.jsonl` also takes
      `.trellis/spec/backend/quality-guidelines.md` for the discipline the local replay follows; `check.jsonl` takes the
      managed-install page, so the verifier can judge the identity claims without me paraphrasing them.
      The readiness script and the workflow file are read directly during the work - they are code, and they do not
      belong in a manifest.

## Done when

- [ ] The bump touches only `package.json` and the two version fields in `package-lock.json`, and the commit contains
      nothing else.
- [ ] The local replay passes: typecheck, `npm test`, `test:installer`, `pi:smoke`, the readme/document doors, the
      corpus lint, and then `release:check` with the tag name, the commit, the manifest, the archive, the checksum and the
      four assets.
- [ ] `v0.2.4` is pushed and `windows-release` is green - or, if it is red in the parallel-batch case, that is recorded
      and the tag is left where it is.
- [ ] `gh release list` shows `v0.2.4` as **Latest** with four assets.
- [ ] The four fixes are proved to be **in** the release, by ancestry rather than by reading: `git merge-base --is-ancestor
      <sha> v0.2.4` for `80e4dad`, `f528375`, `d40f9b5`, `6eaffdb`.
- [ ] The user-facing URL serves it: `releases/latest/download/install.ps1` with a status and a size matching the tree's.

## Ordered checklist

1. Bump `package.json`'s `version` to `0.2.4` and the two version fields at the top of `package-lock.json`. Commit with a
   message that says which four commits this release carries and why.
2. Run the gates **in the job's order**: `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run pi:smoke`,
   `node scripts/task-artifact-lint.mjs --assert-corpus`, then the four documentation doors.
3. Build the manifest (`npm run release:manifest`), assemble the archive exactly as the job does, write the checksum, and
   run `release:check` with the tag name, the HEAD commit, the manifest, the archive, the checksum and the four assets.
   **A failure here stops the work**; there is no tag yet, which is the point.
4. Tag `v0.2.4` with a message naming the four fixes, push the commit and the tag, and watch `windows-release`.
5. Read back what a user gets: `gh release list`, the tag's ancestry checks, and the URL. Then record the release's
   `releaseId` in `findings.md` - the reading child needs it, because a pass is only about the build it ran on.

## Validation

- The ancestry checks are the acceptance criterion for "the four fixes are in": four `git merge-base --is-ancestor`
  invocations, each of which must exit 0.
- The URL check is the acceptance criterion for "what users get": a status code and a byte count, not an assumption.
- The CI rule is checked by reading the failing job's **case name**, not by reading the colour of the run.

## Risky files and rollback

- `package.json` and `package-lock.json`: two fields each, revertible until the tag is pushed.
- After the tag: nothing is reverted. A wrong version is superseded by the next one, and the design says why rather than
  pretending a rollback exists.

## Follow-up checks before `task.py start`

- [ ] The manifests are curated (a verifier is dispatched for this child).
- [ ] The parent's requirement R4 - the final judgement is the user-facing command - is answered by a real fetch, not by
      the local archive.
