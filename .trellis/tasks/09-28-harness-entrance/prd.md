# The harness gets an entrance

## Goal

Give a newcomer one file that answers "where is this harness documented", because the measurements say nothing does today.

## Correction: the index exists, and it is stale

**My first measurement was wrong, and the truth is more precise than the claim.** I listed `.trellis/*.md` and `.trellis/spec/*.md`
and concluded that the specs directory has no index. It does: `.trellis/spec/backend/index.md`, 46 lines, with a table of the
personal-agent specifications - **and the table is stale**. Measured against the files on disk, it is missing three of them:

```text
personal-agent-mode-format.md
personal-agent-harness-loop.md          <- the loop itself
personal-agent-convergence-record.md    <- the convergence record
```

**So the entrance to the documentation does not lead to the loop** - which was the finding all along, with a different cause than the
one I first wrote down. That is the fourth measurement mistake in four rounds and the fourth that was mine, and it is the reason the
fix below is a **check** rather than an edit: an index that can drift silently is the defect, and an edit only repairs one instance of
it.

## Background: the chain, measured

```text
repo root -> README.md          25 KB, user-facing, mentions the word harness once - in a test-runner context, unrelated to the loop
          -> AGENTS.md          21 lines, every one inside the Trellis-managed block, with generic pointers
          -> .trellis/spec/     a directory with no index file; the specs live under backend/ and frontend/
```

So a person who lands on the repository and wants to know what this harness is, what it measures, how a turn runs, or what was
decided about its boundaries has **no single answer** - and the artifacts that answer it all exist, in three places under
`.trellis/`.

**Why this is worth a round rather than a shrug**: this project own rule is that a declaration nobody can find is a file rather than
a contract. The loop has a guide, a declaration, four readings and a set of boundary decisions; a newcomer finding them by browsing
is the same defect in a different medium.

## Requirements

- **R1 - One index at `.trellis/spec/README.md`**, answering what the harness measures, where the contracts are, how a turn runs,
  and what was decided - in about a screen, with links.
- **R2 - It does not duplicate the router.** `backend/personal-agent-runtime.md` already routes the coding specifications by
  subject; the index points at it rather than restating it, and says so.
- **R3 - It is an index, not a contract.** It says that in its own first lines: no budget applies to it, and nothing enforces its
  content - which is why its **links** are what must be true.
- **R4 - Every link resolves**, checked by a test: a broken link in an entrance is worse than no entrance, because it teaches a
  newcomer that the documentation is stale.
- **R5 - `AGENTS.md` gains a pointer outside the managed block**, in the two-line user area the Trellis block leaves intact, so the
  block being refreshed never removes it.

## Acceptance Criteria

- [ ] **AC1** `.trellis/spec/README.md` exists, says it is an index, and points at the router, the guides, the declaration, the
      readings and the boundary decisions.
- [ ] **AC2** Each of those pointers names a real file, verified by the test rather than by reading.
- [ ] **AC3** `AGENTS.md` has the pointer outside the managed block, in the area its own comment says is preserved.
- [ ] **AC4** The check lives in the file that already checks what documents name, states what it does and does not cover, and
      passes.
- [ ] **AC5** The gate passes: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Out of scope

- **Rewriting the README.** It is the product entrance, and the harness is development knowledge: one pointer is the right size.
- **Moving the specs.** Their home is `.trellis/spec/` and the router already organises them.
- **A second copy of the router table**, which is the duplication R2 exists to avoid.