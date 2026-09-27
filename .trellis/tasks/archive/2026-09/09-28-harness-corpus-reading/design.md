# Design: the corpus as a reading

## Boundaries

| Piece | File | Why there |
|---|---|---|
| The summary | `src/core/harness-corpus.ts` (new, pure) | Given ledgers as data, it returns counts - so every case, including a corpus with nothing in it, is a unit test. |
| The refusal counts | exported from `src/core/harness-axes.ts` | The split of a composite label is already the rule the axis and the observation reader apply. A third copy in the corpus summary is exactly the drift this project keeps paying for, so the axis exports it and both use it. |
| The walk | `scripts/harness-corpus.mts` | Where the other readings live: a script, printed, exit 0 always. |
| The finding | the summary itself, and the loop specification | It is a fact about the corpus, and the corpus is what the summary is for. |

## The summary

```typescript
export interface CorpusLedger { readonly path: string; readonly records: readonly ExecutionRecord[]; }

export interface CorpusSummary {
	readonly ledgers: number;
	readonly records: number;
	readonly kinds: Readonly<Record<string, number>>;
	readonly terminalClasses: Readonly<Record<TerminalClass, number>>;
	readonly requests: number;
	readonly refusals: { readonly total: number; readonly byLabel: Readonly<Record<string, number>> };
	readonly failures: readonly FailureRecord[];
	readonly unrefused: number;
	readonly corpus: readonly string[];   // what this corpus does not contain, and why
}
```

**Everything in it comes from a rule that already exists**: `classifyTerminal` for the classes, `readFailures` for the
failures, its skip accounting and its corpus notes, and the axis refusal split for the labels. A corpus reading that
derived any of them again could disagree with the instrument it is summarising, and a reader would have no way to tell
which was right.

## The finding, as one of the notes

When the corpus holds no failure record, the summary says so **and says why this one has none**:

```
  - no failure record in 174 ledgers: the paths that produce one are driven only by host tests, whose state
    directories are created with mkdtempSync and are not preserved, while the blackbox runner keeps its own
```

That sentence is the point of the reading. "Zero failures" on its own is the kind of statement this project keeps having
to correct - it reads as a healthy harness, and it is a statement about what was kept.

## The walk, and what it says it walked

```
node --import tsx scripts/harness-corpus.mts [root ...]
```

Defaults: the temporary directory and the resolved Dove state directory. For each root it walks for `execution.jsonl`,
skipping `node_modules` and `.git`, reading a ledger it cannot parse as empty rather than failing - a corpus reading that
dies on one bad file is a reading nobody runs. It prints the roots it walked, per-root ledger counts, the aggregate
summary, and the notes.

## Verification and rollback

- **Unit**: constructed ledgers with one of each terminal class, a composite refusal, a refusal with no id, and an
  empty set; the summary counts each and the notes appear only when they should.
- **Live**: run it against the real corpus and paste what it printed into the task record. The previous manual scan
  found 174 ledgers and no failures; the reading has to agree with the hand count or one of them is wrong.
- **Rollback** deletes the module and the script. The axis keeps its behaviour because the exported refusal helper is
  the same code, and its suite is the regression net.
