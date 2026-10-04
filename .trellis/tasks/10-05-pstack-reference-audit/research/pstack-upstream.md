# pstack upstream audit: primitives, workflow, enforcement, context discipline

- Reference: `backnotprop/pstack` @ `main` (snapshot 2026-10-04), a **mirror** of `cursor/plugins/pstack` v0.15.9 (`.cursor-plugin/plugin.json:4`).
- Checkout: `.trellis/.runtime/pstack-research/pstack-main`.
- **Anchor convention:** every `path:line` below is relative to that checkout root. `skills/swarm/SKILL.md:36` means `<checkout>/skills/swarm/SKILL.md` line 36.
- Inventory: 53 `SKILL.md` files (50 under `skills/`, 3 under `automations/benny/skills/`), 23 playbooks, 2 agents, 11 guide pages, 12 script/source files under `skills/poteto-mode/scripts/`, 1 shell helper under `skills/show-me-your-work/scripts/`.
- Framing correction that matters for every "Cursor-only" claim: this checkout is not raw Cursor. `MIRROR.md:3` says "This repo mirrors [`cursor/plugins/pstack`](https://github.com/cursor/plugins/pstack) and adds its own edits: the top of `README.md` and **harness-neutral rewrites in some skills**." So some Cursor coupling is already dissolved here, and the mirror tracks the remaining coupling deliberately (`MIRROR.md:41`: "The Harness section in `skills/poteto-mode/SKILL.md` lists the mappings.").

---

## 1. Primitive types and how each enters context

### 1.1 `skills/<name>/SKILL.md` — the only real primitive

`README.md:12`: "pstack is a folder of plain [Agent Skills](https://agentskills.io) (`skills/<name>/SKILL.md`). You don't need Cursor."

**Exact frontmatter fields observed across the 53 files.** Observed by dumping lines 1..N of every `SKILL.md`:

| Field | Where observed | Notes |
|---|---|---|
| `name` | every file | Free-form, **not** always the directory name: `skills/poteto-mode/SKILL.md:2` is `name: Poteto Mode`, `skills/make-bot-ui/SKILL.md:2` is `name: Make Bot UI`. Every `principle-*` and utility skill uses the kebab directory name (`skills/swarm/SKILL.md:2`). |
| `description` | every file | The trigger surface, phrased as usage: `skills/arena/SKILL.md:3` "Spawn N parallel candidates at the same task, pick a base, graft the strongest parts of the losers into it. Use for /arena, 'arena it', ...". Negative triggers appear in the description itself: `skills/tdd/SKILL.md:3` "Skip when the test path is unclear, expensive, integration-heavy, or not requested." Scope is fenced the same way: `automations/benny/skills/reproduce-and-fix-issues/SKILL.md:3` "Use only from the configured Benny repro automation." |
| `disable-model-invocation: true` | **52 of 53 files** | The only skill without it is `skills/setup-pstack/SKILL.md:1-4`. Meaning for context: descriptions compete for attention, bodies do not auto-load; a human (or `poteto-mode`) names the skill. |
| `paths: ["**/*.ts", "**/*.tsx"]` | `skills/typescript-best-practices/SKILL.md:4` only | The one file-triggered skill. See the uncertainty note in §8. |
| `mode: true`, `icon: crown`, `color: yellow`, `reminder:` | `skills/poteto-mode/SKILL.md:5-8` only | Makes poteto-mode a persistent mode, not a one-shot skill. The `reminder` line is a per-turn nudge: `skills/poteto-mode/SKILL.md:8` "New task? Playbook match or rigor needed -> apply /poteto-mode. Casual turn or user opts out -> don't." |
| folded scalar `description: >-` | `skills/make-bot-ui/SKILL.md:3-6` | The wrapped form. The YAML rule is stated at `skills/automate-me/SKILL.md:80`: "Keep `description` as one YAML scalar. Quote it or use `description: >-` with indented continuation lines when punctuation or wrapping requires it." |

**Heading contract.** A skill body opens with a single H1 matching the frontmatter concept (`skills/poteto-mode/SKILL.md:11` "# Poteto mode"). All 23 playbooks instead open with an **H3**, verified across the directory (e.g. `skills/poteto-mode/playbooks/multi-phase-plan.md:1` "### Multi-phase or multi-PR plan", `.../orchestrate.md:1` "### Orchestrate"). That is deliberate: playbook bodies are copied into a larger document, so they are written as sections, not standalone documents.

**How a skill enters context.** Not by the filesystem, by routing. `skills/poteto-mode/SKILL.md:15` makes the read condition explicit for principles: "In your reply, name each principle that shaped a decision and the specific choice it changed. **Cite only principles whose leaf SKILL.md you read this session.**" And `skills/poteto-mode/SKILL.md:40`: "Read the leaf skill in full for any principle you apply."

**Skills that call skills** are declared as install-time dependencies, not resolved at run time: `README.md:26-37` gives a table ("Some skills call other skills. Install these together"), e.g. `create-verification-skill` → "`maintain-verification-skill`".

### 1.2 `agents/` — two registered subagents

`agents/poteto-agent.md:1-4` is the full contract:

```yaml
name: poteto-agent
description: Routing target for `/poteto-mode` and any request for poteto's style. Spawn a fresh `poteto-agent` for each new task, ... Substituting `generalPurpose` skips that read and drifts.
is_background: true
```

So the agent's *description* is the routing surface, and `is_background: true` is the one behavioral field. `agents/comment-sicko.md:1-4` uses a display name with a space (`name: Comment Sicko`) and no behavior fields. Both are registered only through the plugin manifest, `.cursor-plugin/plugin.json:30` `"agents": "./agents/"`. Entry into context: the body is the subagent's system prompt; `skills/no-comments/SKILL.md:19` shows the fallback — on a harness that does not register the agent, "Its prompt is [`references/comment-sicko.md`](references/comment-sicko.md) verbatim, then the scope."

### 1.3 `docs/guide/*` — human-facing, never agent-loaded

11 files (`docs/guide/README.md` + `01-setup.md` … `10-recipes-and-pitfalls.md`). I grepped every `skills/**/SKILL.md`, every playbook, and both `agents/*.md` for `docs/guide`: **zero matches**. The only reference is `README.md:73` "new here? the [pstack guide](./docs/guide/README.md) walks you through a first real task". The guide is the human's map of the system, and it carries the workflow vocabulary in §2.

### 1.4 `references/` — one file per consumer, loaded on demand

Same level as `SKILL.md`, under a skill directory, and always reached by an explicit path in the body. The pattern varies by consumer count:

- One reference, passed verbatim as a subagent prompt: `skills/no-comments/SKILL.md:19` (comment-sicko prompt), `skills/reflect/SKILL.md:55` "Use `references/synthesizer.md` verbatim".
- One reference per concurrent role: `skills/reflect/SKILL.md:47-49` maps Judgment/Tooling/Divergent to `references/judgment-reviewer.md`, `references/tooling-reviewer.md`, `references/divergent-reviewer.md`.
- A base prompt plus one category file per fan-out member: `skills/why/SKILL.md:159` "`references/sources/*.md`. One self-contained example playbook per category ... **Give an investigator the single file that matches its category** and adapt it to the available MCP."
- An index plus its members: `skills/why/SKILL.md:156-160` documents all five reference groups and their consumers; `skills/how/SKILL.md:32,42,52,60` builds explorer/explainer prompts from `references/explorer-prompt.md` and `references/explainer-prompt.md`.
- A safe-core file, conditional on task shape: `skills/why/SKILL.md:92` "The cross-cutting `references/sources/incident-postmortem.md` **if the target code looks defensive**".
- An example tree that is a shape to copy, not a read: `skills/create-verification-skill/references/feature-map-example/` (`README.md:35-42` states the "Feature entry contract").

The rule that governs the split is stated once, in `skills/principle-guard-the-context-window/SKILL.md:15`: "**Keep frequently used content inline.** Templates and references used on every invocation belong in the skill file, not in separate files that cost a read each time."

### 1.5 `playbooks/` — 23 files inside `poteto-mode`, the load unit of the workflow

