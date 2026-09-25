# Ground truth: what fields real reusable agent definitions actually use

- Query: What is the *empirically converged* field set for a reusable agent work mode?
- Scope: real GitHub corpora, cloned and parsed. **Numbers below were produced by the main session
  running the analysis scripts itself**, not taken from the sub-agent's report.
- Date: 2026-09-25
- Corpus: `%TEMP%\amr\` (cloned by the work-mode sub-agent), 1,621 files at time of analysis
- Method: the sub-agent wrote `analyze2.cjs` / `analyze3.cjs`; the main session executed them and
  read the output directly. YAML frontmatter parsed between `---` fences.

## 1. Per-repository field tallies (independently reproduced)

### `wshobson/agents` - the largest corpus

| Artifact | Files | With frontmatter | Field tallies |
|---|---|---|---|
| **Agent** | 202 | 202 (100%) | `name` **202**, `description` **202**, `model` **202**, `tools` **15**, `color` **9** |
| **Skill** | 183 | 183 (100%) | `name` **183**, `description` **183**, `version` 14, `license` 2, `metadata` 2 |
| **Command** | 105 | 64 (61%) | `description` 64, ... |

### `VoltAgent/awesome-claude-code-subagents`

| Artifact | Files | Field tallies |
|---|---|---|
| Agent | 171 | `name` 161, `description` 161, `tools` **161**, `model` 153 |

### `0xfurai/claude-code-subagents`

| Artifact | Files | Field tallies |
|---|---|---|
| Agent | 138 | `name` 137, `description` 137, ... |

## 2. What actually converges

| Field | Convergence | Verdict |
|---|---|---|
| `name` | ~100% in every corpus | **Required** |
| `description` | ~100% in every corpus | **Required** |
| `model` | 202/202 in the largest corpus; 153/161 in another | **Required in practice** |
| `tools` | **15/202 (7%)** in one corpus, **161/161 (100%)** in another | **Converged as a concept, not as a convention** |
| `color` | 9/202 | Decoration |
| `version` / `license` / `metadata` | 14 / 2 / 2 out of 183 | Rarely used |

Plus the body, which is the actual instruction text in every case.

**The smallest artifact real projects converge on is:**

```
{ name, description, body(instructions), model, [tools] }
```

Everything else - `hooks`, `memory`, `permissionMode`, `isolation`, `mcpServers`, `skills`,
`maxTurns` - is **harness-specific and optional**, i.e. it does not survive a change of host.

## 3. The security-relevant finding hiding in the numbers

**Tool restriction did not converge.** In the largest corpus only **7%** of agent definitions
declare a `tools` allowlist. In another corpus **100%** do. So there is no ecosystem convention that
an agent's authority is declared.

That matters because the community security evidence shows the root vulnerability is *ambient
authority* - naming a resource being sufficient to act on it (arXiv 2609.08371, "Authority Is Not a
String"). The ecosystem's most-used artifact shape **does not carry an authority declaration at all**.

**Design consequence:** the framework cannot inherit authority scoping from the prevailing format.
It must make the capability set a **required** field of a work mode, accepting that this makes its
modes non-portable to harnesses that do not understand it - which is the correct trade, because a
mode that cannot declare its authority cannot be reviewed before it runs.

## 4. A working precedent for the extension seam

The sub-agent reports that `wshobson/agents` compiles **one** markdown source into **six** harness
formats through `tools/adapters/*.py`, **including a Pi adapter** that emits `.pi/skills`,
`.pi/prompts`, and `.pi/agents`. It maintains a per-harness capability matrix and a round-trip
verification table, and its real-CLI round-trip caught two adapter bugs:

1. YAML block-scalar descriptions were mangled.
2. A `tools:` list containing only MCP tools caused OpenCode to degrade to deny-everything, leaving
   the agent inert.

**"One source of truth + per-harness adapter + fidelity matrix" is the pattern to copy** for this
framework's extension seam. The two bugs are the argument for the fidelity matrix: a single-source
compiler silently produces a broken or *over-permissive* agent on a harness it was not tested against.

## 5. Caveats / Not Found

- The `agents` repository in the corpus parsed badly: its top "fields" came out as `user` (61) and
  `assistant` (44), meaning those Markdown files contain conversation transcripts rather than
  frontmatter. Its numbers are excluded from section 2.
- Field counts are **presence**, not semantic correctness. A declared `tools` field may still be
  ignored or misinterpreted by the consuming harness (see the OpenCode bug).
- The corpus is Claude-Code-shaped by construction, because that is where the ecosystem's mass is.
  It therefore cannot tell us what a *non*-Claude-Code ecosystem would converge on.
- The sub-agent's full report on versioning/pinning and reuse failure modes had not landed when this
  file was written.
