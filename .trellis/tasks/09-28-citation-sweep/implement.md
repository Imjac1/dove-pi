# Implementation plan: citations name a thing, not a position

## Before writing code (and before the sweep)

Load `trellis-before-dev`; read the citation inventory and the contexts of each site. Curate `implement.jsonl` /
`check.jsonl`, and start the task, in this same turn.

## Ordered checklist

- [x] **1. The sweep**, site by site, reading each sentence: file kept, position dropped, sentence still true.
- [x] **2. The two repairs**: `terminalForFailure` in the adapter, and the withdrawn map left as it is with its reason.
- [x] **3. The check** in `tests/document-drift.test.ts`, with both allowances and its stated limit.
- [x] **4. Seed a citation, watch the check fail, remove the seed.**
- [x] **5. The gate**, and a diff review confirming no sentence changed meaning.

## The seed, and the two categories that stayed

```text
seed a citation in src/core/failure-reading.ts -> the check fails with its own sentence
remove the seed                                    -> 5 of 5 pass
```

**The failure was observed before the seed was removed**, which is the only way to know a prohibition is wired.

**Two allowances stayed, named in the check itself**: `types.d.ts` (the Pi host own type file, pinned by version - the two
citations in `action-policy.ts` and `extension.ts` are into it, and the sweep correctly left them alone) and
`scripts/mode-behaviour-map.mts` (the withdrawn map, whose citations are the finding that produced the withdrawal).

**One judgment the sweep did not make**: seven of the eighteen citations named no symbol on the citing line, so no check could
judge them. The sweep removed their positions, which is exactly the point - what a reader cannot check, they should not have to.

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/document-drift.test.ts
```

## Recorded, not built

1. **A cheap judgment pass over the seven unjudgeable citations**, which no check can do.
2. **Keeping the withdrawn map as evidence**, which this round leaves where it is.