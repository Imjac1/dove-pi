# Design: the client account, attributed

## The field and the option

```typescript
export interface ClientAccount {
	readonly code: string;
	/** How the client decided - because a regex over an error text is not the same evidence as a recorded status code. */
	readonly source: string;
}

export interface FailureRecord {
	// ... unchanged ...
	/** What a client of this run called the failure, and how it decided. Never presented as the ledger own reading. */
	readonly client?: ClientAccount;
}

export function readFailures(records: readonly ExecutionRecord[], options?: { readonly clientAccounts?: ReadonlyMap<string, ClientAccount> }): FailureReading;
```

**Keyed by request id, and only that.** The account is attached to the failure whose request it describes, so a ledger
with several failures cannot have one run account smeared across them - the over-attribution the provider outcome already
avoids by matching on the id.

**`source` is required, not decorative.** The one account this task has in hand was produced by a regex over a provider
error message (`scripts/real-dove-blackbox.mjs:374`). Recording the code without saying how it was reached would promote
a text heuristic to the same standing as a recorded status code, which is the class of claim this project exists to
refuse.

## Where the pairing happens

| Caller | How it pairs | Why there |
|---|---|---|
| `scripts/harness-failures.mts` | The caller passes `--client-summary <file>`; the script reads the ledger, matches the summary `ledgerTerminal.terminal.code` against the terminal records, and builds the map by request id - **stating nothing when the match is not exactly one** | Pairing a ledger with a run summary is a decision about two artifacts, and the caller is the one who knows they belong together |
| `scripts/harness-corpus.mts` | The walk already knows the layout: the summary sits beside the runner output path and the ledger under the scenario root derived from it | It is the one place where that layout is a fact it already depends on |

The runtime never pairs anything: it writes the ledger and nothing else, and a reading that went looking for a summary
file would be guessing about a layout it does not own.

## What the record then says

```text
  req_4845941e-...  startup-failed / host-shutdown-preflight (session)
    unseen:     the request ended before the agent loop started: ...
    client:     provider-authorization-denied  (classified by the black-box client from the provider error text)
```

Three accounts of one failure, each from the boundary that made it, and **no merged name**: Dove saw the preflight
closure, the provider record would carry its own account when a request reaches it, and the client named the error text.

## Verification and rollback

- **Unit**: an account attached by request id; a ledger with two failures where only one has an account; no account means
  the record is unchanged.
- **Live**: the failure script with the summary of the real failing run, and the corpus reading over the real corpus.
- **Rollback** removes the option and the field; every existing caller is unaffected because the option is optional.