`README.md:83` "it comes with twenty-three playbooks"; the directory holds exactly 23. The router list lives inline in the skill (`skills/poteto-mode/SKILL.md:137-159`, one line per playbook with its trigger phrase and path), and the body loads only for the matched one — `skills/poteto-mode/SKILL.md:133`: "Match the task to a playbook below, **open its file**, and copy its steps in verbatim."

Playbooks are re-read from trunk during long runs rather than trusted from local state:

```bash
git show origin/main:pstack/skills/poteto-mode/playbooks/<execution playbook>.md
```
(`skills/poteto-mode/playbooks/multi-phase-plan.md:36`; same device at `.../autopilot-full.md:10` and `.../autopilot-stack.md:6` "re-read this playbook from trunk with `git show origin/main:pstack/skills/poteto-mode/playbooks/autopilot-stack.md` and audit the operation against it.")

### 1.6 `scripts/` — invoked by path from instructions, never auto-loaded

Three locations: `skills/poteto-mode/scripts/` (12 files incl. `orch/`, `watch-pr/`), `skills/show-me-your-work/scripts/log.sh`, and no scripts under `automations/benny/`. Two runtime families: plain `node` (`skills/poteto-mode/scripts/check-plan.mjs:1` `#!/usr/bin/env node`) and `bun` (`skills/poteto-mode/scripts/orch/orch.ts:1` `#!/usr/bin/env bun`, `.../watch-pr/watch-pr:1`). The bun entry scripts self-bootstrap their dependency — the call site is `skills/poteto-mode/scripts/orch/orch.ts:20` (`ensureDependenciesInstalled();`, defined at `skills/poteto-mode/scripts/bootstrap.ts:25`) — installing `commander` with a lockfile hash key and then re-execing:

```ts
const result = Bun.spawnSync([process.execPath, "install", "--frozen-lockfile"], { cwd: scriptsDirectory });
```
(`skills/poteto-mode/scripts/bootstrap.ts:35-38`; the key file is `node_modules/.poteto-mode-tools-install-key`, `bootstrap.ts:12-15`, and the re-exec is `bootstrap.ts:54-61`.)

### 1.7 Everything else that constrains skill shape

- **Plugin manifest** `.cursor-plugin/plugin.json:29-30`: `"skills": "./skills/"`, `"agents": "./agents/"` — only two roots are exposed. The benny pack is deliberately outside them: `automations/benny/skills/setup-benny/SKILL.md:9` "The plugin manifest exposes only pstack's normal skill root; this file and the two operational files are not slash skills."
- **Frontmatter is load-bearing**: `skills/create-verification-skill/SKILL.md:25` "without frontmatter the skill never registers".
- **Default for new skills**: `skills/automate-me/SKILL.md:81` "Frontmatter `disable-model-invocation: true` by default. Opt out only if the user explicitly wants their mode to apply on every turn."
- **Validation is delegated, not bundled.** `skills/poteto-mode/playbooks/authoring-a-skill.md:6`: "Validate the skill: frontmatter has `name` and `description`, referenced files exist, cross-skill links resolve." `skills/reflect/SKILL.md:74`: "**If your environment ships a SKILL.md validator**, run it on every touched skill before declaring done. Skip this step if it doesn't." No validator exists in this checkout.
- **The mirror itself has a shape gate**, run by hand during sync — `MIRROR.md:38`: `git diff upstream@{1} upstream -- skills | grep -nE '\.cursor/|agent-transcripts|cursor-team-kit|create-skill|Task'` with "Rewrite any new hits the same way as the existing edits."

---

## 2. The workflow pstack imposes

The imposed order is the guide's order (`docs/guide/README.md:7-16`), and each page names the skills that own the phase. Artifacts and gates per phase, with the enforcement class:

| # | Phase (guide page) | What routes there | Artifact the phase must produce | Gate, and how it is enforced |
|---|---|---|---|---|
| 1 | Setup (`01-setup.md`) | `/add-plugin pstack` (`01-setup.md:10`) then `/setup-pstack` (`01-setup.md:20`) | `~/.cursor/rules/pstack-models.mdc` (`01-setup.md:23`) or `~/.agents/pstack-models.md` (`skills/setup-pstack/SKILL.md:11`) | **Instruction only.** `skills/setup-pstack/SKILL.md:40`: "Every real slug written must be in the detected set. `inherit-parent` and `auto` always pass. If a chosen real slug is not available, stop and ask again." Nothing verifies the file. |
| 2 | Route (`02-poteto-mode.md`) | `/poteto-mode` matches one of 23 playbooks (`02-poteto-mode.md:3`) | A todo list whose first items are the matched playbook's steps, verbatim (`skills/poteto-mode/SKILL.md:133`); skipped steps stay visible as `skip: <reason>` (`docs/guide/01-setup.md:45`) | **Instruction only.** `docs/guide/02-poteto-mode.md:94`: "don't enumerate skills in your prompt ... The playbook already sequences them". No script reads the todo list. |
| 3 | Understand (`03-understand.md`) | `/how`, `/why`, `/teach`, `/recall` | A cited explanation; `/why` separates evidence from inference and reports null results (`03-understand.md:21`); `/how` fans "two to four read-only explorers" for a big subsystem (`03-understand.md:13`) | **Instruction only.** `03-understand.md:51` is a pitfall, not a gate: an agent may start editing without a traced model. |
| 4 | Design (`04-design.md`) | `/architect` (brings `/arena`), `/arena`, `/swarm`, `/interrogate` | `/architect`: a design package with caller usage first, then types and a module map (`04-design.md:13`); `/arena`: one synthesized artifact plus a synthesis note (`skills/arena/SKILL.md:71`); `/interrogate`: findings sorted `Act on`/`Consider`/`Noted`/`Dismissed` with a reason per dismissal (`04-design.md:65`) | **Instruction only.** Checkpoint is opt-in: `/architect with checkpoint. stop and show me before implementing.` (`04-design.md:18`). Default is to proceed straight into implementation. |
| 5 | Build and clean (`05-build-and-clean.md`) | the build playbooks, `/tdd`, `/unslop`, `/no-comments`, plus `/deslop` (not shipped) | A commit-ready diff: `/tdd` writes the failing test first (`05-build-and-clean.md:43`), `/no-comments` spawns Comment Sicko "before review" (`05-build-and-clean.md:63-69`) | **Instruction only** for cleanup; `/deslop` is externally supplied (`05-build-and-clean.md:51`). |
| 6 | Verify and ship (`06-verify-and-ship.md`) | finish condition in the prompt; `/create-verification-skill`; Opening a PR; Babysit; Shipping | `.cursor/skills/verify-<app>/` with Launch/Doctor/Drive/Evidence/Cleanup sections plus a feature map (`06-verify-and-ship.md:37`); a PR; then merges | **Partly scripted.** `scripts/watch-pr/watch-pr` is the machine verdict source (`skills/poteto-mode/playbooks/babysit.md:12`), and Shipping's per-PR verdict must come from "an agent that did not write the code" (`.../shipping.md:7`). The stop-line itself is instruction only: "Babysit stops at merge-ready. It never merges" (`06-verify-and-ship.md:75`). |
| 7 | Overnight (`07-overnight.md`) | `/loop` (host built-in, not pstack, `07-overnight.md:24`) + a contract | `decisions.tsv` decision trail (`07-overnight.md:47`) | **Instruction only**, plus a formatting helper: `skills/show-me-your-work/scripts/log.sh`. The stated contract is goal + finish condition + permissions + escape hatch (`07-overnight.md:9`). |
| 8 | Principles (`08-principles.md`) | names, not invocations (`08-principles.md:5` "You don't invoke principles. You use their names to steer.") | A reply that names each applied principle and the decision it changed (`skills/poteto-mode/SKILL.md:15`) | **Instruction only.** `08-principles.md:27`: "A principle citation with no decision behind it is the tell that it name-dropped instead of applying." |
| 9 | Make it yours (`09-make-it-yours.md`) | `/automate-me`, `/reflect`, authoring-a-skill playbook, Eval playbook | A new/edited skill; Eval produces a rubric and a verdict (`09-make-it-yours.md:61`) | **Mixed.** `/reflect` blocks on human approval (`skills/reflect/SKILL.md:63` "present the synthesizer's full Accepted/Rejected/Backlog output to the user and wait for explicit approval"); Eval's blinding rules are instructions (`skills/poteto-mode/playbooks/eval.md:7-13`). |
| 10 | Recipes and pitfalls (`10-recipes-and-pitfalls.md`) | copy-paste prompts | none | The pitfalls are the negative gate list: enumerating skills, vague finish conditions, parallel agents in one worktree, accepting every review comment, treating `auto` as a model slug, reporting success off a green build, writing a `SKILL.md` freehand (`10-recipes-and-pitfalls.md:83-90`). |

