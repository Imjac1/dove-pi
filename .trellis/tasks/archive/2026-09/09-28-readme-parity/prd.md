# The two front doors stay in step, which nothing holds

## Goal

Hold the two READMEs to each other structurally, because they are the only pair of user-facing documents in this repository and
nothing connects them.

## Background: the census, and the one thing in it with no guard

Every top-level entry was measured by size, whether the specifications name it, and whether the tests do:

| Entry | Named in the specs | Verdict |
|---|---|---|
| `.trellis`, `tests`, `src`, `.agents`, `installer`, `scripts`, `modes`, `bin`, `.pi` | yes | documented, and mostly tested |
| `.codex`, `.github` | no | tool content and CI configuration |
| `engagements` | no | the authority inputs the mode files name - referenced, just not from a specification |
| `dove_pi.py`, `install.ps1` | no | referenced from the READMEs and the installer tests |
| **`README.md` and `README.en.md`** | no | **two 26 KB front doors, structurally identical, and nothing holds them together** |

**Measured**: both have 31 second- and third-level headings, 33 code fences, 14 table rows and 3 command codes; the headings differ
only by being translations of each other, and the byte counts differ by five percent, which is translation length. **So they are in
step - and the only reason is that whoever writes one remembers the other.**

## Requirements

- **R1 - A check holds the shape**: the two documents have the same heading count, the same code-fence count and the same table size,
  so a section added to one language and not the other is reported.
- **R2 - It states what it cannot do**: it compares shape and not meaning. A section translated badly, or a command changed in one and
  not the other, passes - and the check says so rather than implying it holds the content.
- **R3 - It is seeded**, both ways: a document with one heading more is reported, and two matching documents are not.
- **R4 - The census is recorded** in the task, including that it found no orphan - which is a result about the repository rather than
  about the search.
- **R5 - The gate passes**: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** The check compares the two READMEs and passes on them as they are.
- [ ] **AC2** It is seeded to fail on a missing section and on a missing code block.
- [ ] **AC3** Its limit is in its comment.
- [ ] **AC4** The census table is in the task.
- [ ] **AC5** The gate passes.

## Out of scope

- **Reading them for meaning**, which no check can do.
- **The other front-door documents**, whose paths round 37 already holds.
- **The first real turn**, which needs a Pi host.
