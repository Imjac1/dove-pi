# Implementation: one home for the rule, one enforcement, one case that trips

## Before `task.py start`

- [ ] Curate the manifests with spec/research documents only: `implement.jsonl` wants
      `.trellis/spec/backend/personal-agent-managed-install.md` (what an install is laid down from, which is what the
      archive is for) and `.trellis/spec/backend/personal-agent-field-run.md` (the `__pycache__` leak this defect is the
      shipped version of - it is the page that documents the mechanism). `check.jsonl` wants the field-run page, so the
      verifier judges the leak claim against the repository's own account of it.

## Done when

- [ ] A case is **red first**: point the readiness check at an archive containing `__pycache__`, and it must refuse,
      naming the offending path. It passes today, which is the defect.
- [ ] The assembly helper owns the include list and the exclusion, and both the workflow and a local replay call it -
      the hand-written PowerShell copy of the include list is gone.
- [ ] Rebuilding the archive gives **0** caches where there were 17, and the remaining files are **byte-identical** to
      `git archive <tag>` (the criterion the verifier used: 344 compared, 0 different).
- [ ] `release:check` passes on the cleaned archive, and the scope `sourceDigest` covers now equals the scope the
      archive delivers - or the remaining difference is stated in the task's findings.
- [ ] `npm test`, the four documentation doors, and the corpus lint are green, and `document-drift` resolves the new
      rule row's enforcer.

## Ordered checklist

1. **The case first, and watch it red**: build a throwaway archive that contains a `__pycache__` directory, run the
   readiness check against it, and record that it currently passes.
2. **The assembly helper**: one script owning what goes into `dove-pi-windows.zip` - the include list plus the cache
   exclusion - with its own comment saying why caches are excluded (they embed a builder path and are useless to a
   downloader).
3. **Point the workflow at the helper** and delete its inline zip step; keep the four assets it publishes unchanged.
4. **Add the refusal to the readiness check**, naming the offending path, so a mismatch between the helper and the check
   fails CI loudly rather than silently.
5. **Rebuild and compare**: 17 caches to 0, and every remaining file byte-identical to the tag's tree.
6. **The rule row** in the front door's table, with the new case as its enforcer and a `Fails how` naming what happened:
   an archive whose contents are wider than the manifest that describes them, carrying a builder's absolute path into
   every download.
7. Gates: `npm test`, `spec-anchors`, `document-drift`, `harness-surface`, `spec-context-budget`, corpus lint.

## Validation

- The case is the acceptance criterion: the check must refuse a cache-carrying archive, and it must name the path so the
  reader knows which file to look at.
- The byte-identity comparison is the criterion that the exclusion removed nothing it should not have: 344 files
  compared against `git archive <tag>`, 0 different, with the only additions being the generated `release.json`.
- The workflow change is validated by the next release's job, not by reading the YAML - which is why the check that
  refuses a cache exists: it is the failure that arrives before a user does.

## Risky files and rollback

- The workflow's release step and the readiness script are the two files CI depends on; a mistake in either is visible
  as a red job rather than a bad release, because the check refuses before the tag exists.
- The helper is new, so a mistake there fails the assembly loudly in the first run that uses it.
- Nothing here changes a published artefact: v0.2.3 and v0.2.4 keep their bytes.

## Follow-up checks before `task.py start`

- [ ] Manifests curated (a verifier is dispatched for this child).
- [ ] The parent's map is updated to carry this child, so the integration review knows there are four rather than three.