**Script-enforced vs instruction-only, stated plainly.** Exactly five scripts are named by instructions as gates: `check-plan.mjs` (`skills/poteto-mode/playbooks/multi-phase-plan.md:10`), `watch-pr` (`.../babysit.md:12`, `.../shipping.md:14`), `orch` (`.../orchestrate.md:23`), `worktree-audit.sh` (`.../worktree-cleanup.md:5`), `log.sh` (`skills/show-me-your-work/SKILL.md:38`). Everything else in the workflow above — routing, the todo list, `skip:` visibility, the ten lanes, "never merges", "one writer per worktree", principle citation — is prose that a cooperating agent is asked to follow. There is no lifecycle hook anywhere in the checkout (§3.F).

---

## 3. Enforcement inventory: everything that is more than prose

### A. `skills/poteto-mode/scripts/check-plan.mjs` — the plan-document linter

- **What it is.** 185 lines of plain Node, no dependencies, `#!/usr/bin/env node` (`check-plan.mjs:1`). Invoked by hand: `node pstack/skills/poteto-mode/scripts/check-plan.mjs <plan.md>` (`skills/poteto-mode/playbooks/multi-phase-plan.md:10`, which then says "fix every line it prints").
- **What it enforces** (all on the plan text, never on the work):
  - Section skeleton: an H1 (`:75` "no H1 title"), a `## How to read this` section (`:77`), a `## Program checklist` (`:87`), a `## Close the program` (`:102`), at least one PR section between them (`:106`), and only appendix sections after the close plus `Prototype evidence` (`:177-179`).
  - The intro length cap: `if (intro.length >= 10) fail(lines[h1].n, \`intro is ${intro.length} lines, under ten required\`);` (`:80`) — a 10-line intro **fails**, and the message reads backwards. The template states the intent: `<Under ten lines. What changes, for whom, the rule the program enforces, and the PR ids in order.>` (`skills/poteto-mode/playbooks/multi-phase-plan.md:20`).
  - Five markers that must appear verbatim inside `How to read this` (`:21-27`), including the verification rule itself: `const RULE = "Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.";` (`:5-6`).
  - Program-checklist H3s in order: `["Arm the program", "Spawn owners", "PR mechanics", "Verdict and merge", "Boot recipe"]` (`:19`), plus markers `["git show origin/main:", "/loop 1h", "status message"]` (`:20`).
  - Per-PR sub-blocks in **exact** order: `["Depends on.", "Files.", "Build.", "You see.", "Verify, unit.", "Verify, live.", "Verify, perf.", "Review gate.", "Merge."]` (`:8-18`), compared as a joined string (`:118`).
  - Non-empty blocks: Files, Build, You see, Verify-unit, Merge must each hold at least one checkbox (`:127-130`); `Depends on.` must name something (`:126`).
  - The rule must open each Verify block: `if (b && !b.rest.startsWith(RULE)) fail(...)` (`:131-134`).
  - Live lanes: the block must match `const LANES = /Ten lanes on \`[^\`<>]+\` at the PR head/;` (`:7`), and its boxes must be exactly lanes 1..10 (`:139-141`), each naming a screenshot (`/Save \`[^\`]+\`/`, `:144`) and carrying `Pass when` (`:145`).
  - Perf boxes must be exactly `["Metric.", "Probe.", "Baseline.", "Rule."]` (`:28`, `:151-152`).
  - Review gate: either `None.` with no boxes, or boxes plus the words `screenshot`, `video`, `operator` (`:155-166`).
  - Prose hygiene: long dash, curly quote, and mid-sentence colon are hard failures (`:58-60`), with code fences, inline code, and link targets stripped first (`:54-57`).
- **When it runs.** Only when an agent runs it. Nothing invokes it automatically.
- **Exit codes.** `2` for a missing argument with `Usage: node check-plan.mjs <plan.md>` (`:32-35`); `1` for any problem; `0` clean (`:185` `process.exit(problems.length ? 1 : 0);`).
- **If skipped.** Nothing observable happens. Two consequences worth naming: (a) the plan never enters the machine-checked shape, and (b) the checks are textual, so satisfying them is a formatting claim, not evidence of work — the file's own output line is `"${prSections.length} PR sections, ${problems.length} problems"` (`:183`).

### B. `skills/poteto-mode/scripts/orch/` — program bookkeeping with a verification ledger

- **What it is.** Bun CLI (`orch.ts:1`) over a plain-file store; `orch.ts:20` calls `ensureDependenciesInstalled()`, which downloads `commander` and re-execs (`bootstrap.ts:35-61`). Called as `bun scripts/orch/orch.ts` (`skills/poteto-mode/playbooks/orchestrate.md:23`).
- **Commands.** `init`; `unit add|set|get|list|counts` (`orch.ts:279-335`); `ledger record|check|summary` (`:337-381`); `inbox push|drain|count` (`:383-430`); `gate park|list|resolve` (`:432-471`); `frontier set|show` (`:473-503`); `status` (`:505-507`); `standing show|add` (`:509-533`).
- **What it enforces:**
  - A closed verdict vocabulary, `store.ts:21-26`: `live-ui-verified | unit-test-verified | type-check-only | verifier-blocked | verifier-failed`. Invalid input is refused with `"verdict must be live-ui-verified, unit-test-verified, type-check-only, verifier-blocked, or verifier-failed"` (`store.ts:290`), and a hand-edited ledger is refused too: `throw new UserError(\`ledger.tsv has invalid verdict ${rawVerdict}\`);` (`store.ts:512`).
  - Table shape: `const UNIT_HEADER = "id\ttrack\tstate\tbranch\tpr\tsha\tbrief";` / `const LEDGER_HEADER = "pr\tsha\tverdict\tevidence\tverifier\tts";` (`store.ts:17-18`), with row-width and header validation (`:450-457`).
  - Store identity and write-safety: an exclusive `.orch.lock` holding a pid (`store.ts:19`, `:385-391`), stale-lock takeover by liveness check, and `--force` as the explicit steal (`:419-427`), with the messages `store lock held by pid ${holder}` (`:426`) and `replacing stale store lock (pid ${holder} is dead)` (`orch.ts:231-232`). Writes are atomic — exclusive create, then rename:

```ts
await writeFile(temporary, contents, { flag: "wx" });
await rename(temporary, path);
```
(`store.ts:342-343`, inside `atomicWrite` at `:336-347`).
  - Uninitialized store: `throw new UserError(\`store is not initialized at ${store}; run orch init\`);` (`store.ts:1236-1238`).
  - Duplicate units: `throw new UserError(\`unit ${row.id} already exists\`);` (`store.ts:1261`).
  - The missing-verdict signal is a **first-class non-answer**, not an empty string: `throw new NotFoundError("NOT-VERIFIED", {...})` (`store.ts:1366-1369`) which `orch.ts` turns into exit code `2` (`:544-551`), while usage errors exit `1` and Commander errors exit `1` (`:539-542`).
  - Inbox pointers are one file each, named `${timestamp}-${process.pid}-${randomUUID()}.tsv` (`store.ts:1399-1400`) — the "one writer per file" rule from `principle-separate-before-serializing-shared-state` implemented in the store.
  - `status` regenerates `status.md` and reports *what changed* by parsing the previous embedded summary (`<!-- orch-summary ${JSON.stringify(currentSummary)} -->`, `store.ts:959`; render path `:1538-1574`).
  - The store layout is created idempotently (`store.ts:1576-1586`: `units.tsv`, `ledger.tsv`, `inbox/`, `gates.md`, `preferences.md`, `frontier.json`).
