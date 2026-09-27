# Implementation plan: the declared editable surface

## Before writing code

Load `trellis-before-dev`; read `.trellis/spec/backend/personal-agent-framework-core.md` (the evidence-plane scenario
where the contract goes - and it has room, having lost the mode-format scenario when that was split out) and
`.trellis/spec/backend/quality-guidelines.md`. Curate `implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [x] **0. Re-verify every entry resolves, from the filesystem rather than from this plan.** The design lists fourteen
      paths that were checked once; the rule this task enforces is that they exist, so the plan does not get to assume
      it. A path that has since moved is an entry to fix, not a reason to weaken R2.
- [x] **1. The declaration.** `.trellis/harness-surface.yaml` with the seven components and their verified paths, and
      the comment that says a path may belong to two components and why.
- [x] **2. The loader.** `src/core/harness-surface.ts` (pure): `HarnessSurface`, `HarnessComponent`,
      `parseHarnessSurface` (unknown component, duplicate, empty list, unknown key refused by naming the entry), and
      `unresolvedSurfaceEntries` with the injected existence predicate. Import `CHANGE_SURFACES` from
      `../core/task-convergence.ts` - one vocabulary, not a second copy.
- [x] **3. The tests.** `tests/harness-surface.test.ts`: the real declaration parses and every entry resolves (read
      from disk, so the test fails when the map drifts from the tree); each refusal; and the both-directions equality
      with `CHANGE_SURFACES`.
- [x] **4. The consumer.** `src/pi-adapter/extension.ts` status read: report `surface` as component-to-path-count and
      `surfaceIssue` when the map is missing or malformed, without failing the read.
- [x] **5. The host assertion - DONE, and it corrected the design: the status read resolved the map from the *workspace*, so a run in another project reported every entry missing. The map now resolves from the harness own root, and its entries resolve against the same root.** `tests/pi-adapter.test.ts`, in the formal-task scenario: the status read reports the
      declared surface, so the consumer is asserted rather than intended.
- [x] **6. The contract.** `personal-agent-framework-core.md`, evidence-plane scenario: the map, the resolve rule, the
      overlap rule, the both-directions vocabulary rule, and the one-commit revert convention.
- [x] **7. The reachability check.** Run `tests/harness-reachability.test.ts`: if the new module is unreachable, the
      allow-list entry must say it is read by the status read - and if the allow-list entry is needed at all, the
      consumer in step 4 did not land.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
node --import tsx --test tests/spec-context-budget.test.ts
```

## Risky files

| File | Risk | Mitigation |
|---|---|---|
| `.trellis/harness-surface.yaml` | A declaration that drifts from the tree is worse than none: it would name an action space that does not exist. | The test reads the real file and the real filesystem, so drift fails a gate rather than being noticed later. |
| The status read | It runs for every formal task; a throw or a slow read breaks a read-only path. | The map is small, a failure becomes `surfaceIssue` rather than an exception, and the bounded projection names counts rather than paths. |
| `CHANGE_SURFACES` | Two vocabularies is the drift this repository has already paid for. | The parser refuses an unknown name and the test asserts equality in both directions. |

**Rollback** is a deletion: no record is written, no schema changes, and nothing else imports the module. Free, and
stated because it will not always be.

## Recorded, not built

1. **The failure reading** - the experience-observability half. It needs this map to attribute a pattern to a
   component, and it needs a corpus that contains a failure: the survey of 164 recorded ledgers found 164 `completed`
   terminals and no `tool.observed` record at all. Its first version would be validated against constructed evidence,
   and the honest scope is "the reading works", not "here is what our harness gets wrong".
2. **Widening the observation's guard** so a request with no task is observed (recorded by the previous task).
3. **A real workload**: the reason the failure reading has no input is that nothing on this machine has failed yet.