# A citation range whose end precedes its start is refused

## Goal

The citation door's floor is "a reader can follow it": a cited path must resolve and a cited line must exist. A
**range** is a citation too, and today it is the weakest one on the page - in the form the pages actually use,
its second number is not checked at all, and in neither form is the pair required to run forwards.

**User value.** A page that says "the numbers live at `file.ts:3610-3620`" is read by a person who then looks at
that file. A range that runs backwards is unfollowable, and nothing catches it: measured 2026-10-17, a repoint
script of mine shifted a range's start and not its end, leaving `3681-3620` - a citation that resolves, lands
inside the file, and is nonsense. It was found by reading the result, and the tree's own citation door was green
throughout.

## Background (all measured 2026-10-17 on this tree)

- **The pages write ranges in one code span.** 78 of the 79 ranges are `path:N-M` inside a single code mark. The
  door's `ANCHOR` matches only the `path:N` part of that, so **`M` is never turned into a claim** - it is not
  checked for existence, and not for order. A citation reading `path:3642-99999` passes today.
- **One range uses the other spelling**, `path:N`-`:M`. There the door's `CONTINUATION` does match, both numbers
  become claims, and both are existence-checked - but the pair is still not required to be ordered.
- **The defect that motivated this**, recorded in `AGENTS.md`'s mirror-tax note: nine prose citations were
  repointed by hand because an edit moved the lines of a file they cite. One was a range, and the first repoint
  script shifted only its start.
- **A rule this task must not break: the bare-continuation form is a list, not a range.** `` `src/cli.ts:388` `` and
  `` `:399` `` mean *two lines of the same file*, in no order, and the pages use it that way: one specification cites
  a base of `:958` with a continuation of `:42`, which is correct and decreasing. So the ordering requirement
  applies to the single-span `N-M` form **only**; requiring order of a continuation pair would report the real
  pages as broken, which is the false-finding failure this file's own header says to avoid. Found by reading the
  six lines that use the form, before writing the check.

- **What the door's header already says it will not do**, and this task does not change: judging whether a cited
  line still *says* what the page claims needs the pages to state one claim per citation, which is a change to the
  pages rather than to the check.

## Requirements

- **R1 A single-span range contributes a claim for both of its numbers**, so its end is existence-checked exactly
  like any other cited line - which closes the larger of the two gaps and was not the defect that motivated the
  task.
- **R2 A single-span range whose end precedes its start is a finding**, naming both numbers. The check is scoped to
  that form because the continuation form is a list and its pairs are legitimately unordered.
- **R3 The proof that the check can fail is a fixture**, not a wrong citation written into a page: the file's own
  convention, because changing the evidence in order to check it is the defect this repository keeps finding.
- **R4 No false finding.** A forwards range, a continuation pair that decreases, and every citation on the real
  pages stay clean. A check with false findings is a check people turn off, which the header says in its own words.

## Acceptance Criteria

- [ ] A single-span range's end is existence-checked: a fixture citing an end past the file's last line is
      reported, where today only the start would be.
- [ ] A single-span range whose end precedes its start is reported, with a problem sentence naming both numbers.
- [ ] A forwards range is accepted, **and a continuation pair that decreases is accepted**, asserted on the fixture
      beside the failing case - the boundary this task must not cross.
- [ ] The file's header states the third property the door judges, so it does not stop describing the file.
- [ ] The door over the real pages stays green: **78 single-span ranges and 1 two-code-mark range, 0 findings**,
      and the citation count it reports does not fall.
- [ ] `npm test` is green.

## Out of Scope

- **Whether a cited line still says what the page claims.** The header explains why that cannot be judged without
  changing the pages, and this task keeps that boundary where it is.
- **Repointing anything.** The tree holds no backwards range today; this change is a door, not a repair.
- **The mount table or the `file:line` citations in source comments.** The mount table has its own case; source
  comments carry the live line numbers this repository deliberately keeps out of the specification pages.