- **When it runs.** At drain points. `skills/poteto-mode/playbooks/orchestrate.md:71` names exactly four: "the end of a critical section, a track rollup, a frontier watcher wake ..., and before a human report. Begin each batch with `orch inbox drain`." A drain turn's shape is fixed (`:73-75`), ending with "the three lines from `orch status`: counts against the states, what changed, gates open."
- **What skipping costs.** The store is inert; nothing forces a row. But three later steps depend on rows that only the CLI can write correctly: the close condition "confirm every landed PR has a verdict for its current head SHA" (`orchestrate.md:66`), the rule that "`verifier-blocked` is not a pass" (`:89`), and the post-restart recovery that recomputes from `units.tsv` and `frontier.json` (`:101`). Edit the TSVs by hand and the enum check (`store.ts:512`) is the only thing that will complain.
- **The CLI deliberately does not orchestrate.** `orch.ts` is invoked at drain points and `skills/poteto-mode/playbooks/orchestrate.md:15` states its boundary: "State reads and writes go through `scripts/orch/orch.ts` at drain points, one command in and one line out. **The CLI never spawns, waits, or wakes anything.**"

### C. `skills/poteto-mode/scripts/watch-pr/` — the only machine verdict for "merge-ready"

- **What it is.** `watch-pr` is a 6-line bun shim (`watch-pr:1-6`) that bootstraps and calls `main` in `cli.ts`. Options (commander): `--owner`, `--repo`, `--pr`, `--stack`, `--queued-stack`, `--stack-prs`, `--interval` (default `60`), `--sweep-interval` (default `300`), `--timeout` (default `0`, i.e. disabled), `--max-query-errors` (default `5`), `--status-only`, `--allow-draft`, `--pretty` (`cli.ts:92-131`). `--stack-prs` without `--queued-stack` is rejected (`cli.ts:134-135`), and argparse failure exits `64` (`cli.ts:182`).
- **What it polls.** The `gh` CLI, via `spawn` (`github.ts:1`, `:32-34`): `gh pr view <n> --json number,url` (`:459-461`), `gh pr checks` (`:517-528`), `gh api graphql` for the check rollup, review threads, and commit statuses (`:434-441`, `:541-543`, `:575`, `:581`). Check data has a documented precedence, `:610-619`: `if (direct !== null) return { source: "gh-pr-checks", checks: direct };` … `if (fallback !== null) return { source: "graphql-rollup", checks: fallback };`.
- **What it enforces.** A blocker taxonomy (`types.ts:182-202`): `merge-conflicts`, `review-threads`, `failing-checks`, `merge-gate` (the last with reasons `closed-without-merge | draft-pr | changes-requested`, `:178-181`). Each maps to its own exit code, which is the actual contract:

```ts
case "merge-conflicts": return stamp({ kind: "BLOCKER", terminal: true, exitCode: 2, blocker });
case "review-threads":  return stamp({ kind: "BLOCKER", terminal: true, exitCode: 3, blocker });
case "failing-checks":  return stamp({ kind: "BLOCKER", terminal: true, exitCode: 4, blocker });
case "merge-gate":      return stamp({ kind: "BLOCKER", terminal: true, exitCode: 6, blocker });
```
(`policy.ts:311-319`, with `status-query` = `7` at `:326-336`.) `TIMEOUT` is `5` (`types.ts:333`); `STATUS`, `READY`, and `COMPLETE` exit `0` (stamped at `policy.ts:438-440`, `:466-488`, `:726-728`), with the verdict *types* declared in `types.ts:346-359`.

  Every emitted verdict is an envelope, so a consumer never has to guess freshness: `{ schemaVersion: 1, sequence, observedAt, mode, ...payload }` (`policy.ts:266-271`, stamped at `:293-304`). Default output is JSON/NDJSON; `--pretty` is the human form (`cli.ts:88`).
  Query failures are retryable or not, by kind (`types.ts:203-231` `json-parse | missing-key | command-exit | checks-unavailable | invalid-context-url`), with exponential backoff capped at 300s: `Math.min(Math.max(interval, 60) * 2 ** (failures - 1), 300)` (`policy.ts:262-265`).
- **When it runs.** When the Babysit or Shipping playbook runs it (`skills/poteto-mode/playbooks/babysit.md:12`: "On GitHub, status comes from `scripts/watch-pr/watch-pr`. Run it directly. ... The bare command polls until a terminal verdict, which is `drive` behavior. In `check` mode pass `--status-only`."). The playbooks then read its stop classes as text: "On GitHub, stop at `READY` for one PR ... Queued mode never emits `READY`. A blocker-free frontier is a non-terminal `WAITING` with reason `merge-queue`." (`babysit.md:16`).
- **If skipped.** Nothing polls, and on a non-GitHub forge there is no substitute at all — `babysit.md:12` says so explicitly: "The public watcher remains GitHub-specific, so do not pretend it covers Origin or add an Origin implementation just to run this playbook." The Origin path in the same playbook is pure instruction (`origin pr view ...`, `origin pr thread list ...`).
- **Tests pin the contract.** `package.json:6-7`: `"test": "bun test orch watch-pr"`, `"typecheck": "tsc --project watch-pr/tsconfig.json --noEmit --strict"`. The suite includes `policy.test.ts` (402 lines), `github.test.ts` (289), `cli.test.ts` (212), and `fakes.test-helper.ts` for the `GitHubReader` seam (`types.ts:382`).

### D. `skills/poteto-mode/scripts/worktree-audit.sh` — classify, never delete

- **What it is.** 96 lines of bash, `set -u` (`worktree-audit.sh:8`), read from `git worktree list --porcelain` rather than hand-typed paths (`:15`, `:40`). Usage line at `:7`.
- **What it enforces.** Only the *inputs* to a human decision; it never mutates. `:5`: "**Never deletes anything; deletion stays a human-gated step in the playbook.**" It emits a TSV with `SIZE AGE MERGED DIRTY REMOTE PR LAST_CHAT BUCKET WORKTREE` (`:38`) and a suggested bucket from real signals: `wip:N` (tracked edits) → `hold-wip`; a non-merged worktree whose PR is `OPEN` → `hold-open-pr`; a worktree whose newest transcript is ≤4 days old → `verify-recent-chat`; merged or PR-bearing → `safe`; else `review` (`:53-90`).
- **Its known blind spot is documented in the playbook, not the script.** `skills/poteto-mode/playbooks/worktree-cleanup.md:6`: "The bucket is advice, not permission. ... The lever has marked `safe` a worktree the user had pinned, so the pinned set wins."
- **Transcript scanning is harness-aware already**: it looks in Cursor, Claude Code, and Pi session dirs (`worktree-audit.sh:29-35`), and states the exclusions honestly — "Codex and OpenCode don't group sessions by project, so they aren't searched." (`:26`).
- **If skipped.** The playbook's safety gates are prose: `wip:N` pauses for a decision while `scratch:N` may be dropped (`worktree-cleanup.md:8`), and the destructive step is a hand-typed `git worktree remove --force <path>` (`:9`).

### E. `skills/show-me-your-work/scripts/log.sh` — the decision log's shape

- **What it enforces.** Argument count (`:6-9`), header-on-first-use with append semantics (`:21-23`), and cell hygiene: `v=$(printf '%s' "$1" | tr '\t\n\r' '   ')` plus a formula-injection guard `case "$v" in =*|+*|-*|@*) printf "'%s" "$v" ;;` (`:32-39`). The comment states why: "The skill expects this log to be read in spreadsheets, so attacker-controlled evidence (PR titles, filenames, generated text) must not become formula execution when a reviewer opens the file." (`:28-31`)
- **When it runs.** At logged decision points (`skills/show-me-your-work/SKILL.md:40`), and only if the agent chooses `log.sh` over a bare `printf` — which the skill allows, with the caveat: "A bare `printf` appending a row works too, but mind those same bytes if cells come from generated or user-supplied text." (`:38`). The human-readable schema and the append-only rule are at `:13-22` and `:52-53`.

### F. Hooks — none exist

I grepped the entire checkout case-insensitively for `hooks`. Three matches, all unrelated to a lifecycle hook system:

- `skills/poteto-mode/playbooks/multi-phase-plan.md:58` "Push with hooks on." (git hooks)
- `skills/poteto-mode/playbooks/autopilot-full.md:6` and `.../autopilot-stack.md:5` "the owner pushes its branch again after every verifiable unit (hooks on, a WIP commit is fine)"

