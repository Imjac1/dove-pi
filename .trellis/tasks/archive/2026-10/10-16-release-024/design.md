# Design: a version bump, a tag, and one rule for a red run

## Boundary

This child edits **two files**: `package.json`'s version and the two version fields in `package-lock.json`. Nothing else.
Everything that looks like a version in this repository is deliberately not the package's:

- `modes/*/governance.yaml` declares the framework range `>=0.2.0 <0.3.0`, which a 0.2.4 does not leave;
- `src/capabilities/code-audit.ts` carries the **capability** protocol version, which moves when that capability's
  arguments move, not when the package does.

The tag name must equal the package version, so the bump is the first step and cannot be skipped by tagging hard.

## Sequence, and why each step is where it is

1. Bump, commit. The repository is clean at this point, so the tag will name a commit that contains only the bump.
2. Gates in the **release job's** order, because the point of the local replay is to predict that job.
3. Assemble the archive and run `release:check` **before the tag exists**. This is the whole reason the step is here: the
   check is the only thing standing between a mistake and an immutable release, and it is worthless once a tag exists.
4. Tag, push, watch `windows-release`. Then read what a user's command serves.

## The rule for a red run, mechanically

The failure this repository has actually seen is `test (locked)` going red in `keeps every child of a parallel batch
visible while the batch is in flight`, which is a 600 ms sleep losing a race on a slower runner. So the check after the
push is specific rather than general: read the job, and if the failing case is that one, the red belongs to the gate child
and **the tag does not move**. Moving it would rewrite what was pushed, which is the one thing a tag must not do; a
mistake in the version itself is fixed by the next version, not by editing history.

A red run for any **other** reason is not covered by this rule and stops the child for a look, because this design only
has an answer for the failure that has been measured.

## Rollback position

There is none, and that is deliberate rather than overlooked: a published release is not rolled back, it is superseded.
What the design does instead is front-load the two steps that can still stop it - the local replay and the readiness check
- and keep the version bump small enough that a wrong one costs a patch release rather than a cleanup.

## Trade-offs

- **Shipping before the gate is trustworthy** means CI may go red on the shipping commit for a reason unrelated to it. The
  operator chose this order because users are two releases behind; the rule above is what keeps the red from becoming a
  rewritten tag.
- **Verifying "the four fixes are in" by ancestry** rather than by reading the archive's contents is cheaper and harder to
  fake, but it proves inclusion, not correctness. Correctness is the gate child's and the reading child's job, and the
  parent's integration review reads all three together.
