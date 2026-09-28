# The release digest does not cover the mode definitions the runtime loads

## Goal

Make the release integrity claim cover the product content the runtime actually reads.

## Background: the measurement

`build-release-manifest.mts` computes `sourceDigest` by walking a list of roots:

```text
includedRoots = ["bin", "src", "installer", ".pi", "scripts/build-release-manifest.mts", "dove_pi.py",
                 "package.json", "package-lock.json"]
```

**`modes` is not in it, and the runtime reads it:**

| Evidence | Where |
|---|---|
| a mode is a directory of three files, `MODE.md` among them | `src/core/work-mode.ts:12` |
| the code-audit capability reads a catalog under `modes/` | `src/capabilities/code-audit.ts:57` |
| the adapter reports which mode was loaded from `modes/<name>` | `src/pi-adapter/extension.ts:2235` |
| the mode decides what the agent may do | `modes/trading` declares `order.submit`; `modes/pentest` holds the authority rules |

**So two releases whose mode definitions differ can carry the same `sourceDigest`** - and the digest is the manifest own claim about
which source produced the release. A release check that compares digests would pass on a release whose modes were changed, which is the
one part of the tree that decides what the running agent is permitted to do.

**The digest is computed over the roots in the list and nothing else** - `collect` walks only those - so this is a code reading, not an
experiment: `modes` is not walked because it is not named.

## Requirements

- **R1 - `modes` joins the release source roots**, so a mode change changes the digest.
- **R2 - The roots are exported**, so a test can assert what the digest covers rather than reading the file as text.
- **R3 - A test holds the inclusion**, with the reason: the runtime loads `modes/`, so a digest that ignores it does not describe the
  release.
- **R4 - The managed-install specification says what the digest covers and why the mode definitions are in it.**
- **R5 - The gate passes**: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** `modes` is among the exported roots.
- [ ] **AC2** The manifest built here still succeeds and its digest changed from the one built before this round.
- [ ] **AC3** The test asserts the inclusion and names the reason.
- [ ] **AC4** The specification records it.
- [ ] **AC5** The gate passes.

## Out of scope

- **Recomputing published digests**, which is a release decision for whoever owns one.
- **Other roots that might belong** (`.agents`, `.codex`), which are tool and platform files rather than product content.
- **The first real turn**, which needs a Pi host.