`.cursor-plugin/plugin.json` declares only `skills` and `agents` (`:29-30`); there is no `hooks` key, no `.cursor/hooks/` path, and no hook config file anywhere in the inventory. **Conclusion: every gate in this project is either an instruction or a script an agent must choose to run. There is no automatic enforcement layer.** This is the single most important structural difference from a host that does have hooks.

### G. `automations/benny/*` — a dormant Cursor-automation pack

- **What it is.** Two Cursor automations driven by Slack issue reports, shipped as "dormant setup and automation sources" that "do not appear as slash skills" (`automations/benny/README.md:3-5`). The pack is copied into the target repo at `.cursor/automations/benny/` and read by repository-relative path (`automations/benny/FOR_AGENTS.md:31`, `:87`); pstack is enabled for it through the target's committed `.cursor/settings.json` (`FOR_AGENTS.md:67-75`, `.../setup-benny/SKILL.md:34-46`).
- **Automation 1 — triage.** Trigger: a new top-level report in the configured Slack channel (`FOR_AGENTS.md:9`). Enforced outputs: exactly one thread reply ending in one marker, `[benny:bug]` / `[benny:performance]` / `[benny:other]` (`automations/benny/skills/triage-issue-reports/SKILL.md:200-224`); never a root-channel post (`:16`); one Slack poster, children read-only and forbidden `SendSlackMessage`, `PostToSlack`, `chat.postMessage` (`:21-24`); tracker creation only when seven conditions all hold (`:173-183`) with the tie-breaker "Prefer no ticket over a guessed or duplicate ticket." (`:26`); and if the verdict post fails after a ticket was created, the adapter must compensate (`:228`).
- **Automation 2 — reproduce and fix.** Trigger: the same report, then a wait for a *trusted* marker — "Its author matches `slack.triage_identity_user_id`. It is a reply under `SOURCE_THREAD_TS`. It contains exactly one configured marker." (`.../reproduce-and-fix-issues/SKILL.md:60-64`). Enforced gates: "The exact discriminating symptom must appear twice through real UI interaction." (`:25`); "State inspection may confirm an observation. It must not inject or force the symptom." (`:26`); "**No confirmed repro means no authored fix.**" (`:27`); existing PRs switch to verify mode rather than competing (`:28`, `references/verify-existing-fix.md:5`); the fix gate is a seven-condition checklist (`:228-238`); "A compile, unit test, code review, or plausible diff is not after evidence." (`:280`); and "Open a **draft** pull request. Never merge or deploy from this workflow." (`:291`, config `draft_only: true` at `automations/benny/templates/configuration.example.yaml:25`).
- **Numbers the pack lives on** (`configuration.example.yaml:70-78`): `poll_seconds: 45`, `verdict_wait_minutes: 45`, `triage_follow_up_minutes: 10`, `triage_total_minutes: 30`, `repro_minutes: 60`, `rejection_window_minutes: 10`, `fix_minutes: 90`, `operations_follow_up_minutes: 45`; artifact retention `artifact_retention_hours: 24` (`:52`).
- **If skipped / not configured.** Everything fails closed rather than guessing: "Load the external Benny configuration supplied by the automation. If the config is missing, malformed, or incomplete, stop without posting or writing to the tracker." (`.../triage-issue-reports/SKILL.md:11`); "If the adapter is absent or any required capability is missing, mark the operations status as blocked and stop." (`.../reproduce-and-fix-issues/SKILL.md:142`). The setup file also refuses to act uninvited: "Do not create or update an automation until the user explicitly asks." (`.../setup-benny/SKILL.md:15`), restated at `FOR_AGENTS.md:83`.

---

## 4. Context-window discipline

### 4.1 The stated rule

`skills/principle-guard-the-context-window/SKILL.md:9`: "The context window is finite and non-renewable within a session. Every token should be worth its cost." Its three patterns are the whole policy:

- `:14` "**Isolate large payloads.** Route verbose outputs, screenshots, and large documents to subagents. The main context gets summaries, not raw data."
- `:15` "**Keep frequently used content inline.** Templates and references used on every invocation belong in the skill file, not in separate files that cost a read each time."
- `:16` "**Size phases and cap scope.** Limit files per phase, set turn budgets, account for mechanism costs."

### 4.2 How the system decides what enters context

1. **Description first, body on invocation.** Because 52 of 53 skills carry `disable-model-invocation: true`, only `description` competes for the model's attention; bodies arrive when something names the skill. The one exception is `skills/setup-pstack/SKILL.md`, and the one always-on vector in Cursor is the rules file `~/.cursor/rules/pstack-models.mdc` with `alwaysApply: true` (`skills/setup-pstack/SKILL.md:49`).
2. **A persistent mode adds a per-turn nudge, not a body.** `skills/poteto-mode/SKILL.md:8` `reminder:` is the mechanism; the body is loaded once and then governs.
3. **The router is inline; the routed file is not.** 23 playbooks are indexed in one line each (`skills/poteto-mode/SKILL.md:137-159`); only the matched one is opened (`:133`).
4. **Subagents get pointers, not payloads.** `skills/poteto-mode/SKILL.md:95`: "Defaults for every `Task` call. `run_in_background: true`, agent mode (readonly strips MCP), **file pointers not inlined context**, explicit model per role".
5. **Bulk goes to fan-out with a summary contract.** `skills/show-me-your-work/SKILL.md:57` has the same rule for logs; `skills/recall/SKILL.md:25` states it in the extreme: "The raw transcripts stay in the subagents. The main thread gets only their findings." And `skills/swarm/SKILL.md:42`: "Do not paste raw worker dumps."
6. **Transcript scope is a privacy boundary as much as a context one**, repeated in three skills: `skills/poteto-mode/SKILL.md:108` "Read only the active workspace's sessions, never other projects'."; `skills/reflect/SKILL.md:19` "Never glob across every project's directory. That crosses workspace boundaries and reads private chats from unrelated projects."; `skills/automate-me/SKILL.md:31` the same sentence.
7. **Review-inline is banned in the fan-out playbooks.** `skills/poteto-mode/playbooks/orchestrate.md:70`: "On a completion notification, run `orch inbox push ...` and return to what you were doing. **Never deep-review inline.** ... Never review a diff inside a drain."
8. **Playbooks are pulled from trunk, so the context is versioned**, not whatever is checked out locally (`skills/poteto-mode/playbooks/multi-phase-plan.md:36`).

### 4.3 What keeps a skill small

Stated as rules, not budgets:

- `skills/poteto-mode/playbooks/authoring-a-skill.md:10` "When in doubt, delete. **Keep only prose that changes a decision.** Tell it to do the thing and skip the reason. Explain only when the rule is confusing without one. ... Delegate to other skills by path. Don't restate."
- `skills/automate-me/SKILL.md:96-97` "**Don't be clever.** Restating other skills' contents, inventing metaphors, or writing 'poetic' prose for an agent reader is cost without benefit. Keep it operational." / "**Reference, don't inline.** Other skills the user relies on should appear as path references, not pasted excerpts."
- `skills/automate-me/SKILL.md:98` "**Keep sections minimal.** Only add a section if the user has a specific, non-default rule there."
- `skills/automate-me/SKILL.md:87` "Cut ruthlessly. A mode skill is not a manual."
- `skills/show-me-your-work/SKILL.md:81-82` "Other skills route their audit trail here instead of inventing one. Reference it by name and let it own the format. **Don't restate the columns.**"
- `skills/principle-subtract-before-you-add/SKILL.md:20` "Simplify prompts (remove redundant instructions, excessive templates)".

### 4.4 The numbers actually stated

Every number I could find, quoted:

