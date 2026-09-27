# The Harness Scaffold, Made Explicit From The Frontier

## Goal

Take the discipline's own canonical anatomy - the seven subsystems and two cross-cutting surfaces that
`arXiv 2609.00006` derives from a source-code study of eleven production harnesses, **one of which is our host** -
and place this project on it. The output is a defensible position for each subsystem: what we have, what the
frontier's maximal form is, what we deliberately do not have, and which of the gaps are decisions rather than
facts.

The framing this replaces: "the pre-harness era was thinking about how to steer the model; now the harness is the
synthesis of the frontier." That framing has an academic form in the same paper - the **scaffold-capability
frontier** (§15.5) - and its evidence is that structural scaffold transfers across models while prompt prose
regresses. So the question is not whether to build scaffolding; it is *which* scaffolding, and the anatomy says
where the remaining headroom is.

## Background

`research/frontier-anatomy.md` is the paper-side artifact. It was written from fetched sources, not from
recall, and every claim in it is tagged **[FETCHED]** (read from the source) or **[LOCAL]** (read from this
repository). `research/rsi-community-landscape.md` is the community half of the self-improvement subject -
curated lists, a practitioner's definition, framework READMEs, one forum thread - read because D5 and D6 turn on
self-improvement, which is the one subject where the papers and the builders disagree.

The finding that reframes this project's self-image: **Pi is the corpus's only system that documents the absence
of safety infrastructure as a design principle**, and supplies instead two seams - the `tool_call` event with
mutable arguments and a `{block, reason}` veto, and the per-tool `Operations` seam for isolation. This project is
the extension that fills them. So "what should the harness be" has a concrete answer: **we are subsystem 5
(Safety & Permissions) of a Pi-based harness, with parts of 4 (Memory & Context) and 6 (Orchestration)** - and the
host's own reference implementation of our subsystem is about 80 lines of regex-plus-confirm.

## Confirmed facts

All in `research/frontier-anatomy.md`, with sources. The load-bearing ones:

- The seven subsystems and their minimal/maximal forms (§2.3, Table 1).
- Pi's documented security position, quoted in full (§10.8).
- The 29-pattern catalog, audited against us row by row (§13.1, Tables 11-12).
- The scaffold-capability frontier and the AHE ablation (tools +3.3 pp, middleware +2.2 pp, long-term memory
  +5.6 pp, **system prompt alone -2.3 pp**) (§15.5).
- Recommendations 9 (three-mode approval), 10 (OS sandbox + policy-as-code + audit trails), 11 (rules as data,
  with a floor beneath any bypass) and 15-18 (what not to build) (§16.6, §16.9).
- Three papers from the same week measuring what subsystem 5 is for: trace tampering (all tested harnesses but
  one let agents delete their own traces), candidate-generation/release-authority separation, and monitor evasion
  (up to 98% attempts, 88% success, exploiting encoded commands, decomposition across calls, and retry-until-the-
  context-leaves).
- Three inert-declaration classes of our own, with `file:line`: the permission list decides nothing; the
  cumulative constraints are declared and cannot fire; there is no isolation layer.

## Requirements

- **R1** The research artifact states a position for each of the seven subsystems and both cross-cutting surfaces,
  with the source tagged.
- **R2** Every gap named is backed by local evidence (`file:line`) as well as by the frontier's claim, so the two
  cannot drift apart.
- **R3** The decisions that remain are listed as decisions, with the field's evidence on each side - not resolved
  silently in a research file.
- **R4** Nothing is built from this task. It produces the picture; the build tasks are separate and each gets its
  own consent.

## Acceptance Criteria

- [x] **AC1** `research/frontier-anatomy.md` exists and states the anatomy, our position, and the gaps.
- [x] **AC2** Each of the three inert-declaration classes carries a `file:line` anchor and the frontier
      recommendation it violates.
- [x] **AC3** The four open decisions are listed in §7 with the evidence on each side.
- [x] **AC4** What was **not** read is listed, so the artifact's coverage is auditable.

## Open questions (decisions, not facts)

**Consolidated in `decisions.md`, which is the artifact to act on.** Five decisions, each with the field's evidence,
our local state with `file:line`, the options, the cost, the reversibility, a recommendation, and **the cheapest step
that would falsify the recommendation**:

1. **D1 - Isolation.** OS sandbox through the host's seam, content-borne defence, or policy-only? The seam is
   `BashOperations { exec }`, one method, verified locally; the field offers all three strategies with the largest
   system in the corpus choosing content-borne defence and the second-largest choosing policy-only.
2. **D2 - The approval default.** A constant, or declared per mode? Every one of the eleven systems uses a mode, and
   a read-only class is the universal floor. This is the decision `09-27-mode-permission-lists` holds.
3. **D3 - The outer verification loop.** The one named pattern our own synthesis called missing in both layers, with
   an execution oracle rather than a model judge.
4. **D4 - Cumulative enforcement.** The accumulator is empty and three declared constraint fields have no consumer;
   the evasion benchmark says decomposition across calls is the primary tactic.
5. **D5 - The postmortem-to-precondition loop.** Self-Harness's three stages, and StateM's evidence that closing that
   loop is worth ~9 benchmark points. Recommended as the detector half first.

## Out of scope

- Building any of the four. Each is its own task with its own consent.
- Re-deriving the frontier from first principles. The paper did that; this task consumes it.
- The subsystems we occupy only incidentally (1, 2, 3, 7): the host owns them, and the artifact records that
  rather than re-planning them.

## Notes

- The task is a research task: `prd.md` plus `research/`. No `design.md` or `implement.md` until a decision
  above is taken and a build task exists.
- `decisions.md` is the second artifact: the five decisions in a form that can be answered one at a time.
- The artifact supersedes nothing. `09-26-dove-agent-harness-capabilities/research/` was written before this
  paper was in hand and before the same-week papers existed; its own synthesis reached the outer-verification
  conclusion independently, which is corroboration rather than duplication.
