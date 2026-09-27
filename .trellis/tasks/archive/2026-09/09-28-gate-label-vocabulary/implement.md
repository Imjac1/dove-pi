# Implementation plan: one vocabulary for the refusal labels

## A process slip, recorded first

**This task went to code before its plan artifacts existed and before `task.py start` ran.** The PRD was written, the
implementation followed, and the design and this file were written afterwards - under a budget that was being watched too
closely, which is not a reason. The record is corrected rather than backdated: the artifacts below are what the round would
have planned, and the slip is written here because a task that hides its own sequence teaches the next reader the wrong one.

## Ordered checklist (reconstructed, and matched against what was done)

- [x] **1. One declaration**: the tuple, the derived union and the derived set in `task-convergence.ts`.
- [x] **2. The producers typed**: the label a refusal carries (`labelled`) as a `GateLabel`.
- [x] **3. Follow the typecheck**: it found `intensity` - a live label outside the vocabulary - and it refused the wrong
      coupling (`ActionGate.id`), which was reverted.
- [x] **4. The policy call sites** pass the literal they were already passing through a gate object, with the suites as the
      evidence that the behaviour is identical.
- [x] **5. The test** for the direction a type cannot cover: the policy gate list is a subset of the vocabulary.
- [x] **6. The specification**: the eleventh name, and the coupling that found it.
- [ ] **7. Curate `implement.jsonl` / `check.jsonl` and start the task** - the step that was skipped, done at the end rather
      than not at all.

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/gate-labels.test.ts
```

## Recorded, not built

1. **A check for a vocabulary label nobody writes**, which neither the type nor the test covers.
2. **The same treatment for the other vocabularies** the mode files declare, if one of them shows the same gap.