- **Ten, twice.** The live lane count is fixed at ten: `skills/poteto-mode/playbooks/multi-phase-plan.md:100` "Ten lanes on `<swarm workers model>` at the PR head, per the boot recipe."; enforced by `check-plan.mjs:141` `fail(live.n, \`${pr.title}: lanes are [${numbers.join(",")}], expected 1 to 10\`);`. The playbook also fixes the model's role: `.../multi-phase-plan.md:13` "Ten lanes at the PR head drive the real surface through its control skill, per the **swarm** skill, on the `swarm workers` model".
- **Under ten lines.** The plan intro: `skills/poteto-mode/playbooks/multi-phase-plan.md:20` "<Under ten lines. What changes, for whom, the rule the program enforces, and the PR ids in order.>", enforced (inverted-wording) at `check-plan.mjs:80`.
- **About 40 lines.** `skills/poteto-mode/playbooks/opening-a-pr.md:13`: "If the body would make the squash commit longer than about 40 lines, cut the body."
- **1k lines.** `skills/interrogate/references/code-quality-review.md:23`: "**Do not let a PR push a file from under 1k lines to over 1k lines without a very strong reason.** Treat this as a strong smell." Restated as a presumptive blocker at `:43`.
- **30 seconds.** `skills/principle-minimize-reader-load/SKILL.md:23`: "**The test:** Can a new reader answer "where does X come from?" and "what can change X?" in under 30 seconds? If not, cut layers or cut state."
- **3 files or layers.** `skills/principle-laziness-protocol/SKILL.md:12`: "If answering a question requires tracing through more than 3 files or layers, flatten it."
- **50 globals / 6 layers.** `skills/principle-minimize-reader-load/SKILL.md:13`: "A flat file with 50 globals can be as hard to reason about as a 6-layer adapter stack."
- **2-3 prototypes.** `skills/principle-exhaust-the-design-space/SKILL.md:11`: "When the right answer is not obvious, build 2-3 competing prototypes or sketches."
- **2-4 explorers.** `docs/guide/03-understand.md:13`: "For a big subsystem it fans out two to four read-only explorers first."
- **Roughly ten children.** `skills/poteto-mode/playbooks/orchestrate.md:16`: "Cap in-flight children at what one drain can process, roughly ten, as a rolling window."
- **4KB.** `skills/poteto-mode/playbooks/orchestrate.md:52`: "A 4KB scaffold around a two-line edit costs more to write and obey than the edit."
- **~10 lines of skill edit.** `skills/reflect/SKILL.md:70`: "Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): hand to your harness's skill-authoring skill and run its draft / test / iterate loop."
- **15 minutes.** `skills/poteto-mode/playbooks/autopilot-full.md:6`: "Within about 15 minutes, every owner starts a `decisions.tsv` trail ... and opens the PR ready, never draft."
- **70%.** `skills/poteto-mode/playbooks/orchestrate.md:60`: "By roughly 70% of it, stop spawning and land what is verified."
- **30-60 second video.** `skills/poteto-mode/playbooks/multi-phase-plan.md:123`: "Record a 30 to 60 second video of the change on a lane VM."
- **One hour.** The audit tick: `.../autopilot-stack.md:6` "The root runs an audit tick every hour. On the operator's go, the root arms `/loop 1h`".
- **Aha test**: `skills/principle-guard-the-context-window/SKILL.md:16` gives no number for "limit files per phase" or the "turn budget" — see §8.
- **The one anti-example of a budget** appears where a reviewer is told to reject over-specific findings: `skills/reflect/references/synthesizer.md:16` rejects "hyper-specific facts ("`<specific-skill-name>` has 175 tokens at limit 80")", repeated at `:26`. That implies a token budget exists somewhere in the author's world; nothing in this checkout defines one (§8).

---

## 5. Verification

### 5.1 What a verification skill contains

`skills/create-verification-skill/SKILL.md` generates `<skills>/verify-<app>/SKILL.md` with frontmatter `name: verify-<app>` and a description naming app, surface, and trigger, plus **six sections**, each grounded in an interview of the repository rather than the user (`:11-13` "Answer these from the codebase and only ask the user what you cannot observe"):

- **Launch** — "the exact command that starts the app for verification, and how to tell it's ready (a log line, a port answering, a prompt). Include teardown." (`:27`)
- **Doctor** — "one read-only check that answers 'is this instance worth driving?' — process up, right version/build, port owned by us, auth valid." (`:28`)
- **Drive** — "the harness recipe with real selectors/commands from this repo, not examples." (`:29`)
- **Evidence** — what to capture and where, with proof standards (`:30`)
- **Cleanup** — "Never kill by process name; kill what you started. **Cleanup removes instances and scratch state, never the evidence**: proof artifacts survive the teardown, in a location the skill names." (`:31`)
- **Helpers** — "A helper the reader has to reverse-engineer is not a helper." (`:32`)

Plus a **feature map**: `features/README.md` and one file per feature, top 3-5 to start, each answering "from the user's point of view: what the feature is, how to reach it, how to drive it with the harness, and what observable end state proves it works", with exactly four H2s: "`Sub-features`, `How to get to it (user POV)`, `Driving it with <harness>`, and `Gotchas`." (`:36`). The worked example states the same contract as a rule: `skills/create-verification-skill/references/feature-map-example/README.md:35-42` ("It then uses exactly four H2 sections in this order"), and the two example features show the granularity — `create-note.md:5-10` lists four sub-feature IDs, `search.md:5-12` lists six — and the proof discipline: `create-note.md:38` "A save status alone is insufficient proof. Reopen the note from the list."

### 5.2 Who runs it

"Any agent, later, cold": `skills/create-verification-skill/SKILL.md:9` "You write the generator's output for the next agent, not for a human: it will be read cold, mid-task, by an agent that has never seen the app." And for scale, `docs/guide/06-verify-and-ship.md:41`: "Once the verify skill works, a `/swarm` can split a full pass by feature-map entry and aggregate the results." Maintenance is a separate, periodic pass with one long-lived or per-drive instance, decided by the skill's own Launch section (`skills/maintain-verification-skill/SKILL.md:33`).

### 5.3 How "proved" is defined

- **The generator proves itself before handover**: `skills/create-verification-skill/SKILL.md:40` "Run its own instructions end to end once: launch, doctor, drive ONE mapped feature (one is enough; the map exists so later runs can cover the rest), capture evidence, clean up. After cleanup, confirm the evidence still exists at the named location — a cleanup that eats the proof fails this step. ... **A generated skill that was never executed is a draft, not a deliverable.**"
- **Proof must exercise the real user path**: same file `:30`, "exercise the real user path, not internal setters or test-only endpoints; capture the action and the resulting state, not just the final screen; verify side effects (files written, rows inserted, messages sent) alongside what's visible; mocks only where a production boundary already isolates the external system." Dry-runs must be observed, not trusted: "verify what it actually skips by observing (files, network, git refs) rather than trusting its name: some dry-runs still touch the network or open a browser."
- **The prover must not be the author**: `skills/poteto-mode/playbooks/shipping.md:7` "One subagent per PR, not batched, each a Cursor cloud agent, each exercising the real surface ... **Safe means a verdict from an agent that did not write the code. CI green is not a verdict, and an approving bot review is not a verdict.**" Echoed at `docs/guide/06-verify-and-ship.md:85`: "the agent that judges a change is never the one that wrote it."
- **A verdict is keyed to an exact revision and voids on change**: `skills/poteto-mode/playbooks/orchestrate.md:89` "The ledger answers 'was this verified', not memory and not the transcript. ... A new head SHA voids the row, so re-verify after restack." Shipping adds the patch-id rule: `.../shipping.md:9` records head SHA, base SHA, and stable `git patch-id`, because "A rebase or base retarget rewrites SHAs and can silently invalidate a verdict without touching a check."
- **Independent verification runs even on a green stack**: `docs/guide/06-verify-and-ship.md:85` "The Shipping playbook verifies each PR independently before it arms anything." And only a contiguous verified run lands: `.../shipping.md:8` "A verified PR sitting above an unverified one is not landable."
- **Self-report is overridable**: `skills/poteto-mode/playbooks/orchestrate.md:89` "A worker may self-report. A verifier overrides it on the same key."
- **Determinism beats eyeballs**: `skills/principle-prove-it-works/SKILL.md:20` "The strongest proof is a deterministic script that re-runs the same comparison, not a one-time eyeball."

### 5.4 What is explicitly rejected as proof

