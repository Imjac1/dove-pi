# Design: the applied commit

## Boundaries

| Piece | File | Why there |
|---|---|---|
| The claim | `change.applied` in `execution-ledger.ts` + the `applied` operation in `extension.ts` | A ledger record rather than a convergence event: the ledger holds what happened and the convergence record holds goal state, and an application is not goal state. It also means no snapshot schema change. |
| The inside-surface rule | exported from `src/core/action-policy.ts` | The fence already answers "is this path inside a declared prefix" at `:385`, using `workspaceRelativeTarget` (`:116`) and the prefix hit (`:124`). Two implementations of that rule is the drift this project keeps paying for. |
| The turn reading | `src/core/harness-round.ts` (new, pure) plus `scripts/harness-rounds.mts` | The pure part is the check and the join; the script is where this project reads its own evidence, and where git exists. |
| The procedure | the loop specification | It is routed; an agent reads it before doing this work. A skill would be a second discoverable home for the same procedure. |

## The record

```json
{ "kind": "change.applied", "stepId": "applied:chg-1",
  "details": { "changeId": "chg-1", "commit": "4b45f99" } }
```

- **`stepId: "applied:" + changeId`**, addressable by the change, like the decision record is by its own key.
- **No `verdictOnly`-style flag is needed here**, and that is deliberate rather than an omission: the flag exists on
  records whose *reading* could be mistaken for an act. This record is a claim, and the flag that matters is the one
  the script prints - whether the claim holds.

## The refusals, and why each one is a refusal rather than a warning

| Condition | Behaviour |
|---|---|
| The change id is not in the record | Refused, naming the id: a commit with no pre-registered prediction is an edit nobody predicted, which is what the manifest exists to prevent. |
| The change already carries an application | Refused, naming the commit already recorded: **one commit per logical edit** is what gives the revert its granularity, and two commits for one change is a revert that takes one of them. |
| The commit is empty | Refused: an empty string would record the shape of a claim with none of its content. |

## The check, and the three answers it gives

```typescript
export type SurfaceFit = "inside" | "outside" | "unresolved";
export function surfaceFit(input: {
	readonly touchedFiles: readonly string[];
	readonly declaredPaths: readonly string[];
	readonly workspaceRoot: string;
}): { readonly fit: SurfaceFit; readonly outside: readonly string[] };
```

- **`inside`** when every touched file is inside a declared path, by the fence rule: equal to it, or under it as a
  directory.
- **`outside`** when some are not, **naming them** - the same disposition as the fence refusal, which names the
  declaration that would allow the write.
- **`unresolved`** when the caller could not get the file list at all (the commit does not resolve). It is a third
  answer and not a nicer word for `outside`, because "the edit went somewhere it declared it would not" and "nobody
  could tell" are different facts, and every other reading here keeps them apart. This is the same rule the SSM axis
  applies with an undefined ratio and the failure reading with `unattributed`.

**The rename.** `fencePrefixHit` becomes `declaredPrefixHit` when it is exported: it is no longer only the fence that
hit a prefix, and a name that describes one caller is how the next reader comes to believe the rule is the fence own.
The fence call site is updated with the export, and the fence tests are the regression net for the rule.

## The script

```
node --import tsx scripts/harness-rounds.mts [workspace]
```

For every change it can find - read from `.dove/tasks/*/convergence.json`, because the manifest is goal state and lives
there - it prints: the failure evidence, the surface, the fix, the prediction, the applied commit with the fit of its
touched files (`git show --name-only --format=` in the script, where git and this project evidence readings already
live), and the recorded decision. With nothing applied it says so; with no changes at all it says that too.

## Verification and rollback

- **Unit**: the check three answers, including a directory path and an offender named; the refusals at the operation
  boundary through the host tests; the fence suite proves the exported rule still behaves as it did.
- **Host**: an application is recorded once, a second is refused, an unknown change is refused.
- **Rollback** removes the kind, the operation and the script: the ledger keeps whatever applications were recorded,
  and nothing else reads them (the status read adds one optional field).
