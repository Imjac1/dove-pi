# Gap closed: `vxcontrol/pentagi` inspection

- Query: The GitHub survey named this as **the biggest open question in the pentest vertical** -
  24,951 stars, MIT, Go, active, and **uninspected** (58 MB repo, jsDelivr refuses >50 MB, GitHub core
  API rate-limited).
- Scope: file-tree inspection plus README claim extraction, by the main session
- Date: 2026-09-25
- Method: `https://ungh.cc/repos/vxcontrol/pentagi/files/main` for the tree (the GitHub API was
  rate-limited; `data.jsdelivr.com` returns **403 "Package size exceeded the configured limit of
  50 MB"**), plus `raw.githubusercontent.com` for the README.

## 1. What the repository actually contains

**753 paths extracted** (the ungh response is truncated at 100,000 characters, so this covers the
repository through `backend/`; 731 of the paths are under `backend/`).

### Zero scope-enforcement files

A keyword scan of every extracted path for `scope`, `authoriz`, `consent`, `engagement`, `roe`,
`rulesof` returned **zero hits**.

The three modules where a scope gate would live are all accounted for:

| Directory | Files | Anything that gates? |
|---|---|---|
| `backend/pkg/tools/` | 43 (browser, code, executor, file_diff, flow_manager, graphiti_search, guide, memory, registry, search, `searchers/*`) | **No.** `executor.go` is dispatch, not policy. `registry.go` is registration |
| `backend/pkg/terminal/` | **2** - `output.go`, `output_test.go` | **No.** Only output formatting - no command interception or deny path |
| `backend/pkg/config/` | 4 - `config.go`, `tenant.go` (+ tests) | **No.** Configuration and tenancy |

The only authorization-adjacent files anywhere in the tree are
`backend/pkg/server/auth/permissions.go` (**server/API auth for the web UI**, not agent action
authorization) and `backend/pkg/observability/langfuse/guardrail.go` (**an observability export**).

## 2. What the README claims, and the semantic mismatch

The README's own control list:

| Claimed control | What it actually is |
|---|---|
| *"**Scope Management**: Prevents scope creep by keeping agents focused on current subtask only"* | **A semantic mismatch.** This is *task focus*, not *authorization*. Nothing here checks whether a target is in an authorized scope |
| `MAX_LIMITED_AGENT_TOOL_CALLS` (default **20**), `EXECUTION_MONITOR_SAME_TOOL_LIMIT`, `EXECUTION_MONITOR_TOTAL_TOOL_LIMIT` | **Budget / runaway limits**, not scope gates |
| Redis listed as *"Cache + Rate Limiter"* | Rate limiting, not authorization |
| *"any scope limitations or rules of engagement"* configurable for assistants | Pre-flow **operator configuration**, not a runtime check |
| *"Only test systems you own or are explicitly authorized to assess. See [EULA.md]"* | **A documentary control.** An EULA is not a gate |

## 3. Conclusion

**The largest open-source pentest agent by stars (24,951) appears to have no code-level authorization
gate.** Its controls are: a tool-call budget, a rate limiter, a pre-flow operator setting, and an EULA.

This **confirms and strengthens the GitHub survey's headline** rather than contradicting it:

- Five pentest projects **do** block at the tool boundary (`cain-agent`, `Armur`,
  `redcell`, `Dark-Moon`, `pentestagent`).
- The two **most-cited / most-starred** ones (`PentestGPT` at 15,589 stars with zero enforcement files,
  and now `pentagi` at 24,951) rely on **documentary** controls.

So the field splits by *popularity*, not by *maturity*: the projects that enforce are the smaller ones,
and the projects people actually star treat authorization as a EULA.

**For the design this is the strongest available argument that a scope-conformance gate is a
differentiator rather than table stakes.** It also makes the authority contract (design section 3.5)
the feature a pentest vertical would adopt the framework *for*.

## 4. Follow-up: the two candidate files were read, and the absence claim is now code-level

The caveat below flagged that a gate could exist inside `executor.go` or `registry.go` under a name
the keyword scan missed. Both files were then fetched and read.

| File | Size | Keyword hits | What the hits actually are |
|---|---|---|---|
| `backend/pkg/tools/executor.go` | 621 lines / 17,144 bytes | **5** | `allowSummarize` + `allowedSummarizingToolsResult` (result-size summarization policy) and `allowedStoringInMemoryTools` (memory-storage policy). **Nothing about targets or actions.** |
| `backend/pkg/tools/registry.go` | 516 lines / 25,005 bytes | **8** | The same two allowlists, plus the word "blocking" appearing only inside tool *descriptions* (*"Calls a terminal command in blocking mode"*, *"Block until the currently running automation task completes"*). **Nothing about targets or actions.** |

**So the only allow-lists in pentagi's tool layer govern (a) which tools may summarize results and
(b) which tools may write to memory.** Neither is an authorization gate. The tool dispatch path has no
scope or permission check.

This upgrades the finding from "no file is named like a scope guard" to **"the two files where a gate
would live contain no gate"**. The absence claim is now a code read, not an inference from filenames.

## Caveats / Not Found

- **The file list was truncated at 100,000 characters**, so it covers the repository through
  `backend/`. Directories after that (`frontend/`, `docs/`, tooling) were **not** enumerated.
  However, every `backend/pkg/` subdirectory is complete in the listing, and that is where a Go
  authorization module would live.
- ~~This is a file-name and README inspection, not a code read.~~ **PARTIALLY CLOSED** - see
  section 4: `executor.go` and `registry.go` were read, and neither contains a target or action
  authorization check. The remaining gap is the truncated file list (directories after `backend/`),
  and any gate hiding in the ~200 unread `backend/pkg/` files under a non-matching name.
- The GitHub API was rate-limited throughout (60 req/hr unauthenticated, exhausted), so star and
  activity figures come from `ungh.cc` metadata: 24,951 stars, 3,208 forks, `pushedAt`
  2026-09-23.