| Rejected | Quote | Anchor |
|---|---|---|
| "It compiles" | "Do not infer from proxies, self-reports, or "it compiles."" | `skills/principle-prove-it-works/SKILL.md:9` |
| Any indirect signal | "Indirect verification (file mtimes, output freshness, agent self-reports, cached screenshots) feels cheaper than direct observation." | `skills/principle-prove-it-works/SKILL.md:11` |
| Green CI as a verdict | "CI green is not a verdict, and an approving bot review is not a verdict." | `skills/poteto-mode/playbooks/shipping.md:7` |
| Tests alone | "Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked." | `check-plan.mjs:5-6`; `skills/poteto-mode/playbooks/multi-phase-plan.md:13` |
| Type-check-only, for behavioral work | "CI green is an input to a verdict, not a verdict. Behavioral work needs better than `type-check-only`. `verifier-blocked` is not a pass." | `skills/poteto-mode/playbooks/orchestrate.md:89` |
| Compile/unit test/diff as "after" evidence | "A compile, unit test, code review, or plausible diff is not after evidence." | `automations/benny/skills/reproduce-and-fix-issues/SKILL.md:280` |
| A screenshot or unit test as a UI repro | "Do not pretend a screenshot, unit test, state mutation, or source reading is a UI repro." | `.../reproduce-and-fix-issues/SKILL.md:142` |
| A claim without a commit or PR as a fix | "A thread claim, tracker status, branch name, or cause hypothesis without a pull request or commit is not enough." | `.../references/verify-existing-fix.md:15` |
| A single observation as a repro | "If the symptom does not appear twice on the baseline, there is no baseline. Do not claim that the fix works." | `.../references/verify-existing-fix.md:47` |
| A capped or weakened test | "Prefer no new test over a bad test." + the five conditions that make a test impractical | `skills/tdd/SKILL.md:26`, `:11` |
| A test that cannot fail | "If the test would still pass when every imported function returns `undefined`, rewrite the assertion or delete the test." | `skills/principle-test-behavior-not-implementation/SKILL.md:11` |
| A confident reply without evidence | "you should treat a confident reply without evidence as a red flag" | `docs/guide/06-verify-and-ship.md:15` |

`skills/tdd/SKILL.md` supplies the positive half: write the smallest test, **run it before the fix** and "Confirm it fails for the intended reason" (`:18`), then fix, then rerun (`:19-20`), and report the failing-before evidence in the final response (`:38-42`).

---

## 6. The 24 principles

One line each, in the skill's own terms, then the classification. `operational` = the file contains something that changes what an agent does in a turn (a check, a procedure, a stop condition, a written artifact). `aphoristic` = a value statement with no in-turn action.

| # | Principle | The rule in its own terms (with the decisive anchor) | Class |
|---|---|---|---|
| 1 | laziness-protocol | "Aim for the most result with the least code and complexity." (`:9`) with a check: "If answering a question requires tracing through more than 3 files or layers, flatten it." (`:12`) | operational |
| 2 | foundational-thinking | "**Data structures first.** Get the data shape right before writing logic." (`:11`) + "**Scaffold first.** If something helps every later phase, do it first." (`:17`) + concurrency corollary `:15` | operational |
| 3 | redesign-from-first-principles | "Ask: 'if we were writing this from scratch with this new requirement, what would we build?'" (`:12`), then "Propagate the change through every reference: types, docs, examples, rationale sections" (`:13`) | operational (judgment gate) |
| 4 | attack-the-premise | "**Write the premise down.**" + "**Take a census before the next fix.** ... Write the census as a rerunnable script" (`:14-15`), with the stop "Do not start the next fix before the premise is written down and the census exists." (`:20`) | operational |
| 5 | subtract-before-you-add | "When evolving a system, remove complexity first, then build." (`:9`) + "No speculative validators, parsers, or guards beyond what the spec demands" (`:19`) | operational |
| 6 | minimize-reader-load | Track "**Layers to trace.**" and "**State to hold.**" (`:10-11`); test: 30 seconds (`:23`) | operational |
| 7 | outcome-oriented-execution | "Optimize for the intended, verifiable end state rather than preserving smooth intermediate states." (`:9`) + "Declare where temporary breakage is acceptable" (`:19`) | operational |
| 8 | experience-first | "When implementation convenience conflicts with user delight, choose delight." (`:9`); "Ship less, ship better (polished experience with three features beats rough one with ten)" (`:12`) | aphoristic |
| 9 | exhaust-the-design-space | "When the right answer is not obvious, build 2-3 competing prototypes or sketches." (`:11`) with explicit when/`When it doesn't` lists (`:13-21`) | operational |
| 10 | build-the-lever | "Applying this principle produces a file. If you cited it and there is no codemod, script, generator, or delegate skill in the diff, you didn't apply it." (`:18`) | operational |
| 11 | model-the-domain | "Encode the real domain in a data structure instead of scattering it across conditionals." (`:9`) + the reach-for list (`:15-22`) and the failure sign (`:26`) | operational |
| 12 | boundary-discipline | "Place validation, type narrowing, and error handling at system boundaries. Trust internal code unconditionally." (`:9`); tests at `:33-34` | operational |
| 13 | type-system-discipline | "The type checker is a proof assistant." (`:9`) + seven patterns and six tests (`:13-30`) | operational |
| 14 | make-operations-idempotent | "Every state-mutating operation should answer: 'What happens if this runs twice? What happens if the previous run crashed halfway?'" (`:9`) with the three-question test (`:19-22`) | operational |
| 15 | migrate-callers-then-delete-legacy-apis | "Inventory callers, migrate them, and delete the old API immediately" (`:13`) + the three preconditions (`:17-20`) | operational |
| 16 | separate-before-serializing-shared-state | "**Default: eliminate the shared write target.**" (`:15`); "Treat 'we need a lock' as a design smell" (`:16`) | operational |
| 17 | prove-it-works | "Verify every task output by checking the real thing directly." (`:9`) + "Script the check when you can" (`:18-20`) | operational |
| 18 | fix-root-causes | "Reproduce first" / "Ask 'why' until you hit the root cause" / "Do not add guards (adding a nil check to silence a crash is a symptom fix)" (`:14-16`); restart heuristic `:21-23` | operational |
| 19 | sequence-verifiable-units | "Order work as a sequence of small units, each ending in a state you can check, and don't advance until the current one is green." (`:9`) + delivery order "failing test first, then the fix on top" (`:15`) | operational |
| 20 | test-behavior-not-implementation | The falsifier "whether it would still pass if every function it imports returned `undefined`" (`:11`) + five named shapes (`:15-21`) + the concrete fix (`:23`) | operational |
| 21 | explain-the-number | "**Ask 'why not double?'**" (`:15`); "List what else the number could be measuring, and rule out each one with evidence." (`:16`); skipped-when at `:21` | operational |
| 22 | guard-the-context-window | "Route bulk to subagents; keep summaries in the main thread, not raw payloads." (`:3`) + the three patterns (`:14-16`) | operational |
| 23 | never-block-on-the-human | "**Proceed, then present.** Do the work, show the result. Don't ask 'should I do X?'" (`:14`) with the irreversible-action boundary (`:18-20`) | operational |
| 24 | encode-lessons-in-structure | "1. Ask: can this be a lint rule, a metadata flag, a runtime check, or a script? 2. If yes, encode it. **Delete the instruction**" (`:15-17`) + the strength ranking (`:19`) | operational |

Counts: 23 operational, 1 aphoristic (`experience-first`). Two borderline calls worth flagging rather than hiding: `redesign-from-first-principles` is operational only through a stated procedure whose trigger is a judgment ("integrating a change"), and `foundational-thinking` is operational through sequencing rules rather than a check. The only file I would defend as aphoristic is `experience-first`: it contains no check, no procedure, and no artifact — its three actionable-looking bullets all delegate elsewhere (`:13` "Prototype before committing (design decisions are cheaper in throwaway HTML than production code)" points at `exhaust-the-design-space`).

**How the set is enforced.** Not by any script. The mechanism is a naming requirement plus a self-report: `skills/poteto-mode/SKILL.md:15` "name each principle that shaped a decision and the specific choice it changed. Cite only principles whose leaf SKILL.md you read this session." and the anti-name-dropping test at `docs/guide/08-principles.md:27`. Group counts for navigation: 10 core, 6 architecture, 5 verification, 2 delegation, 1 meta (`README.md:249-275`, `skills/poteto-mode/SKILL.md:42-79`).

