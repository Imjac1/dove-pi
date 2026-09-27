# Design: the verifier, declared in two parts

## The declaration

```yaml
verifier:
  # The files that are verifier code: the readings and the evidence store.
  paths: [src/core/harness-axes.ts, src/core/failure-reading.ts, src/core/harness-round.ts, src/core/harness-corpus.ts, src/core/execution-ledger.ts]
  # The files that contain verifier code and are otherwise harness: named because they cannot be declared as paths.
  embedded:
    - path: src/pi-adapter/extension.ts
      symbols: [unresolvedAcceptanceEvidence, countGateRefusals, changeObservables, convergenceObservables]
    - path: src/core/task-convergence.ts
      symbols: [parsePredictedMovement, verificationStateOf, verdictFor, decidableChanges]
```

**`embedded` is a declaration of a limit, and it is data rather than a comment** because the reading uses it: a commit that
touches one of those files *may* be a verifier change, and saying so is better than saying nothing.

## The three answers

```typescript
export type VerifierFit = "definite" | "possible" | "none";
export function verifierFit(input: {
	readonly touchedFiles: readonly string[] | undefined;
	readonly verifier: HarnessVerifier;
	readonly workspaceRoot: string;
}): { readonly fit: VerifierFit; readonly paths: readonly string[]; readonly embedded: readonly { path: string; symbols: readonly string[] }[] };
```

- **`definite`** when a touched file is one of `verifier.paths` - the edit *is* a verifier change;
- **`possible`** when a touched file embeds verifier code - the edit may be one, and the symbols are named so a reader can
  look;
- **`none`** otherwise. **`undefined` touched files are `none`, not `possible`**: nothing could be read, so nothing is
  claimed - which is the one place this differs from `surfaceFit`, where "nobody could tell" is a third answer because the
  *question* is about the edit. Here the question is whether the verifier is at stake, and an unread commit gives no reason
  to think it is.

**The rule for matching is the declared-prefix rule** (`declaredPrefixHit`), the same one the fence and the surface fit use:
a verifier path is a file today, and a directory in it would behave as one would expect rather than surprising the next
reader.

## Why the two relations are not merged

`verifier.paths` says what **implements** the verification; `verifiedBy` says what **verifies** a component. A suite is in
the second and not the first; a reading is in the first and not the second; `execution-ledger.ts` is in the first and has no
suite of its own. Merging them would produce a list that answers neither question.

## Verification and rollback

- **Unit**: the three answers, with a directory-shaped verifier path and a commit that touched nothing; the loader refuses
  an `embedded` entry with no symbols and a path that does not resolve.
- **Live**: the turn reading on the real failing run, which touched no code and so must answer `none`; and on a fixture
  whose commit touched `extension.ts`, which must answer `possible` with the symbols named.
- **Rollback** removes the mapping and the check; the surface fit is untouched.
