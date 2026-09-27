# Design: two bases, one scope, and a stated limit

```typescript
const owns = /^(\.\/|\.\.\/)*(\.trellis|src|tests|scripts|AGENTS\.md|package\.json|tsconfig\.json)/;
// Try both bases: a specification writes `src/core/x.ts` from the repository root, and `../backend/y.md` from its own directory.
const found = existsSync(resolve(root, path)) || existsSync(resolve(dirname(file), path));
```

**Scope: the specifications.** The guides are thinking guides, and their paths are illustrations - `scripts/path/file.py` is a shape,
not a claim. Narrowing the rule to directories whose subject is this project is what keeps it from firing on a true sentence.

**Limit: a path is not a claim.** The rule can see that a specification names a file that exists. It cannot see that the sentence
around the name is still true - which is the part a reader checks and a check cannot.