---

## 7. Cursor-only dependencies

Legend: **[C]** Cursor-only with no equivalent here, **[M]** Cursor-only but the mirror supplies a documented substitute, **[T]** third-party (not Cursor) but still an external dependency.

| Mechanism | Evidence | Status off Cursor |
|---|---|---|
| `Task` tool (subagent spawning, `subagent_type`, `run_in_background`, `environment: "cloud"`, `cloud_base_branch`) | `skills/poteto-mode/SKILL.md:105`; `skills/swarm/SKILL.md:30-34`; `skills/poteto-mode/playbooks/orchestrate.md:17` "Always `environment: "cloud"` unless the task needs this machine" | **[M]** for the tool (use the host's subagent tool per the mapping); **[C]** for cloud agents — there is no Pi equivalent of a cloud VM host, and Orchestrate's placement logic assumes one |
| `poteto-agent` / `Comment Sicko` registered subagents | `.cursor-plugin/plugin.json:30`; `agents/poteto-agent.md:3-4` "Substituting `generalPurpose` skips that read and drifts." | **[M]** — `skills/poteto-mode/SKILL.md:106` gives the substitute prompt verbatim; `skills/no-comments/SKILL.md:19` gives the Comment Sicko substitute |
| Plugin system (`/add-plugin pstack`, manifest, project-scoped `plugins.pstack.enabled`) | `README.md:63`; `.cursor-plugin/plugin.json:29-30`; `automations/benny/FOR_AGENTS.md:67-75` | **[M]** for skills (`README.md:12-16` installs via the harness-agnostic `skills` CLI); **[C]** for the project-scoped plugin gate benny depends on (`.../setup-benny/SKILL.md:48-63` requires a fresh project-scoped resolution check) |
| Slash commands (`/poteto-mode`, `/how`, `/arena`, …) | `README.md:157-182` | **[M]** — commands are a host surface; skills work by name, and Pi would need its own command mapping |
| Cursor built-ins pstack assumes: `/loop`, `create-skill`, `/automate`, built-in `/babysit`, `/despawn` | `skills/poteto-mode/SKILL.md:111` "`/loop` is built into Cursor and Claude Code."; `README.md:278-284`; `automations/benny/FOR_AGENTS.md:85` | **[M]** — `SKILL.md:111` gives substitutes (timed shell command instead of `/loop`; Anthropic `skill-creator` or the Agent Skills format instead of `create-skill`); the benny pack has no substitute since its automations *are* the mechanism |
| Cursor automations + Slack action names (`configured-slack-read-action`, `configured-slack-thread-post-action`) + `/automate` drafts | `automations/benny/README.md:3-5`; `.../configuration.example.yaml:11-18`; `.../FOR_AGENTS.md:85` | **[C]**. Slack itself is portable; the automation host and its action bindings are not |
| Always-applied rules (`~/.cursor/rules/pstack-models.mdc`, `alwaysApply: true`) | `skills/setup-pstack/SKILL.md:10`, `:49`; `docs/guide/01-setup.md:23` | **[M] but weaker**: off Cursor the settings live in `~/.agents/pstack-models.md` and each skill must *read it at task start* (`skills/poteto-mode/SKILL.md:107`), so the injection is voluntary rather than guaranteed |
| `agent-transcripts/` session dir | `skills/poteto-mode/SKILL.md:108` | **[M]** — the mirror already documents the Pi layout `~/.pi/agent/sessions/--<slug>--/*.jsonl`, and `skills/poteto-mode/scripts/worktree-audit.sh:29-35` searches Cursor, Claude Code, and Pi dirs |
| Structured-question tool (`AskQuestion`) | `skills/poteto-mode/SKILL.md:110` | **[M]** — mapped per harness with a fallback: "Without one, ask in chat with numbered options." |
| `cursor-team-kit` skills: `deslop`, `control-ui`, `control-cli` | `README.md:282-284`; `skills/poteto-mode/SKILL.md:111`; `skills/poteto-mode/playbooks/multi-phase-plan.md:15` | **[C]**. These are load-bearing: the ten live lanes are defined as driving "the real surface through its control skill" (`multi-phase-plan.md:13-15`), and the substitute is generic automation — "Playwright or a CDP browser for web and Electron, tmux or a PTY for CLIs and TUIs" (`SKILL.md:111`) |
| Graphite `gt` (merge-frontier authority) | `skills/poteto-mode/playbooks/orchestrate.md:79` "Recompute `frontier.json` from `gt` after every merge"; parser errors at `skills/poteto-mode/scripts/orch/store.ts:1053-1061` | **[T]** — not Cursor, but `orch frontier set` is unusable without it. Everything else in `orch` works without `gt` |
| Origin CLI (alternate forge) | `skills/poteto-mode/playbooks/babysit.md:7`; `.../shipping.md:7` | **[T]** — optional path; the watcher is GitHub-only (`babysit.md:12`) |
| Cursor worktrees / `environment: "cloud"` VMs for lane isolation | `skills/poteto-mode/playbooks/multi-phase-plan.md:71` "Each live lane runs on its own cloud VM at the PR head."; `.../orchestrate.md:17` | **[C]** for the VM; **[M]** for isolation (a local worktree per writer, `skills/principle-separate-before-serializing-shared-state/SKILL.md:15`) |
| Hooks | none found (§3.F) | **N/A** — nothing to port, and nothing automatic to inherit |

**The honest summary of §7.** Only four things are hard Cursor dependencies with no substitute inside this checkout: cloud agents as lane/owner hosts, the automation host for benny, `cursor-team-kit`'s control skills, and guaranteed always-applied model config. Everything else is either already mapped in the `Harness` section (`skills/poteto-mode/SKILL.md:103-111`) or is third-party tooling (`gt`, `origin`, `gh`). For a Pi-based harness the sharpest gap is not the `Task` tool — Pi does have subagents — it is the **control-skill layer**: pstack's entire "proved" story bottoms out in "drive the real app", and pstack deliberately ships no driver for it.

---

## 8. Where this audit is uncertain

1. **No SKILL.md validator exists in the checkout.** `skills/reflect/SKILL.md:74` defers to "If your environment ships a SKILL.md validator"; `skills/poteto-mode/playbooks/authoring-a-skill.md:6` states the validation criteria but names no tool. So the frontmatter contract in §1.1 is *observed*, not *enforced here*.
2. **`paths:` + `disable-model-invocation: true` on the same file.** `skills/typescript-best-practices/SKILL.md:4-5` has both, while `docs/guide/05-build-and-clean.md:47` says it "loads whenever the agent touches a `.ts` or `.tsx` file". No Cursor documentation ships in this checkout, so which field wins is unclear from these files alone.
3. **Token budgets for skills are implied but never defined.** `skills/reflect/references/synthesizer.md:16` uses "`<specific-skill-name>` has 175 tokens at limit 80" as an example of an over-specific fact. No such limit appears anywhere else in the checkout. Unclear whether it is a Cursor `create-skill` guideline or fictional.
4. **"Limit files per phase, set turn budgets" (`skills/principle-guard-the-context-window/SKILL.md:16`) states no numbers.** The only concrete phase budget I found is the ten-line plan intro (`check-plan.mjs:80`) and the ten live lanes (`multi-phase-plan.md:100`).
5. **`check-plan.mjs:80` reads inverted**: the condition fails at `intro.length >= 10` while the message says "under ten required". I read this as a wording bug, not a policy, but I did not find a second statement of the limit to confirm the intended threshold. The template's own instructions ("Under ten lines", `multi-phase-plan.md:20`) match the *condition*, not the message.
6. **Whether hooks could be added without Cursor.** The plugin manifest is the only registration surface in this checkout (`plugin.json:29-30`), and there is no hook file or schema here, so I cannot say whether Cursor plugins may declare hooks at all — only that pstack does not use them.
7. **The `docs/guide` workflow is not a state machine.** I found no file that lists phases as data, no phase id, and no resume mechanism outside `orch`'s store. The "phases" in §2 are the guide's page order plus each phase's named owner skills; the real enforceables are the per-playbook steps.
